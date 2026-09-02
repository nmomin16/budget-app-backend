import { useEffect, useState } from 'react';
import { getStores, getCategories, createStore, updateStore, deleteStore } from '../../api';
import type { Store, Category } from '../../types';

export default function StoresTab() {
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');

  function reload() {
    getStores().then(setStores);
  }
  useEffect(() => {
    reload();
    getCategories().then(setCategories);
  }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    await createStore({ name: newName.trim() });
    setNewName('');
    reload();
  }

  async function handleDefaultCategory(s: Store, categoryId: string) {
    await updateStore(s.id, { default_category_id: categoryId ? Number(categoryId) : null });
    reload();
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this store from your dropdown?')) return;
    await deleteStore(id);
    reload();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Manage the stores that show up in the quick-add dropdown. Optionally set a default category
        so picking a store auto-fills a category.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New store name"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        />
        <button onClick={handleAdd} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
          Add
        </button>
      </div>

      <div className="space-y-2">
        {stores.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-200">
              {s.name} {s.is_preset ? <span className="text-xs text-gray-400">(preset)</span> : null}
            </span>
            <select
              value={s.default_category_id ?? ''}
              onChange={(e) => handleDefaultCategory(s, e.target.value)}
              className="text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1 py-1"
            >
              <option value="">No default category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button onClick={() => handleDelete(s.id)} className="text-gray-400 hover:text-red-500 px-1">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
