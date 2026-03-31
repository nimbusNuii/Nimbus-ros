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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>
            หมวดหมู่
          </h1>
          <span style={{
            display: "inline-flex", alignItems: "center",
            height: 22, padding: "0 9px", borderRadius: 99,
            border: "1px solid var(--line)", background: "var(--bg)",
            fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)",
          }}>
            {totalItems} หมวด · ใช้งาน {activeCount}
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setError(""); setCreateModalOpen(true); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: 38, padding: "0 16px", borderRadius: 10,
            background: "var(--brand)", border: "none",
            fontSize: "0.82rem", fontWeight: 600, color: "#fff",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          เพิ่มหมวดหมู่
        </button>
      </div>

      {/* ── Filter bar ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); applyFilters(); }}
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
      >
        <input
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="ค้นหาชื่อหมวดหมู่..."
          style={{
            flex: "1 1 180px", minWidth: 0, height: 38,
            padding: "0 12px", borderRadius: 9,
            border: "1px solid var(--line)", background: "#fff",
            fontSize: "0.82rem", color: "var(--text)", outline: "none",
          }}
        />
        <select
          value={sortInput}
          onChange={(e) => setSortInput(e.target.value as CategorySort)}
          style={{
            flex: "0 0 auto", height: 38, padding: "0 10px",
            borderRadius: 9, border: "1px solid var(--line)",
            background: "#fff", fontSize: "0.82rem",
            color: "var(--text)", cursor: "pointer",
          }}
        >
          <option value="order_name">ลำดับ + ชื่อ</option>
          <option value="name_asc">ชื่อ A–Z</option>
          <option value="name_desc">ชื่อ Z–A</option>
          <option value="order_asc">ลำดับ น้อย → มาก</option>
          <option value="order_desc">ลำดับ มาก → น้อย</option>
          <option value="created_desc">สร้างล่าสุดก่อน</option>
          <option value="created_asc">สร้างเก่าสุดก่อน</option>
        </select>
        <button
          type="submit"
          style={{
            height: 38, padding: "0 16px", borderRadius: 9,
            background: "var(--brand)", border: "none",
            fontSize: "0.82rem", fontWeight: 600, color: "#fff", cursor: "pointer",
          }}
        >
          ค้นหา
        </button>
        <button
          type="button"
          onClick={resetFilters}
          style={{
            height: 38, padding: "0 14px", borderRadius: 9,
            border: "1px solid var(--line)", background: "#fff",
            fontSize: "0.82rem", fontWeight: 500, color: "var(--muted)", cursor: "pointer",
          }}
        >
          ล้าง
        </button>
      </form>

      {/* ── Error ── */}
      {error && (
        <p style={{ margin: 0, padding: "10px 14px", borderRadius: 9, background: "#fff5f5", border: "1px solid #fca5a5", color: "#dc2626", fontSize: "0.82rem" }}>
          {error}
        </p>
      )}

      {/* ── Mobile list ── */}
      <div className="flex flex-col lg:hidden" style={{ gap: 8 }}>
        {categories.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
            ยังไม่มีหมวดหมู่
          </div>
        ) : categories.map((item) => {
          const draft = drafts[item.id];
          const isSaving = savingId === item.id;
          return (
            <div
              key={item.id}
              style={{
                borderRadius: 12, border: "1px solid var(--line)",
                background: "#fff", overflow: "hidden",
              }}
            >
              {/* Top zone */}
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Name row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: "color-mix(in srgb, var(--brand) 10%, transparent)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <input
                    value={draft?.name || ""}
                    onChange={(e) => setDraftValue(item.id, "name", e.target.value)}
                    placeholder="ชื่อหมวดหมู่"
                    style={{
                      flex: 1, minWidth: 0, height: 36,
                      padding: "0 10px", borderRadius: 8,
                      border: "1px solid var(--line)", background: "var(--bg)",
                      fontSize: "0.85rem", fontWeight: 600, color: "var(--text)",
                    }}
                  />
                </div>

                {/* Meta row: sort order + badges */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)", whiteSpace: "nowrap" }}>ลำดับ</span>
                    <input
                      type="number"
                      step={1}
                      value={draft?.sortOrder ?? 0}
                      onChange={(e) => setDraftValue(item.id, "sortOrder", Math.trunc(Number(e.target.value) || 0))}
                      style={{
                        width: 60, height: 30, padding: "0 8px",
                        borderRadius: 7, border: "1px solid var(--line)",
                        background: "var(--bg)", fontSize: "0.82rem",
                        color: "var(--text)", textAlign: "center",
                      }}
                    />
                  </div>
                  <span style={{
                    display: "inline-flex", alignItems: "center",
                    height: 24, padding: "0 8px", borderRadius: 99,
                    border: "1px solid var(--line)",
                    fontSize: "0.7rem", fontWeight: 500, color: "var(--muted)",
                  }}>
                    {item.productCount} สินค้า
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraftValue(item.id, "isActive", !draft?.isActive)}
                    style={{
                      display: "inline-flex", alignItems: "center",
                      height: 24, padding: "0 9px", borderRadius: 99,
                      border: `1px solid ${draft?.isActive ? "#86efac" : "var(--line)"}`,
                      background: draft?.isActive ? "#f0fdf4" : "var(--bg)",
                      fontSize: "0.7rem", fontWeight: 600,
                      color: draft?.isActive ? "#16a34a" : "var(--muted)",
                      cursor: "pointer", boxShadow: "none",
                    }}
                  >
                    {draft?.isActive ? "ใช้งาน" : "ปิด"}
                  </button>
                </div>
              </div>

              {/* Bottom action strip */}
              <div style={{
                padding: "9px 14px", background: "var(--bg)",
                borderTop: "1px solid var(--line)",
                display: "flex", gap: 8, alignItems: "center",
              }}>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void saveCategory(item.id)}
                  style={{
                    flex: 1, height: 34, padding: "0 12px", borderRadius: 8,
                    background: "var(--brand)", border: "none",
                    fontSize: "0.8rem", fontWeight: 600, color: "#fff",
                    cursor: isSaving ? "not-allowed" : "pointer", opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
                <button
                  type="button"
                  disabled={isSaving || item.productCount > 0}
                  onClick={() => void removeCategory(item.id)}
                  style={{
                    height: 34, padding: "0 12px", borderRadius: 8,
                    border: "1px solid #fca5a5", background: "#fff5f5",
                    fontSize: "0.8rem", fontWeight: 500, color: "#dc2626",
                    cursor: (isSaving || item.productCount > 0) ? "not-allowed" : "pointer",
                    opacity: (isSaving || item.productCount > 0) ? 0.45 : 1,
                  }}
                >
                  ลบ
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table ── */}
      <div
        className="hidden lg:block"
        style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", margin: 0, borderRadius: 0, border: "none" }}>
          <thead>
            <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
              {["ชื่อหมวดหมู่", "ลำดับ", "สินค้า", "สถานะ", "จัดการ"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 14px",
                    textAlign: i >= 3 ? "center" : "left",
                    fontSize: "0.72rem", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    color: "var(--muted)", whiteSpace: "nowrap",
                    border: "none",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "40px 14px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem", border: "none" }}>
                  ยังไม่มีหมวดหมู่
                </td>
              </tr>
            ) : categories.map((item, idx) => {
              const draft = drafts[item.id];
              const isSaving = savingId === item.id;
              return (
                <tr
                  key={item.id}
                  style={{
                    borderTop: idx === 0 ? "none" : "1px solid var(--line)",
                    background: "#fff",
                  }}
                >
                  {/* Name */}
                  <td style={{ padding: "10px 14px", border: "none" }}>
                    <input
                      value={draft?.name || ""}
                      onChange={(e) => setDraftValue(item.id, "name", e.target.value)}
                      style={{
                        width: "100%", minWidth: 160, height: 34,
                        padding: "0 10px", borderRadius: 7,
                        border: "1px solid var(--line)", background: "var(--bg)",
                        fontSize: "0.82rem", color: "var(--text)",
                      }}
                    />
                  </td>

                  {/* Sort order */}
                  <td style={{ padding: "10px 14px", border: "none" }}>
                    <input
                      type="number"
                      step={1}
                      value={draft?.sortOrder ?? 0}
                      onChange={(e) => setDraftValue(item.id, "sortOrder", Math.trunc(Number(e.target.value) || 0))}
                      style={{
                        width: 70, height: 34, padding: "0 8px",
                        borderRadius: 7, border: "1px solid var(--line)",
                        background: "var(--bg)", fontSize: "0.82rem",
                        color: "var(--text)", textAlign: "center",
                      }}
                    />
                  </td>

                  {/* Product count */}
                  <td style={{ padding: "10px 14px", textAlign: "center", border: "none" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      height: 22, padding: "0 8px", borderRadius: 99,
                      border: "1px solid var(--line)", background: "var(--bg)",
                      fontSize: "0.72rem", fontWeight: 500, color: "var(--muted)",
                    }}>
                      {item.productCount}
                    </span>
                  </td>

                  {/* Status toggle */}
                  <td style={{ padding: "10px 14px", textAlign: "center", border: "none" }}>
                    <button
                      type="button"
                      onClick={() => setDraftValue(item.id, "isActive", !draft?.isActive)}
                      style={{
                        display: "inline-flex", alignItems: "center",
                        height: 26, padding: "0 10px", borderRadius: 99,
                        border: `1px solid ${draft?.isActive ? "#86efac" : "var(--line)"}`,
                        background: draft?.isActive ? "#f0fdf4" : "var(--bg)",
                        fontSize: "0.72rem", fontWeight: 600,
                        color: draft?.isActive ? "#16a34a" : "var(--muted)",
                        cursor: "pointer", boxShadow: "none", whiteSpace: "nowrap",
                      }}
                    >
                      {draft?.isActive ? "ใช้งาน" : "ปิด"}
                    </button>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "10px 14px", border: "none" }}>
                    <div style={{ display: "flex", gap: 7, justifyContent: "center" }}>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void saveCategory(item.id)}
                        style={{
                          height: 32, padding: "0 14px", borderRadius: 8,
                          background: "var(--brand)", border: "none",
                          fontSize: "0.78rem", fontWeight: 600, color: "#fff",
                          cursor: isSaving ? "not-allowed" : "pointer",
                          opacity: isSaving ? 0.6 : 1, whiteSpace: "nowrap",
                        }}
                      >
                        {isSaving ? "..." : "บันทึก"}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving || item.productCount > 0}
                        onClick={() => void removeCategory(item.id)}
                        style={{
                          height: 32, padding: "0 12px", borderRadius: 8,
                          border: "1px solid #fca5a5", background: "#fff5f5",
                          fontSize: "0.78rem", fontWeight: 500, color: "#dc2626",
                          cursor: (isSaving || item.productCount > 0) ? "not-allowed" : "pointer",
                          opacity: (isSaving || item.productCount > 0) ? 0.45 : 1,
                        }}
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <PaginationControls
        page={currentPage}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={goPage}
      />

      {/* ── Create modal ── */}
      {createModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setCreateModalOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(440px, 100%)",
              background: "#fff", borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              overflow: "hidden",
            }}
          >
            {/* Modal header */}
            <div style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              padding: "18px 20px 14px",
              borderBottom: "1px solid var(--line)",
              background: "var(--bg)",
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>เพิ่มหมวดหมู่</h3>
                <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                  สร้างหมวดใหม่สำหรับหน้าเพิ่มสินค้าและ POS
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                aria-label="ปิด"
                style={{
                  width: 30, height: 30, padding: 0, flexShrink: 0,
                  borderRadius: 8, border: "1px solid var(--line)",
                  background: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "none",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" stroke="#1a1614" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={createCategory} style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Name */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>
                  ชื่อหมวดหมู่ <span style={{ color: "var(--brand)" }}>*</span>
                </label>
                <input
                  id="categoryName"
                  name="name"
                  required
                  autoFocus
                  placeholder="เช่น อาหารจานหลัก, เครื่องดื่ม"
                  style={{
                    height: 40, padding: "0 12px", borderRadius: 9,
                    border: "1px solid var(--line)", background: "var(--bg)",
                    fontSize: "0.85rem", color: "var(--text)", outline: "none",
                  }}
                />
              </div>

              {/* Sort order */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>
                  ลำดับแสดงผล
                </label>
                <input
                  id="categoryOrder"
                  name="sortOrder"
                  type="number"
                  step={1}
                  defaultValue={0}
                  style={{
                    height: 40, padding: "0 12px", borderRadius: 9,
                    border: "1px solid var(--line)", background: "var(--bg)",
                    fontSize: "0.85rem", color: "var(--text)", outline: "none",
                    width: 120,
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{
                    height: 38, padding: "0 16px", borderRadius: 9,
                    border: "1px solid var(--line)", background: "#fff",
                    fontSize: "0.82rem", fontWeight: 500, color: "var(--text)", cursor: "pointer",
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    height: 38, padding: "0 20px", borderRadius: 9,
                    background: "var(--brand)", border: "none",
                    fontSize: "0.82rem", fontWeight: 600, color: "#fff",
                    cursor: creating ? "not-allowed" : "pointer",
                    opacity: creating ? 0.7 : 1,
                  }}
                >
                  {creating ? "กำลังบันทึก..." : "เพิ่มหมวดหมู่"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
