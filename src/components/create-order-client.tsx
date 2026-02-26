"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  price: number;
  stockQty: number;
};

type Category = {
  id: string;
  name: string;
};

type Customer = {
  id: string;
  name: string;
  type: "WALK_IN" | "REGULAR";
};

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "QR";

type CartLine = {
  lineId: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  qty: number;
  stockQty: number;
};

type CreateOrderClientProps = {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  vatEnabled: boolean;
  taxRate: number;
  currency: string;
};

function createLineId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function CreateOrderClient({
  products,
  categories: categoryMaster,
  customers,
  vatEnabled,
  taxRate,
  currency
}: CreateOrderClientProps) {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState("WALK_IN");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const categoryTabs = useMemo(() => {
    const unique = new Set<string>();
    for (const category of categoryMaster) unique.add(category.name);
    for (const product of products) {
      if (product.category) unique.add(product.category);
    }
    return ["ALL", ...Array.from(unique)];
  }, [categoryMaster, products]);

  const categoryProducts = useMemo(() => {
    if (activeCategory === "ALL") return products;
    return products.filter((item) => (item.category || "Uncategory") === activeCategory);
  }, [activeCategory, products]);

  const visibleProducts = categoryProducts;

  const itemCount = cartLines.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cartLines.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  const safeDiscount = Math.max(0, Math.min(discount, subtotal));
  const taxable = Math.max(0, subtotal - safeDiscount);
  const tax = vatEnabled ? (taxable * taxRate) / 100 : 0;
  const total = taxable + tax;

  function addToOrder(product: Product) {
    if (product.stockQty <= 0) return;

    setCartLines((prev) => {
      const index = prev.findIndex((line) => line.productId === product.id);
      if (index < 0) {
        return [
          ...prev,
          {
            lineId: createLineId(),
            productId: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            unitPrice: product.price,
            qty: 1,
            stockQty: product.stockQty
          }
        ];
      }

      const next = [...prev];
      const target = next[index];
      if (target.qty >= target.stockQty) return prev;
      next[index] = { ...target, qty: target.qty + 1 };
      return next;
    });
  }

  function updateQty(lineId: string, delta: number) {
    setCartLines((prev) =>
      prev
        .map((line) => {
          if (line.lineId !== lineId) return line;
          const nextQty = Math.max(0, Math.min(line.stockQty, line.qty + delta));
          return { ...line, qty: nextQty };
        })
        .filter((line) => line.qty > 0)
    );
  }

  function clearCart() {
    setCartLines([]);
  }

  async function createOrder() {
    if (submitting) return;
    if (cartLines.length === 0) {
      setError("ยังไม่มีสินค้าในออเดอร์");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: cartLines.map((line) => ({
            productId: line.productId,
            qty: line.qty
          })),
          discount: safeDiscount,
          paymentMethod,
          orderStatus: "PAID",
          customerId: selectedCustomer?.id,
          customerType: selectedCustomer ? selectedCustomer.type : "WALK_IN",
          customerName: selectedCustomer ? selectedCustomer.name : "ลูกค้าขาจร",
          note: "Create Order Screen"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Cannot create order");
      }

      setMessage(`สร้างออเดอร์สำเร็จ ${data.orderNumber}`);
      setCartLines([]);
      setDiscount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Link href="/" className="secondary rounded-lg px-3 py-2 text-sm">
          กลับหน้าหลัก
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categoryTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveCategory(tab)}
                className={`${activeCategory === tab ? "" : "secondary"} whitespace-nowrap rounded-full px-4 py-2 text-sm`}
              >
                {tab === "ALL" ? "ทั้งหมด" : tab}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className="group relative overflow-hidden rounded-xl border border-[var(--line)] bg-white p-3 transition duration-150 hover:bg-[#f9fafb]"
              >
                <button
                  type="button"
                  onClick={() => addToOrder(product)}
                  disabled={product.stockQty <= 0}
                  className="secondary w-full flex-col items-start rounded-lg border border-transparent bg-transparent p-0 text-left"
                >
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-28 w-full rounded-lg border border-[var(--line)] object-cover"
                    />
                  ) : (
                    <div className="grid h-28 w-full place-items-center rounded-lg border border-dashed border-[var(--line)] text-xs text-[var(--muted)]">
                      ไม่มีรูปสินค้า
                    </div>
                  )}

                  <div className="mt-2 space-y-1">
                    <p className="m-0 font-semibold text-[var(--text)]">{product.name}</p>
                    <p className="m-0 text-xs text-[var(--muted)]">คงเหลือ {product.stockQty}</p>
                    <p className="m-0 text-xl font-bold text-[var(--brand)]">{formatCurrency(product.price, currency)}</p>
                  </div>
                </button>

                {product.stockQty <= 0 ? (
                  <div className="absolute inset-0 grid place-items-center bg-black/35 text-2xl font-semibold text-white">Sold out</div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <aside className="card flex flex-col xl:sticky xl:top-6 xl:h-[calc(100dvh-48px)]">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-2xl font-semibold text-[var(--text)]">Current Order ({itemCount})</h2>
            <button type="button" className="secondary px-2 py-1 text-xs" onClick={clearCart} disabled={cartLines.length === 0}>
              Delete All
            </button>
          </div>

          <div className="mt-3 flex-1 space-y-2 overflow-auto pr-1">
            {cartLines.length === 0 ? <p className="text-sm text-[var(--muted)]">ยังไม่มีสินค้าในออเดอร์</p> : null}
            {cartLines.map((line) => (
              <article key={line.lineId} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {line.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.imageUrl} alt={line.name} className="h-10 w-10 rounded-lg border border-[var(--line)] object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg border border-dashed border-[var(--line)]" />
                    )}
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-semibold text-[var(--text)]">{line.name}</p>
                      <p className="m-0 text-xs text-[var(--muted)]">{formatCurrency(line.unitPrice, currency)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button type="button" className="secondary h-7 w-7 p-0 text-xs" onClick={() => updateQty(line.lineId, -1)}>
                      -
                    </button>
                    <span className="min-w-5 text-center text-sm font-semibold">{line.qty}</span>
                    <button type="button" className="secondary h-7 w-7 p-0 text-xs" onClick={() => updateQty(line.lineId, 1)}>
                      +
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="field mb-0 space-y-1">
                <label htmlFor="create-order-customer" className="text-[11px]">
                  ลูกค้า
                </label>
                <select
                  id="create-order-customer"
                  value={selectedCustomerId}
                  onChange={(event) => setSelectedCustomerId(event.target.value)}
                  className="h-9 px-2 py-1 text-xs"
                >
                  <option value="WALK_IN">ลูกค้าขาจร</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field mb-0 space-y-1">
                <label htmlFor="create-order-payment" className="text-[11px]">
                  ชำระเงิน
                </label>
                <select
                  id="create-order-payment"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  className="h-9 px-2 py-1 text-xs"
                >
                  <option value="CASH">เงินสด</option>
                  <option value="CARD">บัตร</option>
                  <option value="TRANSFER">โอนเงิน</option>
                  <option value="QR">QR</option>
                </select>
              </div>

              <div className="field mb-0 space-y-1">
                <label htmlFor="create-order-discount" className="text-[11px]">
                  ส่วนลด
                </label>
                <input
                  id="create-order-discount"
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))}
                  className="h-9 px-2 py-1 text-xs"
                />
              </div>
            </div>

            <table className="table">
              <tbody>
                <tr>
                  <td>Subtotal</td>
                  <td>{formatCurrency(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td>Discount total</td>
                  <td>{formatCurrency(safeDiscount, currency)}</td>
                </tr>
                <tr>
                  <td>{vatEnabled ? `Tax (${taxRate}%)` : "Tax (ปิด VAT)"}</td>
                  <td>{formatCurrency(tax, currency)}</td>
                </tr>
                <tr>
                  <td className="text-base font-semibold">Total</td>
                  <td className="text-lg font-bold">{formatCurrency(total, currency)}</td>
                </tr>
              </tbody>
            </table>

            <button type="button" className="w-full" disabled={submitting || cartLines.length === 0} onClick={() => void createOrder()}>
              {submitting ? "กำลังบันทึก..." : "Create Order"}
            </button>

            {message ? <p className="m-0 text-sm text-[var(--ok)]">{message}</p> : null}
            {error ? <p className="m-0 text-sm text-red-600">{error}</p> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
