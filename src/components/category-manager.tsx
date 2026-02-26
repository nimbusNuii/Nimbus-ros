"use client";

import { FormEvent, useMemo, useState } from "react";

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

type CategoryManagerProps = {
  initialCategories: Category[];
};

type DraftMap = Record<string, { name: string; sortOrder: number; isActive: boolean }>;

function buildDrafts(categories: Category[]): DraftMap {
  return categories.reduce<DraftMap>((map, item) => {
    map[item.id] = {
      name: item.name,
      sortOrder: item.sortOrder,
      isActive: item.isActive
    };
    return map;
  }, {});
}

export function CategoryManager({ initialCategories }: CategoryManagerProps) {
  const [categories, setCategories] = useState(initialCategories);
  const [drafts, setDrafts] = useState<DraftMap>(() => buildDrafts(initialCategories));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const activeCount = useMemo(() => categories.filter((item) => item.isActive).length, [categories]);

  function setDraftValue(categoryId: string, key: keyof DraftMap[string], value: string | number | boolean) {
    setDrafts((prev) => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [key]: value
      }
    }));
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/product-categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || "").trim(),
          sortOrder: Number(form.get("sortOrder") || 0)
        })
      });

      const data = (await response.json()) as Category | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot create category");
      }

      const created = data as Category;
      const createdWithCount: Category = {
        ...created,
        productCount: 0
      };

      setCategories((prev) => [...prev, createdWithCount].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "th")));
      setDrafts((prev) => ({
        ...prev,
        [created.id]: {
          name: created.name,
          sortOrder: created.sortOrder,
          isActive: created.isActive
        }
      }));
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create category");
    } finally {
      setCreating(false);
    }
  }

  async function saveCategory(categoryId: string) {
    const draft = drafts[categoryId];
    if (!draft) return;

    setSavingId(categoryId);
    setError("");

    try {
      const response = await fetch(`/api/product-categories/${categoryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          sortOrder: Math.trunc(Number(draft.sortOrder) || 0),
          isActive: draft.isActive
        })
      });

      const data = (await response.json()) as Category | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot update category");
      }

      const updated = data as Category;
      setCategories((prev) =>
        prev
          .map((item) =>
            item.id === categoryId
              ? {
                  ...item,
                  name: updated.name,
                  sortOrder: updated.sortOrder,
                  isActive: updated.isActive
                }
              : item
          )
          .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "th"))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot update category");
    } finally {
      setSavingId(null);
    }
  }

  async function removeCategory(categoryId: string) {
    if (!window.confirm("ลบหมวดหมู่นี้หรือไม่?")) return;

    setSavingId(categoryId);
    setError("");

    try {
      const response = await fetch(`/api/product-categories/${categoryId}`, {
        method: "DELETE"
      });

      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Cannot delete category");
      }

      setCategories((prev) => prev.filter((item) => item.id !== categoryId));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot delete category");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">เพิ่มหมวดหมู่</h2>
        <form onSubmit={createCategory} className="space-y-3">
          <div className="field">
            <label htmlFor="categoryName">ชื่อหมวดหมู่ *</label>
            <input id="categoryName" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="categoryOrder">ลำดับแสดงผล</label>
            <input id="categoryOrder" name="sortOrder" type="number" step={1} defaultValue={0} />
          </div>

          <button type="submit" disabled={creating}>
            {creating ? "กำลังบันทึก..." : "เพิ่มหมวดหมู่"}
          </button>
        </form>
        {error ? <p className="mb-0 mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 text-xl font-semibold">รายการหมวดหมู่</h2>
          <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
            ใช้งานอยู่ {activeCount}/{categories.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table min-w-[680px]">
            <thead>
              <tr>
                <th>ชื่อหมวดหมู่</th>
                <th>ลำดับ</th>
                <th>จำนวนสินค้า</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((item) => {
                const draft = drafts[item.id];
                return (
                  <tr key={item.id}>
                    <td>
                      <input
                        value={draft?.name || ""}
                        onChange={(event) => setDraftValue(item.id, "name", event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step={1}
                        value={draft?.sortOrder ?? 0}
                        onChange={(event) => setDraftValue(item.id, "sortOrder", Math.trunc(Number(event.target.value) || 0))}
                        className="w-24"
                      />
                    </td>
                    <td>{item.productCount}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setDraftValue(item.id, "isActive", !draft?.isActive)}
                      >
                        {draft?.isActive ? "ใช้งาน" : "ปิด"}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void saveCategory(item.id)} disabled={savingId === item.id}>
                          {savingId === item.id ? "..." : "บันทึก"}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          disabled={savingId === item.id || item.productCount > 0}
                          onClick={() => void removeCategory(item.id)}
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-[var(--muted)]">
                    ยังไม่มีหมวดหมู่
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
