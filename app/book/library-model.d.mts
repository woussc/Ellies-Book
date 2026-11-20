import type { Budget } from "./model.mjs";
export type LocalBook = { id: string; name: string; projects: Budget[] };
export type Library = {
  books: LocalBook[];
  activeProjectId: string;
  profile: { name: string };
  example?: Budget;
};
export type LibraryAction =
  | { type: "book"; name: string; project: Budget }
  | { type: "project"; bookId: string; project: Budget }
  | { type: "update"; project: Budget }
  | { type: "select"; id: string }
  | { type: "profile"; name: string }
  | { type: "example" | "remove-example" };
export const LIBRARY_KEY: string;
export function emptyLibrary(): Library;
export function activeBudget(library: Library): Budget | null;
export function serializeLibrary(library: Library): string;
export function parseLibrary(markdown: string): Library;
export function readLibrary(storage: Storage): Library;
export function changeLibrary(library: Library, action: LibraryAction): Library;
export function restoreLibrary(library: Library, markdown: string): Library;
export function initialProject(): Budget;
