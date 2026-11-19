import type { Budget, BoardLayout, BoardModule, BoardSize } from "./model.mjs";
export type BoardAction = { type: "move"; id: BoardModule; before: BoardModule | null } |
  { type: "size"; id: BoardModule; size: BoardSize } |
  { type: "expand"; id: string } | { type: "node"; id: string; before: string } | { type: "reset" };
export function boardLayout(budget: Budget): BoardLayout;
export function orderedNodes<T extends { id: string }>(rows: T[], layout: BoardLayout): T[];
export function changeBoard(budget: Budget, action: BoardAction): Budget;
export function noteConnections(budget: Budget): {
  resolved: { id: string; label: string; categoryId: string }[];
  unresolved: string[];
  tags: string[];
};
