"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PaginationControls } from "@/components/pagination-controls";

type Customer = {
  id: string;
  name: string;
  type: "WALK_IN" | "REGULAR";
  phone: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type CustomerManagerProps = {
  initialCustomers: Customer[];
  currency: string;
  currentPage: number;
  pageSize: number;
  totalItems: number;
};

type CustomerOrderHistory = {
  id: string;
  orderNumber: string;
  createdAt: string;
  paymentMethod: string;
  itemCount: number;
  total: number;
};

type CustomerHistoryPayload = {
  customer: {
    id: string;
    name: string;
    type: "WALK_IN" | "REGULAR";
  };
  summary: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderAt: string | null;
  };
  rows: CustomerOrderHistory[];
};

type DraftMap = Record<
  string,
  {
    name: string;
    type: "WALK_IN" | "REGULAR";
    phone: string;
    note: string;
    isActive: boolean;
  }
>;

function buildDrafts(customers: Customer[]): DraftMap {
  return customers.reduce<DraftMap>((map, customer) => {
    map[customer.id] = {
      name: customer.name,
      type: customer.type,
      phone: customer.phone || "",
      note: customer.note || "",
      isActive: customer.isActive
    };
    return map;
  }, {});
}

export function CustomerManager({
  initialCustomers,
  currency,
  currentPage,
  pageSize,
  totalItems
}: CustomerManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState(initialCustomers);
  const [drafts, setDrafts] = useState<DraftMap>(() => buildDrafts(initialCustomers));
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedHistoryCustomerId, setSelectedHistoryCustomerId] = useState<string>(() => {
    const firstRegular = initialCustomers.find((item) => item.type === "REGULAR" && item.isActive);
    return firstRegular?.id || "";
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [history, setHistory] = useState<CustomerHistoryPayload | null>(null);

  const activeCount = useMemo(() => customers.filter((item) => item.isActive).length, [customers]);
  const regularCustomers = useMemo(
    () => customers.filter((item) => item.type === "REGULAR").sort((a, b) => a.name.localeCompare(b.name, "th")),
    [customers]
  );

  useEffect(() => {
    setCustomers(initialCustomers);
    setDrafts(buildDrafts(initialCustomers));
  }, [initialCustomers]);

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

  function setDraftValue(customerId: string, key: keyof DraftMap[string], value: string | boolean) {
    setDrafts((prev) => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        [key]: value
      }
    }));
  }

  useEffect(() => {
    if (!selectedHistoryCustomerId) {
      setHistory(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const response = await fetch(`/api/customers/${selectedHistoryCustomerId}/orders`, { cache: "no-store" });
        const payload = (await response.json()) as CustomerHistoryPayload | { error?: string };
        if (!response.ok) {
          throw new Error(("error" in payload && payload.error) || "Cannot load history");
        }

        if (!cancelled) {
          setHistory(payload as CustomerHistoryPayload);
        }
      } catch (err) {
        if (!cancelled) {
          setHistory(null);
          setHistoryError(err instanceof Error ? err.message : "Cannot load history");
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedHistoryCustomerId]);

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || "").trim(),
          type: form.get("type"),
          phone: String(form.get("phone") || "").trim(),
          note: String(form.get("note") || "").trim(),
          isActive: true
        })
      });

      const data = (await response.json()) as Customer | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot create customer");
      }

      const created = data as Customer;
      setCustomers((prev) => [created, ...prev].slice(0, pageSize));
      setDrafts((prev) => ({
        ...prev,
        [created.id]: {
          name: created.name,
          type: created.type,
          phone: created.phone || "",
          note: created.note || "",
          isActive: created.isActive
        }
      }));
      if (created.type === "REGULAR" && !selectedHistoryCustomerId) {
        setSelectedHistoryCustomerId(created.id);
      }
      goPage(1);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create customer");
    } finally {
      setSaving(false);
    }
  }

  async function saveCustomer(customerId: string) {
    const draft = drafts[customerId];
    if (!draft) return;

    setSavingId(customerId);
    setError("");

    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          type: draft.type,
          phone: draft.phone.trim(),
          note: draft.note.trim(),
          isActive: draft.isActive
        })
      });

      const data = (await response.json()) as Customer | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot update customer");
      }

      const updated = data as Customer;
      setCustomers((prev) => prev.map((item) => (item.id === customerId ? updated : item)));
      setDrafts((prev) => ({
        ...prev,
        [customerId]: {
          name: updated.name,
          type: updated.type,
          phone: updated.phone || "",
          note: updated.note || "",
          isActive: updated.isActive
        }
      }));

      if (selectedHistoryCustomerId === customerId && updated.type !== "REGULAR") {
        setSelectedHistoryCustomerId("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot update customer");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card space-y-4">
        <div>
          <h2 className="mt-0 text-xl font-semibold">เพิ่มลูกค้า</h2>
          <p className="mb-0 text-sm text-[var(--muted)]">รายชื่อลูกค้าที่เปิดใช้งาน จะไปแสดงใน POS dropdown</p>
        </div>

        <form onSubmit={createCustomer} className="space-y-3">
          <div className="field">
            <label htmlFor="customerName">ชื่อลูกค้า *</label>
            <input id="customerName" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="customerType">ประเภท</label>
            <select id="customerType" name="type" defaultValue="REGULAR">
              <option value="REGULAR">ลูกค้าประจำ</option>
              <option value="WALK_IN">ลูกค้า</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="customerPhone">เบอร์โทร</label>
            <input id="customerPhone" name="phone" />
          </div>
          <div className="field">
            <label htmlFor="customerNote">หมายเหตุ</label>
            <textarea id="customerNote" name="note" rows={3} />
          </div>

          <button type="submit" disabled={saving}>
            {saving ? "กำลังบันทึก..." : "เพิ่มลูกค้า"}
          </button>
        </form>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="mt-0 text-xl font-semibold">รายชื่อลูกค้า</h2>
          <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
            หน้านี้ใช้งานอยู่ {activeCount}/{customers.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>ประเภท</th>
                <th>เบอร์</th>
                <th>หมายเหตุ</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const draft = drafts[customer.id];
                return (
                  <tr key={customer.id}>
                    <td>
                      <input
                        value={draft?.name || ""}
                        onChange={(event) => setDraftValue(customer.id, "name", event.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        value={draft?.type || "REGULAR"}
                        onChange={(event) =>
                          setDraftValue(customer.id, "type", event.target.value as "WALK_IN" | "REGULAR")
                        }
                      >
                        <option value="REGULAR">ลูกค้าประจำ</option>
                        <option value="WALK_IN">ลูกค้า</option>
                      </select>
                    </td>
                    <td>
                      <input
                        value={draft?.phone || ""}
                        onChange={(event) => setDraftValue(customer.id, "phone", event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        value={draft?.note || ""}
                        onChange={(event) => setDraftValue(customer.id, "note", event.target.value)}
                      />
                    </td>
                    <td>
                      <span className="text-sm">{draft?.isActive ? "ใช้งาน" : "ปิด"}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setDraftValue(customer.id, "isActive", !draft?.isActive)}
                        >
                          {draft?.isActive ? "ปิด" : "เปิด"}
                        </button>
                        <button type="button" onClick={() => saveCustomer(customer.id)} disabled={savingId === customer.id}>
                          {savingId === customer.id ? "..." : "บันทึก"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-[var(--muted)]">
                    ยังไม่มีลูกค้า
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
        <p className="mb-0 text-xs text-[var(--muted)]">เลือกประเภทลูกค้าได้ทั้งลูกค้าประจำและขาจรสำหรับ POS dropdown</p>
      </section>

      <section className="card lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="field mb-0 min-w-[260px] flex-1">
            <label htmlFor="historyCustomer">ประวัติการซื้อรายลูกค้า (เลือกจากลูกค้าประจำ)</label>
            <select
              id="historyCustomer"
              value={selectedHistoryCustomerId}
              onChange={(event) => setSelectedHistoryCustomerId(event.target.value)}
            >
              <option value="">เลือกชื่อลูกค้า</option>
              {regularCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {historyError ? <p className="text-sm text-red-600">{historyError}</p> : null}
        {historyLoading ? <p className="text-sm text-[var(--muted)]">กำลังโหลดประวัติ...</p> : null}

        {!historyLoading && selectedHistoryCustomerId && history ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                <p className="mb-1 text-xs text-[var(--muted)]">ชื่อลูกค้า</p>
                <p className="m-0 font-semibold">{history.customer.name}</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                <p className="mb-1 text-xs text-[var(--muted)]">จำนวนบิล</p>
                <p className="m-0 font-semibold">{history.summary.totalOrders}</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                <p className="mb-1 text-xs text-[var(--muted)]">ยอดซื้อรวม</p>
                <p className="m-0 font-semibold">{formatCurrency(history.summary.totalSpent, currency)}</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                <p className="mb-1 text-xs text-[var(--muted)]">บิลเฉลี่ย</p>
                <p className="m-0 font-semibold">{formatCurrency(history.summary.averageOrderValue, currency)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table min-w-[720px]">
                <thead>
                  <tr>
                    <th>เวลา</th>
                    <th>เลขที่บิล</th>
                    <th>จำนวนรายการ</th>
                    <th>ชำระ</th>
                    <th>ยอดสุทธิ</th>
                  </tr>
                </thead>
                <tbody>
                  {history.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{row.orderNumber}</td>
                      <td>{row.itemCount}</td>
                      <td>{row.paymentMethod}</td>
                      <td>{formatCurrency(row.total, currency)}</td>
                    </tr>
                  ))}
                  {history.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-[var(--muted)]">
                        ยังไม่พบประวัติการซื้อ
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
