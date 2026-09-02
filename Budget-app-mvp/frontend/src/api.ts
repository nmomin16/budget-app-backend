import axios from 'axios';
import type {
  Category,
  Store,
  MonthlySettings,
  Transaction,
  DashboardData,
} from './types';

const api = axios.create({ baseURL: '/api' });

export const getCategories = () => api.get<Category[]>('/categories').then((r) => r.data);
export const createCategory = (data: Partial<Category>) =>
  api.post<Category>('/categories', data).then((r) => r.data);
export const updateCategory = (id: number, data: Partial<Category>) =>
  api.put<Category>(`/categories/${id}`, data).then((r) => r.data);
export const deleteCategory = (id: number) => api.delete(`/categories/${id}`);

export const getStores = () => api.get<Store[]>('/stores').then((r) => r.data);
export const createStore = (data: Partial<Store>) =>
  api.post<Store>('/stores', data).then((r) => r.data);
export const updateStore = (id: number, data: Partial<Store>) =>
  api.put<Store>(`/stores/${id}`, data).then((r) => r.data);
export const deleteStore = (id: number) => api.delete(`/stores/${id}`);

export const getSettings = (year: number, month: number) =>
  api.get<MonthlySettings>(`/settings/${year}/${month}`).then((r) => r.data);
export const saveSettings = (
  year: number,
  month: number,
  data: Pick<MonthlySettings, 'income_sources' | 'savings_goal_type' | 'savings_goal_value'>
) => api.post(`/settings/${year}/${month}`, data);

export const getBudgets = (year: number, month: number) =>
  api
    .get<{ categories: Category[]; is_inherited: boolean }>(`/budgets/${year}/${month}`)
    .then((r) => r.data);
export const saveBudgets = (
  year: number,
  month: number,
  budgets: { category_id: number; amount: number }[]
) => api.post(`/budgets/${year}/${month}`, { budgets });

export const getTransactions = (year?: number, month?: number) =>
  api
    .get<Transaction[]>('/transactions', { params: { year, month } })
    .then((r) => r.data);
export const createTransaction = (data: Partial<Transaction>) =>
  api.post<Transaction>('/transactions', data).then((r) => r.data);
export const updateTransaction = (id: number, data: Partial<Transaction>) =>
  api.put<Transaction>(`/transactions/${id}`, data).then((r) => r.data);
export const deleteTransaction = (id: number) => api.delete(`/transactions/${id}`);

export const getDashboard = (year: number, month: number) =>
  api.get<DashboardData>(`/dashboard/${year}/${month}`).then((r) => r.data);

export const getYears = () => api.get<number[]>('/years').then((r) => r.data);

export default api;
