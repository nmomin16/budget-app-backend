export type CategoryType = 'necessary' | 'discretionary' | 'savings';

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  color: string;
  sort_order: number;
  archived: number;
  budgeted_amount?: number;
}

export interface Store {
  id: number;
  name: string;
  default_category_id: number | null;
  is_preset: number;
  sort_order: number;
  archived: number;
}

export interface IncomeSource {
  name: string;
  amount: number;
}

export interface MonthlySettings {
  year: number;
  month: number;
  income_sources: IncomeSource[];
  savings_goal_type: 'fixed' | 'percent';
  savings_goal_value: number;
  is_inherited: boolean;
}

export interface Transaction {
  id: number;
  date: string;
  year: number;
  month: number;
  amount: number;
  category_id: number | null;
  category_name?: string;
  category_color?: string;
  category_type?: CategoryType;
  store: string | null;
  note: string | null;
  payment_method: 'cash' | 'debit' | 'credit';
  source: 'manual' | 'statement_import';
  created_at: string;
}

export interface CategoryBreakdown {
  id: number;
  name: string;
  type: CategoryType;
  color: string;
  budgeted: number;
  spent: number;
}

export interface DashboardData {
  year: number;
  month: number;
  income: number;
  savings_goal_amount: number;
  savings_actual: number;
  necessary_total: number;
  discretionary_budgeted: number;
  discretionary_spent: number;
  available_to_spend: number;
  total_budgeted: number;
  total_spent: number;
  category_breakdown: CategoryBreakdown[];
  top_transactions: Transaction[];
  days_left_in_month: number | null;
}
