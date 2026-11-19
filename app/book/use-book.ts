"use client";

import { useSyncExternalStore, type SetStateAction } from "react";
import {
  blankBudget,
  legacyBackup,
  persistBudget,
  readStoredBudget,
  STORAGE_KEY,
  SAMPLE_STORAGE_KEY,
  type Budget,
} from "./model.mjs";

type Snapshot = {
  budget: Budget;
  status: "loading" | "saved" | "error";
  error: string;
  legacy: string;
  recovery: string;
  blocked: boolean;
};

// The server never reads or writes a browser's book. React uses this same blank
// snapshot while hydrating, then subscribes to the browser-only stored snapshot.
const serverSnapshot: Snapshot = {
  // Worker modules load outside request scope: no randomness or clock reads.
  // Browser hydration replaces this inert placeholder with a real book.
  budget: blankBudget("Household", { id: "opening-book", period: "" }),
  status: "loading",
  error: "",
  legacy: "",
  recovery: "",
  blocked: false,
};
let current: Snapshot | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function getSnapshot(): Snapshot {
  if (current) return current;
  try {
    current = {
      budget: readStoredBudget(localStorage),
      status: "saved",
      error: "",
      legacy: legacyBackup(localStorage),
      recovery: "",
      blocked: false,
    };
  } catch {
    let recovery = "";
    try {
      recovery = JSON.stringify(
        Object.fromEntries(
          [
            STORAGE_KEY,
            SAMPLE_STORAGE_KEY,
            "ellies-book:look-a:v1",
            "ellies-book:look-a:example:v1",
          ].map((key) => [key, localStorage.getItem(key)]),
        ),
        null,
        2,
      );
    } catch {
      /* Storage may be disabled altogether. */
    }
    current = {
      ...serverSnapshot,
      status: "error",
      blocked: true,
      recovery,
      error:
        "This browser could not open your saved book. It has not been overwritten. Download the saved copy before restoring a book.",
    };
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key && !event.key.startsWith("ellies-book:")) return;
    // Do not replace unsaved edits when the browser cannot persist them.
    if (current?.status === "error") return;
    current = undefined;
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setBudget(next: SetStateAction<Budget>, restore = false) {
  const prev = getSnapshot();
  const budget = typeof next === "function" ? next(prev.budget) : next;
  if (prev.status === "error" && !prev.budget.sample && budget.sample) {
    // The personal snapshot may be the only copy of failed writes. Never
    // exchange it for disposable example data, even if storage recovers.
    current = {
      ...prev,
      error: "Your personal changes are not saved. Download a book backup and save your changes before opening the example.",
    };
    emit();
    return false;
  }
  try {
    if (prev.blocked && !restore)
      throw new Error(
        "The saved book is protected. Download it before restoring another book.",
      );
    persistBudget(localStorage, budget);
    current = {
      ...prev,
      budget,
      status: "saved",
      error: "",
      blocked: false,
      recovery: "",
    };
  } catch (error) {
    current = {
      ...prev,
      budget,
      status: "error",
      error:
        error instanceof Error && prev.blocked
          ? error.message
          : "This browser could not save your changes. Keep this page open and download a book backup before leaving.",
    };
  }
  emit();
  return current.status === "saved";
}

function removeExample() {
  // Read first. A malformed personal book must never be silently replaced.
  const personal = readStoredBudget(localStorage, false);
  setBudget(personal);
  return personal;
}

export function useBook() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSnapshot,
  );
  return { ...snapshot, setBudget, removeExample };
}
