import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { usePeriod } from '../context/PeriodContext';
import { getDashboard } from '../api';
import type { DashboardData } from '../types';

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function BudgetBar({ name, budgeted, spent, color }: { name: string; budgeted: number; spent: number; color: string }) {
  const pct = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : spent > 0 ? 100 : 0;
  const over = spent > budgeted && budgeted > 0;
  return (
    <div className="py-2">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700 dark:text-gray-200">{name}</span>
        <span className={over ? 'text-red-600 font-semibold' : 'text-gray-500 dark:text-gray-400'}>
          {money(spent)} / {money(budgeted)}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: over ? '#dc2626' : color }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { year, month } = usePeriod();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDashboard(year, month)
      .then(setData)
      .finally(() => setLoading(false));
  }, [year, month]);

  if (loading || !data) {
    return <div className="p-6 text-center text-gray-500">Loading…</div>;
  }

  const pieData = data.category_breakdown
    .filter((c) => c.spent > 0)
    .map((c) => ({ name: c.name, value: c.spent, color: c.color }));

  const necessary = data.category_breakdown.filter((c) => c.type === 'necessary');
  const discretionary = data.category_breakdown.filter((c) => c.type === 'discretionary');
  const savings = data.category_breakdown.filter((c) => c.type === 'savings');

  const netLeft = data.available_to_spend - data.discretionary_spent;

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Income" value={money(data.income)} />
        <SummaryCard label="Spent" value={money(data.total_spent)} accent={data.total_spent > data.total_budgeted ? 'red' : undefined} />
        <SummaryCard label="Savings Goal" value={money(data.savings_goal_amount)} />
        <SummaryCard label="Left to Spend" value={money(netLeft)} accent={netLeft < 0 ? 'red' : 'green'} />
      </div>

      {data.days_left_in_month !== null && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 text-sm px-4 py-2.5">
          {money(Math.max(netLeft, 0))} left to spend with {data.days_left_in_month} day
          {data.days_left_in_month === 1 ? '' : 's'} left in the month.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Category breakdown chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Spending by Category</h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-gray-500 py-10 text-center">No expenses logged yet this month.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top transactions */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Biggest Purchases This Month</h2>
          {data.top_transactions.length === 0 ? (
            <p className="text-sm text-gray-500 py-10 text-center">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.top_transactions.map((t) => (
                <li key={t.id} className="py-2 flex justify-between text-sm">
                  <div>
                    <div className="font-medium text-gray-700 dark:text-gray-200">{t.store || t.category_name || 'Uncategorized'}</div>
                    <div className="text-gray-400 text-xs">{t.category_name} · {t.date}</div>
                  </div>
                  <div className="font-semibold text-gray-800 dark:text-gray-100">{money(t.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Budget vs actual per category */}
      <div className="grid md:grid-cols-3 gap-6">
        <BudgetSection title="Necessary Expenses" items={necessary} />
        <BudgetSection title="Discretionary Spending" items={discretionary} />
        <BudgetSection title="Savings" items={savings} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: 'red' | 'green' }) {
  const color =
    accent === 'red'
      ? 'text-red-600 dark:text-red-400'
      : accent === 'green'
      ? 'text-green-600 dark:text-green-400'
      : 'text-gray-800 dark:text-gray-100';
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function BudgetSection({ title, items }: { title: string; items: DashboardData['category_breakdown'] }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No categories yet.</p>
      ) : (
        items.map((c) => <BudgetBar key={c.id} name={c.name} budgeted={c.budgeted} spent={c.spent} color={c.color} />)
      )}
    </div>
  );
}
