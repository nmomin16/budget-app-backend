import { useState } from 'react';
import IncomeTab from '../components/setup/IncomeTab';
import BudgetsTab from '../components/setup/BudgetsTab';
import CategoriesTab from '../components/setup/CategoriesTab';
import StoresTab from '../components/setup/StoresTab';

const TABS = [
  { key: 'income', label: 'Income & Goal' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'categories', label: 'Categories' },
  { key: 'stores', label: 'Stores' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function Setup() {
  const [tab, setTab] = useState<TabKey>('income');

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Setup</h1>

      <div className="flex gap-1 mb-4 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              tab === t.key
                ? 'border-green-600 text-green-600 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        {tab === 'income' && <IncomeTab />}
        {tab === 'budgets' && <BudgetsTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'stores' && <StoresTab />}
      </div>
    </div>
  );
}
