import { useEffect, useState } from 'react';
import { usePeriod } from '../../context/PeriodContext';
import { getBudgets, saveBudgets, getSettings } from '../../api';
import type { Category } from '../../types';

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function BudgetsTab() {
  const { year, month } = usePeriod();
  const [categories, setCategories] = useState<Category[]>([]);
  const [inherited, setInherited] = useState(false);
  const [income, setIncome] = useState(0);
  const [goalAmount, setGoalAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function reload() {
    getBudgets(year, month).then((b) => {
      setCategories(b.categories);
      setInherited(b.is_inherited);
    });
    getSettings(year, month).then((s) => {
      const total = s.income_sources.reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
      setIncome(total);
      const goal = s.savings_goal_type === 'percent' ? (total * s.savings_goal_value) / 100 : s.savings_goal_value;
      setGoalAmount(goal);
    });
  }

  useEffect(reload, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateAmount(id: number, value: string) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, budgeted_amount: Number(value) || 0 } : c)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveBudgets(
        year,
        month,
        categories.map((c) => ({ category_id: c.id, amount: c.budgeted_amount || 0 }))
      );
      setInherited(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  const necessary = categories.filter((c) => c.type === 'necessary');
  const discretionary = categories.filter((c) => c.type === 'discretionary');
  const savings = categories.filter((c) => c.type === 'savings');

  const necessaryTotal = necessary.reduce((s, c) => s + (c.budgeted_amount || 0), 0);
  const discretionaryTotal = discretionary.reduce((s, c) => s + (c.budgeted_amount || 0), 0);
  const availableToSpend = income - necessaryTotal - goalAmount;
  const remaining = availableToSpend - discretionaryTotal;

  return (
    <div className="space-y-6">
      {inherited && (
        <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 rounded-md px-3 py-2">
          Showing budgets carried over from a prior month. Save to lock these in for this month.
        </p>
      )}

      <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm space-y-1">
        <div className="flex justify-between"><span className="text-gray-500">Income</span><span>{money(income)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">− Necessary expenses</span><span>{money(necessaryTotal)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">− Savings goal</span><span>{money(goalAmount)}</span></div>
        <div className="flex justify-between font-semibold border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
          <span>Available to spend (discretionary)</span><span>{money(availableToSpend)}</span>
        </div>
        <div className={`flex justify-between font-medium ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
          <span>Unallocated</span><span>{money(remaining)}</span>
        </div>
      </div>

      <CategoryGroup title="Necessary / Fixed Expenses" categories={necessary} onChange={updateAmount} />
      <CategoryGroup title="Discretionary Categories" categories={discretionary} onChange={updateAmount} />
      <CategoryGroup title="Savings" categories={savings} onChange={updateAmount} />

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-sm"
      >
        {saving ? 'Saving…' : 'Save Budgets'}
      </button>
      {saved && <span className="ml-3 text-sm text-green-600">Saved!</span>}
    </div>
  );
}

function CategoryGroup({
  title,
  categories,
  onChange,
}: {
  title: string;
  categories: Category[];
  onChange: (id: number, value: string) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div>
      <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{title}</h3>
      <div className="space-y-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">{c.name}</span>
            <div className="relative w-28">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={c.budgeted_amount || ''}
                onChange={(e) => onChange(c.id, e.target.value)}
                placeholder="0"
                className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
