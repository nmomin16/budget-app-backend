import { useEffect, useState } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../api';
import type { Category, CategoryType } from '../../types';

const TYPE_LABELS: Record<CategoryType, string> = {
  necessary: 'Necessary',
  discretionary: 'Discretionary',
  savings: 'Savings',
};

export default function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CategoryType>('discretionary');

  function reload() {
    getCategories().then(setCategories);
  }
  useEffect(reload, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    await createCategory({ name: newName.trim(), type: newType });
    setNewName('');
    reload();
  }

  async function handleRename(c: Category, name: string) {
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, name } : x)));
  }

  async function handleBlurSave(c: Category) {
    await updateCategory(c.id, { name: c.name, type: c.type });
  }

  async function handleTypeChange(c: Category, type: CategoryType) {
    await updateCategory(c.id, { type });
    reload();
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this category? Past transactions will keep their history.')) return;
    await deleteCategory(id);
    reload();
  }

  const grouped: Record<CategoryType, Category[]> = {
    necessary: categories.filter((c) => c.type === 'necessary'),
    discretionary: categories.filter((c) => c.type === 'discretionary'),
    savings: categories.filter((c) => c.type === 'savings'),
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as CategoryType)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        >
          <option value="necessary">Necessary</option>
          <option value="discretionary">Discretionary</option>
          <option value="savings">Savings</option>
        </select>
        <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
          Add
        </button>
      </div>

      {(Object.keys(grouped) as CategoryType[]).map((type) => (
        <div key={type}>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">{TYPE_LABELS[type]}</h3>
          {grouped[type].length === 0 ? (
            <p className="text-sm text-gray-400">None yet.</p>
          ) : (
            <div className="space-y-2">
              {grouped[type].map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => handleRename(c, e.target.value)}
                    onBlur={() => handleBlurSave(c)}
                    className="flex-1 px-2 py-1.5 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-700 bg-transparent text-sm"
                  />
                  <select
                    value={c.type}
                    onChange={(e) => handleTypeChange(c, e.target.value as CategoryType)}
                    className="text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-1"
                  >
                    <option value="necessary">Necessary</option>
                    <option value="discretionary">Discretionary</option>
                    <option value="savings">Savings</option>
                  </select>
                  <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500 px-1">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
