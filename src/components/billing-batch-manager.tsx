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

type LineItem = {
  lineId: string;
  productId: string;
  qty: number;
  note: string;
};

function createLineId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function toDateTimeLocalValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function BillingBatchManager({ products, customers, currency }: BillingBatchManagerProps) {
  const [mode, setMode] = useState<BillingMode>("BACKDATE");
  const [dateTime, setDateTime] = useState(toDateTimeLocalValue());
  const [customerId, setCustomerId] = useState("WALK_IN");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [discount, setDiscount] = useState(0);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");

  const customerById = useMemo(() => new Map(customers.map((item) => [item.id, item])), [customers]);
  const productById = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((item) => item.name.toLowerCase().includes(q));
  }, [products, productQuery]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = productById.get(item.productId);
      if (!product) return sum;
      return sum + product.price * item.qty;
    }, 0);
  }, [items, productById]);

  function addProduct(productId: string) {
    const product = productById.get(productId);
    if (!product) return;

    setItems((prev) => {
      const index = prev.findIndex((item) => item.productId === productId && item.note.trim() === "");
      if (index < 0) {
        return [...prev, { lineId: createLineId(), productId, qty: 1, note: "" }];
      }

      const next = [...prev];
      const target = next[index];
      next[index] = { ...target, qty: target.qty + 1 };
      return next;
    });
  }

  function updateItem(lineId: string, updater: (item: LineItem) => LineItem) {
    setItems((prev) => prev.map((item) => (item.lineId === lineId ? updater(item) : item)));
  }

  function removeItem(lineId: string) {
    setItems((prev) => prev.filter((item) => item.lineId !== lineId));
  }

  async function submitBill() {
    if (submitting) return;
    setMessage("");
    setError("");

    if (!dateTime) {
      setError("กรุณาเลือกวันเวลา");
      return;
    }

    const validItems = items
      .filter((item) => item.productId && item.qty > 0)
      .map((item) => ({
        productId: item.productId,
        qty: Math.max(1, Math.trunc(item.qty)),
        note: item.note.trim() || undefined
      }));

    if (validItems.length === 0) {
      setError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    const selectedCustomer = customerId === "WALK_IN" ? null : customerById.get(customerId) || null;

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
      discount: Math.max(0, Number(discount) || 0),
      paymentMethod,
      customerId: selectedCustomer?.id,
      customerType: selectedCustomer ? selectedCustomer.type : "WALK_IN",
      customerName: selectedCustomer?.name || "ลูกค้าขาจร",
      note: note.trim() || undefined,
      orderStatus: mode === "ADVANCE" ? "OPEN" : "PAID"
    };

    if (mode === "ADVANCE") {
      payload.scheduledFor = new Date(dateTime).toISOString();
    } else {
      payload.billAt = new Date(dateTime).toISOString();
    }

    setSubmitting(true);

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

      setMessage(
        mode === "ADVANCE"
          ? `บันทึกบิลล่วงหน้าสำเร็จ ${data.orderNumber} (จะขึ้นที่ครัว)`
          : `บันทึกบิลย้อนหลังสำเร็จ ${data.orderNumber}`
      );
      setItems([]);
      setNote("");
      setDiscount(0);
      setProductModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="m-0 text-xl font-semibold">เพิ่มบิลทีละรายการ</h2>
        <p className="mb-0 mt-1 text-sm text-[var(--muted)]">
          เลือกบิลย้อนหลังหรือบิลล่วงหน้า แล้วเพิ่มสินค้าแบบ Modal ก่อนกดบันทึก
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="field mb-0">
          <label htmlFor="billingMode">ประเภทบิล</label>
          <select id="billingMode" value={mode} onChange={(event) => setMode(event.target.value as BillingMode)}>
            <option value="BACKDATE">ย้อนหลัง (ชำระแล้ว)</option>
            <option value="ADVANCE">ล่วงหน้า (ยังไม่ชำระ, ส่งครัวได้)</option>
          </select>
        </div>

        <div className="field mb-0">
          <label htmlFor="billingDateTime">วัน/เวลา</label>
          <input id="billingDateTime" type="datetime-local" value={dateTime} onChange={(event) => setDateTime(event.target.value)} />
        </div>

        <div className="field mb-0">
          <label htmlFor="billingCustomer">ลูกค้า</label>
          <select id="billingCustomer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="WALK_IN">ลูกค้าขาจร</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field mb-0">
          <label htmlFor="billingPayment">ชำระเงิน</label>
          <select id="billingPayment" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
            <option value="CASH">เงินสด</option>
            <option value="CARD">บัตร</option>
            <option value="TRANSFER">โอนเงิน</option>
            <option value="QR">QR</option>
          </select>
        </div>

        <div className="field mb-0">
          <label htmlFor="billingDiscount">ส่วนลด</label>
          <input
            id="billingDiscount"
            type="number"
            min={0}
            value={discount}
            onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))}
          />
        </div>

        <div className="field mb-0">
          <label htmlFor="billingNote">หมายเหตุบิล</label>
          <input id="billingNote" value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-base font-semibold">รายการสินค้า</h3>
          <button type="button" className="secondary" onClick={() => setProductModalOpen(true)}>
            เพิ่มสินค้า (Modal)
          </button>
        </div>

        {items.length === 0 ? <p className="mb-0 text-sm text-[var(--muted)]">ยังไม่มีสินค้า</p> : null}

        <div className="space-y-2">
          {items.map((item) => {
            const product = productById.get(item.productId);
            return (
              <article key={item.lineId} className="rounded-lg border border-[var(--line)] bg-white p-2">
                <div className="grid gap-2 md:grid-cols-[1fr_90px_1fr_auto] md:items-center">
                  <div>
                    <p className="m-0 text-sm font-medium text-[var(--text)]">{product?.name || "-"}</p>
                    <p className="m-0 text-xs text-[var(--muted)]">
                      {product ? formatCurrency(product.price, currency) : "-"} | คงเหลือ {product?.stockQty ?? 0}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(event) =>
                      updateItem(item.lineId, (current) => ({
                        ...current,
                        qty: Math.max(1, Math.trunc(Number(event.target.value) || 1))
                      }))
                    }
                  />
                  <input
                    placeholder="หมายเหตุรายการ"
                    value={item.note}
                    onChange={(event) =>
                      updateItem(item.lineId, (current) => ({
                        ...current,
                        note: event.target.value
                      }))
                    }
                  />
                  <button type="button" className="secondary" onClick={() => removeItem(item.lineId)}>
                    ลบ
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-[var(--muted)]">ยอดก่อนส่วนลด</span>
          <span className="text-base font-semibold">{formatCurrency(subtotal, currency)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={submitting} onClick={() => void submitBill()}>
          {submitting ? "กำลังบันทึก..." : "บันทึกบิล"}
        </button>
      </div>

      {message ? <p className="m-0 text-sm text-[var(--ok)]">{message}</p> : null}
      {error ? <p className="m-0 text-sm text-red-600">{error}</p> : null}

      {productModalOpen ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setProductModalOpen(false);
            }
          }}
        >
          <div className="modal-panel" style={{ width: "min(980px, 100%)" }}>
            <div className="modal-header">
              <div>
                <h3 className="m-0 text-lg font-semibold">เลือกสินค้า</h3>
                <p className="m-0 mt-1 text-sm text-[var(--muted)]">กดเพิ่มสินค้าได้ทีละรายการ</p>
              </div>
              <button type="button" className="secondary" onClick={() => setProductModalOpen(false)}>
                ปิด
              </button>
            </div>

            <div className="field mb-3">
              <label htmlFor="productSearch">ค้นหาสินค้า</label>
              <input
                id="productSearch"
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                placeholder="พิมพ์ชื่อสินค้า"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <article key={product.id} className="rounded-xl border border-[var(--line)] bg-white p-3">
                  <p className="m-0 text-sm font-semibold text-[var(--text)]">{product.name}</p>
                  <p className="m-0 mt-1 text-xs text-[var(--muted)]">
                    {formatCurrency(product.price, currency)} | คงเหลือ {product.stockQty}
                  </p>
                  <button
                    type="button"
                    className="secondary mt-2 w-full"
                    disabled={product.stockQty <= 0}
                    onClick={() => addProduct(product.id)}
                  >
                    {product.stockQty <= 0 ? "สินค้าหมด" : "เพิ่มสินค้า"}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
