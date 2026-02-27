"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";

type Category = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

type CategoryManagerProps = {
  initialCategories: Category[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  initialQuery: string;
  initialSort: CategorySort;
};

type DraftMap = Record<string, { name: string; sortOrder: number; isActive: boolean }>;
type CategorySort = "order_name" | "name_asc" | "name_desc" | "order_asc" | "order_desc" | "created_desc" | "created_asc";

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

export function CategoryManager({
  initialCategories,
  currentPage,
  pageSize,
  totalItems,
  initialQuery,
  initialSort
}: CategoryManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState(initialCategories);
  const [drafts, setDrafts] = useState<DraftMap>(() => buildDrafts(initialCategories));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [sortInput, setSortInput] = useState<CategorySort>(initialSort);

  const activeCount = useMemo(() => categories.filter((item) => item.isActive).length, [categories]);

  useEffect(() => {
    setCategories(initialCategories);
    setDrafts(buildDrafts(initialCategories));
  }, [initialCategories]);

  useEffect(() => {
    setQueryInput(initialQuery);
    setSortInput(initialSort);
  }, [initialQuery, initialSort]);

  function goPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    const safePage = Math.max(1, Math.trunc(nextPage));
    if (safePage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(safePage));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    const q = queryInput.trim();
    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }
    if (sortInput === "order_name") {
      params.delete("sort");
    } else {
      params.set("sort", sortInput);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function resetFilters() {
    setQueryInput("");
    setSortInput("order_name");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("sort");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

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
      setCreateModalOpen(false);
      goPage(1);
      router.refresh();
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
      router.refresh();
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot delete category");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-xl font-semibold">รายการหมวดหมู่</h2>
            <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
              ใช้งานอยู่ {activeCount}/{categories.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              setCreateModalOpen(true);
            }}
          >
            เพิ่มหมวดหมู่
          </button>
        </div>
        <form
          className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="ค้นหาชื่อหมวดหมู่" />
          <select value={sortInput} onChange={(event) => setSortInput(event.target.value as CategorySort)}>
            <option value="order_name">ลำดับ + ชื่อ (ค่าเริ่มต้น)</option>
            <option value="name_asc">ชื่อ A-Z</option>
            <option value="name_desc">ชื่อ Z-A</option>
            <option value="order_asc">ลำดับน้อยไปมาก</option>
            <option value="order_desc">ลำดับมากไปน้อย</option>
            <option value="created_desc">สร้างล่าสุดก่อน</option>
            <option value="created_asc">สร้างเก่าสุดก่อน</option>
          </select>
          <button type="submit">ค้นหา</button>
          <button type="button" className="secondary" onClick={resetFilters}>
            ล้างตัวกรอง
          </button>
        </form>

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
        <PaginationControls
          page={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={goPage}
        />
        {error ? <p className="mb-0 mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      {createModalOpen ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCreateModalOpen(false);
          }}
        >
          <div className="modal-panel" style={{ width: "min(460px, 100%)" }}>
            <div className="modal-header">
              <div>
                <h3 className="m-0 text-lg font-semibold">เพิ่มหมวดหมู่</h3>
                <p className="m-0 mt-1 text-sm text-[var(--muted)]">สร้างหมวดใหม่สำหรับหน้าเพิ่มสินค้าและ POS</p>
              </div>
              <button type="button" className="secondary" onClick={() => setCreateModalOpen(false)}>
                ปิด
              </button>
            </div>

            <form onSubmit={createCategory} className="space-y-3">
              <div className="field mb-0">
                <label htmlFor="categoryName">ชื่อหมวดหมู่ *</label>
                <input id="categoryName" name="name" required />
              </div>
              <div className="field mb-0">
                <label htmlFor="categoryOrder">ลำดับแสดงผล</label>
                <input id="categoryOrder" name="sortOrder" type="number" step={1} defaultValue={0} />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" className="secondary" onClick={() => setCreateModalOpen(false)}>
                  ยกเลิก
                </button>
                <button type="submit" disabled={creating}>
                  {creating ? "กำลังบันทึก..." : "เพิ่มหมวดหมู่"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
