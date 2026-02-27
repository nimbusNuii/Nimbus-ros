"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "QR";

type Product = {
  id: string;
  sku?: string | null;
  name: string;
  category: string | null;
  imageUrl: string | null;
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
  const [activeCategory, setActiveCategory] = useState("ALL");
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

  const categoryTabs = useMemo(() => {
    const unique = new Set<string>();
    for (const product of products) {
      if (product.category) unique.add(product.category);
    }
    return ["ALL", ...Array.from(unique)];
  }, [products]);

  const categoryProducts = useMemo(() => {
    if (activeCategory === "ALL") return products;
    return products.filter((item) => (item.category || "Uncategory") === activeCategory);
  }, [activeCategory, products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return categoryProducts;
    return categoryProducts.filter((item) =>
      [item.name, item.category || "", item.sku || ""].join(" ").toLowerCase().includes(q)
    );
  }, [categoryProducts, productQuery]);

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
      orderStatus: "PAID";
      billAt?: string;
    } = {
      items: validItems,
      discount: Math.max(0, Number(discount) || 0),
      paymentMethod,
      customerId: selectedCustomer?.id,
      customerType: selectedCustomer ? selectedCustomer.type : "WALK_IN",
      customerName: selectedCustomer?.name || "ลูกค้า",
      note: note.trim() || undefined,
      orderStatus: "PAID"
    };

    payload.billAt = new Date(dateTime).toISOString();

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

      setMessage(`บันทึกบิลชำระแล้วสำเร็จ ${data.orderNumber}`);
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
        <p className="mb-0 mt-1 text-sm text-[var(--muted)]">บิลทั้งหมดจะบันทึกเป็นชำระแล้ว และเพิ่มสินค้าแบบ Modal</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="field mb-0">
          <label htmlFor="billingDateTime">วัน/เวลา</label>
          <input id="billingDateTime" type="datetime-local" value={dateTime} onChange={(event) => setDateTime(event.target.value)} />
        </div>

        <div className="field mb-0">
          <label htmlFor="billingCustomer">ลูกค้า</label>
          <select id="billingCustomer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="WALK_IN">ลูกค้า</option>
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

        <div className="field mb-0 sm:col-span-2 xl:col-span-4">
          <label htmlFor="billingNote">หมายเหตุบิล</label>
          <input id="billingNote" value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-base font-semibold">รายการสินค้า</h3>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setActiveCategory("ALL");
              setProductQuery("");
              setProductModalOpen(true);
            }}
          >
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
          <div className="modal-panel w-full max-w-5xl">
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
                placeholder="ค้นหาเมนู / หมวด / SKU"
              />
            </div>

            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {categoryTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveCategory(tab)}
                  className={`${activeCategory === tab ? "" : "secondary"} whitespace-nowrap rounded-full px-3 py-2 text-xs sm:px-4 sm:text-sm`}
                >
                  {tab === "ALL" ? "ทั้งหมด" : tab}
                </button>
              ))}
            </div>

            <div className="grid max-h-[62vh] gap-2 overflow-auto [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(140px,1fr))]">
              {filteredProducts.map((product) => (
                <article
                  key={product.id}
                  className="group relative overflow-hidden rounded-xl border border-[var(--line)] bg-white p-2 transition duration-150 hover:bg-[#f9fafb]"
                >
                  <button
                    type="button"
                    className="secondary w-full flex-col items-start rounded-lg border border-transparent bg-transparent p-0 text-left"
                    disabled={product.stockQty <= 0}
                    onClick={() => addProduct(product.id)}
                  >
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="aspect-square w-full rounded-lg border border-[var(--line)] object-cover"
                      />
                    ) : (
                      <div className="grid aspect-square w-full place-items-center rounded-lg border border-dashed border-[var(--line)] text-xs text-[var(--muted)]">
                        ไม่มีรูปสินค้า
                      </div>
                    )}

                    <div className="mt-2 space-y-1">
                      <p className="m-0 line-clamp-2 text-sm font-semibold text-[var(--text)]">{product.name}</p>
                      <p className="m-0 text-xs text-[var(--muted)]">คงเหลือ {product.stockQty}</p>
                      <p className="m-0 text-base font-bold text-[var(--brand)]">{formatCurrency(product.price, currency)}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="secondary mt-2 w-full"
                    disabled={product.stockQty <= 0}
                    onClick={() => addProduct(product.id)}
                  >
                    {product.stockQty <= 0 ? "สินค้าหมด" : "เพิ่มสินค้า"}
                  </button>

                  {product.stockQty <= 0 ? (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/35 text-2xl font-semibold text-white">
                      Sold out
                    </div>
                  ) : null}
                </article>
              ))}
              {filteredProducts.length === 0 ? (
                <p className="col-span-full text-center text-sm text-[var(--muted)]">ไม่พบสินค้าในหมวดนี้</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
