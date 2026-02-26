"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "QR";
type BillingMode = "BACKDATE" | "ADVANCE";

type Product = {
  id: string;
  name: string;
  price: number;
  stockQty: number;
};

type Customer = {
  id: string;
  name: string;
  type: "WALK_IN" | "REGULAR";
};

type BillingBatchManagerProps = {
  products: Product[];
  customers: Customer[];
  currency: string;
};

type RowItem = {
  id: string;
  productId: string;
  qty: number;
  note: string;
};

type RowResult = {
  tone: "success" | "error";
  message: string;
};

type BillingRow = {
  id: string;
  mode: BillingMode;
  dateTime: string;
  customerId: string;
  paymentMethod: PaymentMethod;
  discount: number;
  note: string;
  items: RowItem[];
  result: RowResult | null;
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function toDateTimeLocalValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function createRowItem(defaultProductId: string): RowItem {
  return {
    id: createId("item"),
    productId: defaultProductId,
    qty: 1,
    note: ""
  };
}

function createBillingRow(defaultProductId: string): BillingRow {
  return {
    id: createId("row"),
    mode: "BACKDATE",
    dateTime: toDateTimeLocalValue(),
    customerId: "WALK_IN",
    paymentMethod: "CASH",
    discount: 0,
    note: "",
    items: [createRowItem(defaultProductId)],
    result: null
  };
}

export function BillingBatchManager({ products, customers, currency }: BillingBatchManagerProps) {
  const defaultProductId = products[0]?.id || "";
  const [rows, setRows] = useState<BillingRow[]>([createBillingRow(defaultProductId)]);
  const [savingAll, setSavingAll] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const customerById = useMemo(() => {
    return new Map(customers.map((item) => [item.id, item]));
  }, [customers]);

  const productById = useMemo(() => {
    return new Map(products.map((item) => [item.id, item]));
  }, [products]);

  function updateRow(rowId: string, updater: (row: BillingRow) => BillingRow) {
    setRows((prev) => prev.map((row) => (row.id === rowId ? updater(row) : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, createBillingRow(defaultProductId)]);
  }

  function removeRow(rowId: string) {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((row) => row.id !== rowId);
    });
  }

  function addItem(rowId: string) {
    updateRow(rowId, (row) => ({
      ...row,
      items: [...row.items, createRowItem(defaultProductId)],
      result: null
    }));
  }

  function removeItem(rowId: string, itemId: string) {
    updateRow(rowId, (row) => ({
      ...row,
      items: row.items.length <= 1 ? row.items : row.items.filter((item) => item.id !== itemId),
      result: null
    }));
  }

  function updateItem(rowId: string, itemId: string, updater: (item: RowItem) => RowItem) {
    updateRow(rowId, (row) => ({
      ...row,
      items: row.items.map((item) => (item.id === itemId ? updater(item) : item)),
      result: null
    }));
  }

  async function saveAllRows() {
    if (savingAll) return;

    setSavingAll(true);
    setMessage("");
    setError("");

    const snapshot = [...rows];
    let successCount = 0;
    let failureCount = 0;

    for (const row of snapshot) {
      const validItems = row.items
        .filter((item) => item.productId && item.qty > 0)
        .map((item) => ({
          productId: item.productId,
          qty: Math.max(1, Math.trunc(item.qty)),
          note: item.note.trim() || undefined
        }));

      if (!row.dateTime) {
        failureCount += 1;
        updateRow(row.id, (current) => ({
          ...current,
          result: {
            tone: "error",
            message: "กรุณาเลือกวันเวลา"
          }
        }));
        continue;
      }

      if (validItems.length === 0) {
        failureCount += 1;
        updateRow(row.id, (current) => ({
          ...current,
          result: {
            tone: "error",
            message: "ยังไม่มีรายการสินค้า"
          }
        }));
        continue;
      }

      const selectedCustomer = row.customerId === "WALK_IN" ? null : customerById.get(row.customerId) || null;

      const payload: {
        items: Array<{ productId: string; qty: number; note?: string }>;
        discount: number;
        paymentMethod: PaymentMethod;
        customerId?: string;
        customerType: "WALK_IN" | "REGULAR";
        customerName: string;
        note?: string;
        orderStatus: "PAID" | "OPEN";
        billAt?: string;
        scheduledFor?: string;
      } = {
        items: validItems,
        discount: Math.max(0, Number(row.discount) || 0),
        paymentMethod: row.paymentMethod,
        customerId: selectedCustomer?.id,
        customerType: selectedCustomer ? selectedCustomer.type : "WALK_IN",
        customerName: selectedCustomer?.name || "ลูกค้าขาจร",
        note: row.note.trim() || undefined,
        orderStatus: row.mode === "ADVANCE" ? "OPEN" : "PAID"
      };

      if (row.mode === "ADVANCE") {
        payload.scheduledFor = new Date(row.dateTime).toISOString();
      } else {
        payload.billAt = new Date(row.dateTime).toISOString();
      }

      try {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Cannot create order");
        }

        successCount += 1;
        updateRow(row.id, (current) => ({
          ...current,
          result: {
            tone: "success",
            message: `สำเร็จ ${data.orderNumber}`
          }
        }));
      } catch (err) {
        failureCount += 1;
        updateRow(row.id, (current) => ({
          ...current,
          result: {
            tone: "error",
            message: err instanceof Error ? err.message : "Cannot create order"
          }
        }));
      }
    }

    if (successCount > 0) {
      setMessage(`บันทึกสำเร็จ ${successCount} บิล`);
    }
    if (failureCount > 0) {
      setError(`มีรายการไม่สำเร็จ ${failureCount} บิล กรุณาตรวจสอบในตาราง`);
    }

    setSavingAll(false);
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 text-xl font-semibold">ลงบิลย้อนหลัง / ลงบิลล่วงหน้า แบบตาราง</h2>
          <p className="mb-0 mt-1 text-sm text-[var(--muted)]">
            เพิ่มหลายแถวได้ในครั้งเดียว แล้วกดบันทึกทั้งหมด ระบบจะสร้างบิลตามวันที่ที่กำหนด
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="secondary" onClick={addRow}>
            เพิ่มแถว
          </button>
          <button type="button" disabled={savingAll} onClick={() => void saveAllRows()}>
            {savingAll ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table min-w-[1200px]">
          <thead>
            <tr>
              <th>#</th>
              <th>ประเภทบิล</th>
              <th>วัน/เวลา</th>
              <th>ลูกค้า</th>
              <th>รายการสินค้า</th>
              <th>ส่วนลด</th>
              <th>ชำระเงิน</th>
              <th>หมายเหตุ</th>
              <th>ผลลัพธ์</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>
                  <select
                    value={row.mode}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        mode: event.target.value as BillingMode,
                        result: null
                      }))
                    }
                  >
                    <option value="BACKDATE">ย้อนหลัง (ชำระแล้ว)</option>
                    <option value="ADVANCE">ล่วงหน้า (ยังไม่ชำระ)</option>
                  </select>
                </td>
                <td>
                  <input
                    type="datetime-local"
                    value={row.dateTime}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        dateTime: event.target.value,
                        result: null
                      }))
                    }
                  />
                </td>
                <td>
                  <select
                    value={row.customerId}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        customerId: event.target.value,
                        result: null
                      }))
                    }
                  >
                    <option value="WALK_IN">ลูกค้าขาจร</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="space-y-2">
                    {row.items.map((item) => {
                      const selected = productById.get(item.productId);
                      return (
                        <div key={item.id} className="rounded-lg border border-[var(--line)] bg-white p-2">
                          <div className="grid gap-2 md:grid-cols-[1fr_70px_1fr_auto]">
                            <select
                              value={item.productId}
                              onChange={(event) =>
                                updateItem(row.id, item.id, (current) => ({
                                  ...current,
                                  productId: event.target.value
                                }))
                              }
                            >
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} ({formatCurrency(product.price, currency)})
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={item.qty}
                              onChange={(event) =>
                                updateItem(row.id, item.id, (current) => ({
                                  ...current,
                                  qty: Math.max(1, Math.trunc(Number(event.target.value) || 1))
                                }))
                              }
                            />
                            <input
                              value={item.note}
                              placeholder="หมายเหตุรายการ"
                              onChange={(event) =>
                                updateItem(row.id, item.id, (current) => ({
                                  ...current,
                                  note: event.target.value
                                }))
                              }
                            />
                            <button type="button" className="secondary" onClick={() => removeItem(row.id, item.id)}>
                              ลบ
                            </button>
                          </div>
                          {selected ? (
                            <p className="mb-0 mt-1 text-xs text-[var(--muted)]">
                              ย่อย: {formatCurrency(selected.price * item.qty, currency)} | คงเหลือ {selected.stockQty}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                    <button type="button" className="secondary text-xs" onClick={() => addItem(row.id)}>
                      เพิ่มสินค้า
                    </button>
                  </div>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={row.discount}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        discount: Math.max(0, Number(event.target.value) || 0),
                        result: null
                      }))
                    }
                  />
                </td>
                <td>
                  <select
                    value={row.paymentMethod}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        paymentMethod: event.target.value as PaymentMethod,
                        result: null
                      }))
                    }
                  >
                    <option value="CASH">เงินสด</option>
                    <option value="CARD">บัตร</option>
                    <option value="TRANSFER">โอนเงิน</option>
                    <option value="QR">QR</option>
                  </select>
                </td>
                <td>
                  <input
                    value={row.note}
                    onChange={(event) =>
                      updateRow(row.id, (current) => ({
                        ...current,
                        note: event.target.value,
                        result: null
                      }))
                    }
                  />
                </td>
                <td>
                  {row.result ? (
                    <span className={row.result.tone === "success" ? "text-[var(--ok)]" : "text-red-600"}>{row.result.message}</span>
                  ) : (
                    <span className="text-[var(--muted)]">-</span>
                  )}
                </td>
                <td>
                  <button type="button" className="secondary" onClick={() => removeRow(row.id)}>
                    ลบแถว
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message ? <p className="m-0 text-sm text-[var(--ok)]">{message}</p> : null}
      {error ? <p className="m-0 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
