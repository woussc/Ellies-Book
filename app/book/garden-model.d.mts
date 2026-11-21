import type {Budget, Category, Expense} from './model.mjs';
export function gardenView(budget: Budget, categoryId?: string | null, page?: number): {
  categories: Category[]; category: Category | null; entries: Expense[]; count: number; offset: number;
  summary: ReturnType<typeof import('./model.mjs').totals> & {planned: number};
};
export function resizeGarden(budget: Budget, id: string, size: 'medium' | 'large'): Budget;
