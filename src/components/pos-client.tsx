"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  cost: number;
  stockQty: number;
};

type PosClientProps = {
  products: Product[];
  taxRate: number;
  currency: string;
};

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "QR";

export function PosClient({ products, taxRate, currency }: PosClientProps) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

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

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            productId: item.id,
            qty: item.qty
          })),
          discount: safeDiscount,
          paymentMethod
        })
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
      setMessage(`เปิดใบเสร็จ ${data.orderNumber} แล้ว`);

      window.open(`/receipt/${data.id}`, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot checkout");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>เมนูขาย</h2>
        <div className="grid grid-3">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => add(product.id)}
              className="secondary"
              disabled={product.stockQty <= 0}
              style={{ textAlign: "left", borderRadius: 14 }}
            >
              <div style={{ fontWeight: 600 }}>{product.name}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{product.category || "Uncategorized"}</div>
              <div style={{ fontSize: 12, color: product.stockQty > 0 ? "var(--muted)" : "crimson" }}>
                คงเหลือ {product.stockQty}
              </div>
              <div style={{ marginTop: 6 }}>{formatCurrency(product.price, currency)}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>ตะกร้า</h2>

        {cartItems.length === 0 ? <p style={{ color: "var(--muted)" }}>ยังไม่มีรายการ</p> : null}

        {cartItems.map((item) => (
          <div
            key={item.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 10,
              alignItems: "center",
              marginBottom: 8
            }}
          >
            <div>
              <div>{item.name}</div>
              <small style={{ color: "var(--muted)" }}>{formatCurrency(item.price, currency)} x {item.qty}</small>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button className="secondary" onClick={() => remove(item.id)}>
                -
              </button>
              <span>{item.qty}</span>
              <button className="secondary" onClick={() => add(item.id)}>
                +
              </button>
            </div>
          </div>
        ))}

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

        <table className="table" style={{ marginTop: 12 }}>
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
              <td><strong>ยอดสุทธิ</strong></td>
              <td><strong>{formatCurrency(total, currency)}</strong></td>
            </tr>
          </tbody>
        </table>

        <button onClick={checkout} disabled={cartItems.length === 0 || submitting} style={{ width: "100%", marginTop: 12 }}>
          {submitting ? "กำลังบันทึก..." : "ชำระเงินและออกใบเสร็จ"}
        </button>

        {message ? <p style={{ color: "var(--ok)" }}>{message}</p> : null}
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      </section>
    </div>
  );
}
