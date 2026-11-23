export type Profile = "Household" | "Just me" | "Team";
export type Category = {
  id: string;
  name: string;
  amount: number;
  owner: string;
  glCode: string;
};
export type Expense = {
  receiptIds?: string[];
  payee?: string;
  repeatId?: string;
  occurrenceDate?: string;
  id: string;
  categoryId: string;
  description: string;
  amount: number;
  status: "planned" | "committed" | "paid";
  date: string;
  history: string[];
  notes?: string;
};
export type Budget = {
  receiptData?: import('./receipt-model.mjs').ReceiptData;
  autoSortRules?:import('./auto-sort-model.mjs').PayeeRule[];
  statementImports?:import('./statement-model.mjs').StatementData;
  budgetOrigins?: import('./carryover-model.mjs').BudgetOrigin[];
  periodId?: string;
  periodConfirmed?: boolean;
  budgetSet?: boolean;
  periods?: import('./repeat-model.mjs').BudgetPeriod[];
  repeatRules?: import('./repeat-model.mjs').RepeatRule[];
  board?: BoardLayout;
  id: string;
  name: string;
  profile: Profile;
  total: number;
  period: string;
  startDate?: string;
  endDate?: string;
  created: boolean;
  sample: boolean;
  categories: Category[];
  expenses: Expense[];
  notes: string;
  events: { text: string; at: string; before?: unknown; after?: unknown }[];
};
export type BoardModule = "budget" | "committed" | "paid" | "notes";
export type BoardSize = "compact" | "regular" | "wide";
export type NodeSize = "small" | "medium" | "large";
export type CanvasLayout = {
  positions: Record<string, { x: number; y: number }>;
  sizes: Record<string, NodeSize>;
  viewport: { x: number; y: number; zoom: number };
  dimensions?: Record<string, { width: number; height: number }>;
  scenes?: Partial<Record<"overview" | "budget" | "committed" | "paid" | "notes", {
    positions: Record<string, { x: number; y: number }>;
    viewport: { x: number; y: number; zoom: number };
  }>>;
};
export type BoardLayout = {
  canvas?: CanvasLayout;
  order: BoardModule[];
  sizes: Partial<Record<BoardModule, BoardSize>>;
  expanded: string[];
  nodeOrder: string[];
};
export const STORAGE_KEY: string;
export const SAMPLE_STORAGE_KEY: string;
export function serializeBook(budget: Budget): string;
export function parseBook(markdown: string): Budget;
export function validateBudget(budget: unknown): Budget;
export function legacyBackup(storage: Storage): string;
export function localDate(date?: Date): string;
export function displayDate(date: string): string;
export function readStoredBudget(storage: Storage, example?: boolean): Budget;
export function persistBudget(storage: Storage, budget: Budget): void;
export const profiles: Record<Profile, string[]>;
export function round(value: string | number): number;
export function money(value: number): string;
export function blankBudget(profile?: Profile, initial?: {id?: string; period?: string}): Budget;
export function exampleBudget(): Budget;
export function advanceExpense(budget: Budget, id: string): Budget;
export function editExpense(
  budget: Budget,
  id: string,
  patch: Partial<Pick<Expense, "description" | "payee" | "amount" | "categoryId" | "status" | "date" | "notes">>,
): Budget;
export function removeExpense(budget: Budget, id: string): Budget;
export function editBudgetDetails(
  budget: Budget,
  details: Pick<Budget, "name" | "total" | "profile" | "period" | "startDate" | "endDate">,
): Budget;
export function editCategory(
  budget: Budget,
  id: string,
  patch: Partial<Category>,
): Budget;
export function totals(
  budget: Budget,
  categoryId?: string,
): {
  plan: number;
  spent: number;
  committed: number;
  left: number;
  forecast: number;
};
export function reportText(budget: Budget): string;
export function csvText(budget: Budget): string;
export function lifecycle(expenses: Expense[]): {
  lifecycleLines: { id: string; amount: number; stage: string }[];
  transitions: {
    fromLineId: string;
    toLineId: string;
    convertedAmount: number;
  }[];
};
