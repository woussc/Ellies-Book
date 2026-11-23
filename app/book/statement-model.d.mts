import type { Budget, Expense } from "./model.mjs";
import type { Library } from "./library-model.mjs";
export type StatementAccount = { id: string; label: string };
export type StatementRow = {
  payee?:string;
  payeeSource?:'bank'|'mapped'|'manual';
  categorySource?:'manual'|'rule';
  suggestedBy?:string;
  originalDescription?: string;
  id: string;
  sourceId: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  direction: "out" | "in" | "transfer" | "unknown";
  checked: boolean;
  categoryId: string;
  decision: "new" | "match" | "link" | "skip";
  separate?: boolean;
  matchId?: string;
  matchProjectId?: string;
  matchPeriod?: string;
  bankId?: string;
  raw?: string;
  sourceIndex?: number;
  page?: number;
};
export type StatementItem = {
  bankDescription?: string;
  entryId: string;
  projectId: string;
  period: string;
  sourceId: string;
  bankId?: string;
  key: string;
  kind: "new" | "match" | "link";
  before: Expense | null;
  after: Expense;
};
export type StatementBatch = {
  dependsOn?: string[];
  id: string;
  accountId: string;
  period: string;
  at: string;
  items: StatementItem[];
  excluded: number;
  undone: boolean;
};
export type StatementData = {
  accounts: StatementAccount[];
  batches: StatementBatch[];
};
export type StatementRequest = {
  id: string;
  projectId: string;
  period: string;
  account: StatementAccount;
  rows: StatementRow[];
};
export type StatementCandidate = Expense & {
  projectId: string;
  period: string;
  exactAmount: boolean;
};
export type StatementReview = {
  id: string;
  state: "ready" | "needs" | "already" | "left";
  reason: string;
  candidates: StatementCandidate[];
};
export function reviewStatement(
  library: Library,
  request: StatementRequest,
): StatementReview[];
export function applyStatement(
  library: Library,
  request: StatementRequest,
): Library;
export function undoStatement(
  library: Library,
  projectId: string,
  batchId: string,
): Library;
export function statementAccounts(
  library: Library,
  projectId: string,
): StatementAccount[];
export function validateStatementData(budget: Budget): void;
