"use client";

import { FormEvent, useMemo, useState } from "react";

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

export function CustomerManager({ initialCustomers }: CustomerManagerProps) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [drafts, setDrafts] = useState<DraftMap>(() => buildDrafts(initialCustomers));
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const activeCount = useMemo(() => customers.filter((item) => item.isActive).length, [customers]);

  function setDraftValue(customerId: string, key: keyof DraftMap[string], value: string | boolean) {
    setDrafts((prev) => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        [key]: value
      }
    }));
  }

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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Cannot create customer");
      }

      setCustomers((prev) => [data, ...prev]);
      setDrafts((prev) => ({
        ...prev,
        [data.id]: {
          name: data.name,
          type: data.type,
          phone: data.phone || "",
          note: data.note || "",
          isActive: data.isActive
        }
      }));
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Cannot update customer");
      }

      setCustomers((prev) => prev.map((item) => (item.id === customerId ? data : item)));
      setDrafts((prev) => ({
        ...prev,
        [customerId]: {
          name: data.name,
          type: data.type,
          phone: data.phone || "",
          note: data.note || "",
          isActive: data.isActive
        }
      }));
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
              <option value="WALK_IN">ลูกค้าขาจร</option>
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
            ใช้งานอยู่ {activeCount}/{customers.length}
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
                        <option value="WALK_IN">ลูกค้าขาจร</option>
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
        <p className="mb-0 text-xs text-[var(--muted)]">เลือกประเภทลูกค้าได้ทั้งลูกค้าประจำและขาจรสำหรับ POS dropdown</p>
      </section>
    </div>
  );
}
