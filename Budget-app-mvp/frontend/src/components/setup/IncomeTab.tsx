import { useEffect, useState } from 'react';
import { usePeriod } from '../../context/PeriodContext';
import { getSettings, saveSettings } from '../../api';
import type { IncomeSource } from '../../types';

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function IncomeTab() {
  const { year, month } = usePeriod();
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [goalType, setGoalType] = useState<'fixed' | 'percent'>('fixed');
  const [goalValue, setGoalValue] = useState(0);
  const [inherited, setInherited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings(year, month).then((s) => {
      setSources(s.income_sources.length ? s.income_sources : [{ name: 'Paycheck', amount: 0 }]);
      setGoalType(s.savings_goal_type);
      setGoalValue(s.savings_goal_value);
      setInherited(s.is_inherited);
    });
  }, [year, month]);

  const totalIncome = sources.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const goalAmount = goalType === 'percent' ? (totalIncome * goalValue) / 100 : goalValue;

  function updateSource(i: number, field: keyof IncomeSource, value: string) {
    setSources((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: field === 'amount' ? Number(value) || 0 : value } : s))
    );
  }

  function addSource() {
    setSources((prev) => [...prev, { name: '', amount: 0 }]);
  }

  function removeSource(i: number) {
    setSources((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveSettings(year, month, {
        income_sources: sources.filter((s) => s.name.trim()),
        savings_goal_type: goalType,
        savings_goal_value: goalValue,
      });
      setInherited(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {inherited && (
        <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 rounded-md px-3 py-2">
          Showing values carried over from a prior month. Save to lock these in for this month.
        </p>
      )}

      <div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Income Sources</h3>
        <div className="space-y-2">
          {sources.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={s.name}
                onChange={(e) => updateSource(i, 'name', e.target.value)}
                placeholder="Source name (e.g. Paycheck)"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              />
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  value={s.amount || ''}
                  onChange={(e) => updateSource(i, 'amount', e.target.value)}
                  placeholder="0"
                  className="w-full pl-6 pr-2 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
              <button onClick={() => removeSource(i)} className="text-gray-400 hover:text-red-500 px-1">×</button>
            </div>
          ))}
        </div>
        <button onClick={addSource} className="mt-2 text-sm text-green-600 hover:underline">
          + Add income source
        </button>
        <div className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
          Total monthly income: {money(totalIncome)}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Savings Goal</h3>
        <div className="flex gap-2 items-center">
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as 'fixed' | 'percent')}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="fixed">Fixed $</option>
            <option value="percent">% of income</option>
          </select>
          <div className="relative w-32">
            {goalType === 'fixed' && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            )}
            <input
              type="number"
              value={goalValue || ''}
              onChange={(e) => setGoalValue(Number(e.target.value) || 0)}
              className={`w-full ${goalType === 'fixed' ? 'pl-6' : 'pl-2'} pr-2 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm`}
            />
            {goalType === 'percent' && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Monthly savings target: <span className="font-medium text-gray-700 dark:text-gray-200">{money(goalAmount)}</span>
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-sm"
      >
        {saving ? 'Saving…' : 'Save Income & Goal'}
      </button>
      {saved && <span className="ml-3 text-sm text-green-600">Saved!</span>}
    </div>
  );
}
