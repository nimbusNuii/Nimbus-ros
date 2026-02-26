"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ReceiptPreviewModal } from "@/components/receipt-preview-modal";

type Product = {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  price: number;
  cost: number;
  stockQty: number;
};

type Customer = {
  id: string;
  name: string;
  type: "WALK_IN" | "REGULAR";
};

type PosClientProps = {
  products: Product[];
  customers: Customer[];
  taxRate: number;
  currency: string;
  initialRecentReceipts: Array<{
    id: string;
    orderNumber: string;
    createdAt: string;
    paymentMethod: string;
    customerType: "WALK_IN" | "REGULAR";
    customerName: string | null;
    itemCount: number;
    total: number;
  }>;
};

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "QR";

function customerNameLabel(item: { customerType: "WALK_IN" | "REGULAR"; customerName: string | null }) {
  return item.customerName || (item.customerType === "REGULAR" ? "ลูกค้าประจำ" : "ลูกค้าขาจร");
}

export function PosClient({ products, customers, taxRate, currency, initialRecentReceipts }: PosClientProps) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [selectedCustomerId, setSelectedCustomerId] = useState("WALK_IN");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [recentReceipts, setRecentReceipts] = useState(initialRecentReceipts);

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const cartItems = useMemo(
    () =>
      products
        .filter((product) => cart[product.id] > 0)
        .map((product) => ({
          ...product,
          qty: cart[product.id],
          lineTotal: cart[product.id] * product.price
        })),
    [cart, products]
  );

  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.lineTotal, 0), [cartItems]);
  const safeDiscount = Math.max(0, Math.min(discount, subtotal));
  const taxable = Math.max(0, subtotal - safeDiscount);
  const tax = (taxable * taxRate) / 100;
  const total = taxable + tax;

  function add(productId: string) {
    setCart((prev) => {
      const product = products.find((item) => item.id === productId);
      if (!product) return prev;
      const nextQty = (prev[productId] || 0) + 1;
      if (nextQty > product.stockQty) return prev;
      return { ...prev, [productId]: nextQty };
    });
  }

  function remove(productId: string) {
    setCart((prev) => {
      const nextQty = Math.max(0, (prev[productId] || 0) - 1);
      const next = { ...prev, [productId]: nextQty };
      if (nextQty === 0) delete next[productId];
      return next;
    });
  }

  async function checkout() {
    if (cartItems.length === 0 || submitting) return;
    setSubmitting(true);
    setError("");
    setMessage("");

    const payload = {
      items: cartItems.map((item) => ({
        productId: item.id,
        qty: item.qty
      })),
      discount: safeDiscount,
      paymentMethod,
      customerId: selectedCustomer?.id,
      customerType: selectedCustomer ? selectedCustomer.type : "WALK_IN",
      customerName: selectedCustomer ? selectedCustomer.name : "ลูกค้าขาจร"
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.items && Array.isArray(data.items)) {
          const detail = data.items
            .map((item: { name: string; required: number; stock: number }) => {
              return `${item.name} (ต้องการ ${item.required}, เหลือ ${item.stock})`;
            })
            .join(", ");
          throw new Error(`สต็อกไม่พอ: ${detail}`);
        }
        throw new Error(data.error ?? "Checkout failed");
      }

      setCart({});
      setDiscount(0);
      setSelectedCustomerId("WALK_IN");
      setMessage(`สร้างบิล ${data.orderNumber} แล้ว`);
      setReceiptOrderId(data.id);
      setRecentReceipts((prev) =>
        [
          {
            id: data.id,
            orderNumber: data.orderNumber,
            createdAt: data.createdAt,
            paymentMethod: data.paymentMethod,
            customerType: data.customerType,
            customerName: data.customerName,
            itemCount: data.itemCount,
            total: data.total
          },
          ...prev
        ].slice(0, 10)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot checkout");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card">
          <h2 className="mt-0 text-xl font-semibold">เมนูขาย</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => add(product.id)}
                className="secondary flex h-full flex-col items-start gap-2 rounded-xl p-3 text-left"
                disabled={product.stockQty <= 0}
              >
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-24 w-full rounded-lg border border-[var(--line)] object-cover"
                  />
                ) : (
                  <div className="grid h-24 w-full place-items-center rounded-lg border border-dashed border-[var(--line)] text-xs text-[var(--muted)]">
                    ไม่มีรูปสินค้า
                  </div>
                )}

                <div className="w-full">
                  <div className="font-semibold">{product.name}</div>
                  <div className="text-xs text-[var(--muted)]">{product.category || "Uncategorized"}</div>
                  <div className={`text-xs ${product.stockQty > 0 ? "text-[var(--muted)]" : "text-red-600"}`}>
                    คงเหลือ {product.stockQty}
                  </div>
                  <div className="mt-1">{formatCurrency(product.price, currency)}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="mt-0 text-xl font-semibold">ตะกร้า</h2>
          {cartItems.length === 0 ? <p className="text-[var(--muted)]">ยังไม่มีรายการ</p> : null}

          <div className="space-y-2">
            {cartItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-[var(--line)] p-2">
                <div>
                  <div>{item.name}</div>
                  <small className="text-[var(--muted)]">
                    {formatCurrency(item.price, currency)} x {item.qty}
                  </small>
                </div>
                <div className="flex items-center gap-1">
                  <button className="secondary px-2 py-1" onClick={() => remove(item.id)}>
                    -
                  </button>
                  <span className="min-w-7 text-center">{item.qty}</span>
                  <button className="secondary px-2 py-1" onClick={() => add(item.id)}>
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <div className="field">
              <label htmlFor="customerDropdown">ลูกค้า</label>
              <select
                id="customerDropdown"
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
              >
                <option value="WALK_IN">ลูกค้าขาจร</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({customer.type === "REGULAR" ? "ลูกค้าประจำ" : "ขาจร"})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="discount">ส่วนลด</label>
              <input
                id="discount"
                type="number"
                min={0}
                value={discount}
                onChange={(event) => setDiscount(Number(event.target.value))}
              />
            </div>

            <div className="field">
              <label htmlFor="payment">วิธีชำระเงิน</label>
              <select
                id="payment"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
              >
                <option value="CASH">เงินสด</option>
                <option value="CARD">บัตร</option>
                <option value="TRANSFER">โอนเงิน</option>
                <option value="QR">QR</option>
              </select>
            </div>
          </div>

          <table className="table mt-3">
            <tbody>
              <tr>
                <td>ยอดก่อนส่วนลด</td>
                <td>{formatCurrency(subtotal, currency)}</td>
              </tr>
              <tr>
                <td>ส่วนลด</td>
                <td>{formatCurrency(safeDiscount, currency)}</td>
              </tr>
              <tr>
                <td>ภาษี ({taxRate}%)</td>
                <td>{formatCurrency(tax, currency)}</td>
              </tr>
              <tr>
                <td>
                  <strong>ยอดสุทธิ</strong>
                </td>
                <td>
                  <strong>{formatCurrency(total, currency)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          <button onClick={checkout} disabled={cartItems.length === 0 || submitting} className="mt-3 w-full">
            {submitting ? "กำลังบันทึก..." : "ชำระเงินและออกใบเสร็จ"}
          </button>

          {message ? <p className="mt-2 text-[var(--ok)]">{message}</p> : null}
          {error ? <p className="mt-2 text-red-600">{error}</p> : null}
        </section>
      </div>

      <section className="card mt-4">
        <h2 className="mt-0 text-xl font-semibold">ใบเสร็จย้อนหลังล่าสุด (10 รายการ)</h2>
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>เลขที่บิล</th>
                <th>จำนวน</th>
                <th>ลูกค้า</th>
                <th>ชำระ</th>
                <th>ยอดสุทธิ</th>
                <th>ดู/พิมพ์</th>
              </tr>
            </thead>
            <tbody>
              {recentReceipts.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.createdAt)}</td>
                  <td>{row.orderNumber}</td>
                  <td>{row.itemCount}</td>
                  <td>{customerNameLabel(row)}</td>
                  <td>{row.paymentMethod}</td>
                  <td>{formatCurrency(row.total, currency)}</td>
                  <td>
                    <button className="secondary" type="button" onClick={() => setReceiptOrderId(row.id)}>
                      เปิด Modal
                    </button>
                  </td>
                </tr>
              ))}
              {recentReceipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-[var(--muted)]">
                    ยังไม่มีใบเสร็จ
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <ReceiptPreviewModal orderId={receiptOrderId} onClose={() => setReceiptOrderId(null)} />
    </>
  );
}
