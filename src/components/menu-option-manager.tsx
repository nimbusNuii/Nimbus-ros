"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";

type MenuOptionType = "SPICE_LEVEL" | "ADD_ON" | "REMOVE_INGREDIENT";

type MenuOption = {
  id: string;
  type: MenuOptionType;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

type MenuOptionManagerProps = {
  initialOptions: MenuOption[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  initialQuery: string;
  initialSort: MenuOptionSort;
};

type DraftMap = Record<string, { type: MenuOptionType; label: string; sortOrder: number; isActive: boolean }>;
type MenuOptionSort = "type_order_label" | "label_asc" | "label_desc" | "order_asc" | "order_desc" | "created_desc" | "created_asc";

const typeLabel: Record<MenuOptionType, string> = {
  SPICE_LEVEL: "ระดับความเผ็ด",
  ADD_ON: "เพิ่มพิเศษ",
  REMOVE_INGREDIENT: "ไม่ใส่วัตถุดิบ"
};

function buildDrafts(options: MenuOption[]): DraftMap {
  return options.reduce<DraftMap>((map, option) => {
    map[option.id] = {
      type: option.type,
      label: option.label,
      sortOrder: option.sortOrder,
      isActive: option.isActive
    };
    return map;
  }, {});
}

export function MenuOptionManager({
  initialOptions,
  currentPage,
  pageSize,
  totalItems,
  initialQuery,
  initialSort
}: MenuOptionManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [options, setOptions] = useState(initialOptions);
  const [drafts, setDrafts] = useState<DraftMap>(() => buildDrafts(initialOptions));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [sortInput, setSortInput] = useState<MenuOptionSort>(initialSort);

  const grouped = useMemo(() => {
    const map: Record<MenuOptionType, MenuOption[]> = {
      SPICE_LEVEL: [],
      ADD_ON: [],
      REMOVE_INGREDIENT: []
    };

    for (const option of options) {
      map[option.type].push(option);
    }

    for (const key of Object.keys(map) as MenuOptionType[]) {
      map[key].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "th"));
    }

    return map;
  }, [options]);

  useEffect(() => {
    setOptions(initialOptions);
    setDrafts(buildDrafts(initialOptions));
  }, [initialOptions]);

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
    if (sortInput === "type_order_label") {
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
    setSortInput("type_order_label");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("sort");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function setDraftValue(optionId: string, key: keyof DraftMap[string], value: string | number | boolean) {
    setDrafts((prev) => ({
      ...prev,
      [optionId]: {
        ...prev[optionId],
        [key]: value
      }
    }));
  }

  async function createOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/menu-options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: form.get("type"),
          label: String(form.get("label") || "").trim(),
          sortOrder: Number(form.get("sortOrder") || 0)
        })
      });

      const data = (await response.json()) as MenuOption | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot create option");
      }

      const created = data as MenuOption;
      setOptions((prev) => [...prev, created]);
      setDrafts((prev) => ({
        ...prev,
        [created.id]: {
          type: created.type,
          label: created.label,
          sortOrder: created.sortOrder,
          isActive: created.isActive
        }
      }));
      goPage(1);
      router.refresh();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create option");
    } finally {
      setCreating(false);
    }
  }

  async function saveOption(optionId: string) {
    const draft = drafts[optionId];
    if (!draft) return;

    setSavingId(optionId);
    setError("");

    try {
      const response = await fetch(`/api/menu-options/${optionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: draft.type,
          label: draft.label.trim(),
          sortOrder: Math.trunc(Number(draft.sortOrder) || 0),
          isActive: draft.isActive
        })
      });

      const data = (await response.json()) as MenuOption | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot update option");
      }

      const updated = data as MenuOption;
      setOptions((prev) => prev.map((item) => (item.id === optionId ? updated : item)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot update option");
    } finally {
      setSavingId(null);
    }
  }

  async function removeOption(optionId: string) {
    if (!window.confirm("ลบตัวเลือกนี้หรือไม่?")) return;

    setSavingId(optionId);
    setError("");

    try {
      const response = await fetch(`/api/menu-options/${optionId}`, {
        method: "DELETE"
      });
      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Cannot delete option");
      }

      setOptions((prev) => prev.filter((item) => item.id !== optionId));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[optionId];
        return next;
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot delete option");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">เพิ่มตัวเลือกเมนู</h2>
        <p className="text-sm text-[var(--muted)]">POS จะแสดงเฉพาะตัวเลือกที่เปิดใช้งาน และสามารถเลือกปรับแต่งเฉพาะบางออเดอร์ได้</p>

        <form onSubmit={createOption} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_160px_auto] md:items-end">
          <div className="field mb-0">
            <label htmlFor="optionType">ประเภท</label>
            <select id="optionType" name="type" defaultValue="ADD_ON">
              <option value="ADD_ON">เพิ่มพิเศษ</option>
              <option value="SPICE_LEVEL">ระดับความเผ็ด</option>
              <option value="REMOVE_INGREDIENT">ไม่ใส่วัตถุดิบ</option>
            </select>
          </div>
          <div className="field mb-0">
            <label htmlFor="optionLabel">รายการ *</label>
            <input id="optionLabel" name="label" required />
          </div>
          <div className="field mb-0">
            <label htmlFor="optionOrder">ลำดับ</label>
            <input id="optionOrder" name="sortOrder" type="number" step={1} defaultValue={0} />
          </div>
          <div className="md:col-span-2 xl:col-span-1">
            <button type="submit" disabled={creating}>
              {creating ? "กำลังบันทึก..." : "เพิ่มตัวเลือก"}
            </button>
          </div>
        </form>

        {error ? <p className="mb-0 mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="card">
        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_240px_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="ค้นหาชื่อตัวเลือก" />
          <select value={sortInput} onChange={(event) => setSortInput(event.target.value as MenuOptionSort)}>
            <option value="type_order_label">ประเภท + ลำดับ + ชื่อ (ค่าเริ่มต้น)</option>
            <option value="label_asc">ชื่อ A-Z</option>
            <option value="label_desc">ชื่อ Z-A</option>
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
      </section>

      {(Object.keys(grouped) as MenuOptionType[]).map((type) => (
        <section key={type} className="card">
          <h3 className="mt-0 text-lg font-semibold">{typeLabel[type]}</h3>

          <div className="space-y-2 lg:hidden">
            {grouped[type].map((item) => {
              const draft = drafts[item.id];
              return (
                <article key={item.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="field mb-0">
                      <label htmlFor={`label-mobile-${item.id}`}>รายการ</label>
                      <input
                        id={`label-mobile-${item.id}`}
                        value={draft?.label || ""}
                        onChange={(event) => setDraftValue(item.id, "label", event.target.value)}
                      />
                    </div>
                    <div className="field mb-0">
                      <label htmlFor={`type-mobile-${item.id}`}>ประเภท</label>
                      <select
                        id={`type-mobile-${item.id}`}
                        value={draft?.type || item.type}
                        onChange={(event) => setDraftValue(item.id, "type", event.target.value as MenuOptionType)}
                      >
                        <option value="ADD_ON">เพิ่มพิเศษ</option>
                        <option value="SPICE_LEVEL">ระดับความเผ็ด</option>
                        <option value="REMOVE_INGREDIENT">ไม่ใส่วัตถุดิบ</option>
                      </select>
                    </div>
                    <div className="field mb-0">
                      <label htmlFor={`order-mobile-${item.id}`}>ลำดับ</label>
                      <input
                        id={`order-mobile-${item.id}`}
                        type="number"
                        step={1}
                        value={draft?.sortOrder ?? 0}
                        onChange={(event) => setDraftValue(item.id, "sortOrder", Math.trunc(Number(event.target.value) || 0))}
                      />
                    </div>
                    <div className="field mb-0">
                      <label>สถานะ</label>
                      <button type="button" className="secondary" onClick={() => setDraftValue(item.id, "isActive", !draft?.isActive)}>
                        {draft?.isActive ? "ใช้งาน" : "ปิด"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" disabled={savingId === item.id} onClick={() => void saveOption(item.id)}>
                      {savingId === item.id ? "..." : "บันทึก"}
                    </button>
                    <button type="button" className="secondary" disabled={savingId === item.id} onClick={() => void removeOption(item.id)}>
                      ลบ
                    </button>
                  </div>
                </article>
              );
            })}
            {grouped[type].length === 0 ? <p className="text-center text-sm text-[var(--muted)]">ยังไม่มีรายการ</p> : null}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>รายการ</th>
                  <th>ประเภท</th>
                  <th>ลำดับ</th>
                  <th>สถานะ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {grouped[type].map((item) => {
                  const draft = drafts[item.id];
                  return (
                    <tr key={item.id}>
                      <td>
                        <input
                          value={draft?.label || ""}
                          onChange={(event) => setDraftValue(item.id, "label", event.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          value={draft?.type || item.type}
                          onChange={(event) => setDraftValue(item.id, "type", event.target.value as MenuOptionType)}
                        >
                          <option value="ADD_ON">เพิ่มพิเศษ</option>
                          <option value="SPICE_LEVEL">ระดับความเผ็ด</option>
                          <option value="REMOVE_INGREDIENT">ไม่ใส่วัตถุดิบ</option>
                        </select>
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
                          <button type="button" disabled={savingId === item.id} onClick={() => void saveOption(item.id)}>
                            {savingId === item.id ? "..." : "บันทึก"}
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            disabled={savingId === item.id}
                            onClick={() => void removeOption(item.id)}
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {grouped[type].length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-[var(--muted)]">
                      ยังไม่มีรายการ
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="card">
        <PaginationControls
          page={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={goPage}
        />
      </section>
    </div>
  );
}
