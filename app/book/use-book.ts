"use client";

import { useSyncExternalStore, type SetStateAction } from "react";
import {
  legacyBackup,
  STORAGE_KEY,
  SAMPLE_STORAGE_KEY,
  type Budget,
} from "./model.mjs";
import {
  activeBudget,
  changeLibrary,
  emptyLibrary,
  initialProject,
  LIBRARY_KEY,
  readLibrary,
  restoreLibrary,
  serializeLibrary,
} from "./library-model.mjs";
import type { Library, LibraryAction } from "./library-model.mjs";

type Snapshot = {
  library: Library;
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
  library: emptyLibrary(),
  budget: initialProject(),
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
    const library = readLibrary(localStorage);
    current = {
      library,
      budget: activeBudget(library) ?? initialProject(),
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
            LIBRARY_KEY,
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

function saveLibrary(library: Library, recover = false) {
  const prev = getSnapshot();
  if (prev.blocked && !recover) {
    current = {
      ...prev,
      error:
        "The saved library is protected. Download the saved copy before restoring books.",
    };
    emit();
    return false;
  }
  const budget = activeBudget(library) ?? initialProject();
  try {
    const markdown = serializeLibrary(library);
    if (prev.blocked && recover) {
      const raw = localStorage.getItem(LIBRARY_KEY);
      if (raw !== null)
        localStorage.setItem(`${LIBRARY_KEY}:recovery:${Date.now()}`, raw);
    }
    localStorage.setItem(LIBRARY_KEY, markdown);
    current = {
      ...prev,
      library,
      budget,
      status: "saved",
      error: "",
      blocked: false,
      recovery: "",
    };
  } catch (error) {
    current = {
      ...prev,
      ...(!prev.blocked ? { library, budget } : {}),
      status: "error",
      error:
        error instanceof Error && prev.blocked
          ? error.message
          : "Changes are on this page only. Device storage is full or unavailable. Download all books before leaving.",
    };
  }
  emit();
  return current.status === "saved";
}

function libraryAction(action: LibraryAction) {
  const prev = getSnapshot();
  if (
    prev.status === "error" &&
    !prev.budget.sample &&
    action.type === "example"
  )
    return false;
  return saveLibrary(changeLibrary(prev.library, action));
}

function setBudget(next: SetStateAction<Budget>, projectId?: string) {
  const prev = getSnapshot();
  if (projectId && prev.budget.id !== projectId) return false;
  const budget = typeof next === "function" ? next(prev.budget) : next;
  if (budget.sample && !prev.budget.sample)
    return libraryAction({ type: "example" });
  if (!activeBudget(prev.library))
    return libraryAction({
      type: "book",
      name: budget.name || "My book",
      project: budget,
    });
  return libraryAction({ type: "update", project: budget });
}

function removeExample() {
  libraryAction({ type: "remove-example" });
  return getSnapshot().budget;
}

export function useBook() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => serverSnapshot,
  );
  return {
    ...snapshot,
    setBudget,
    removeExample,
    libraryAction,
    restoreBooks: (markdown: string) => {
      const prev = getSnapshot();
      return saveLibrary(restoreLibrary(prev.library, markdown), prev.blocked);
    },
  };
}
