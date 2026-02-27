"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { useRealtime } from "@/lib/use-realtime";

type Product = {
  id: string;
  sku?: string | null;
  name: string;
  category: string | null;
  imageUrl: string | null;
  price: number;
  stockQty: number;
  isActive?: boolean;
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
  products: initialProducts,
  categories: categoryMaster,
  customers,
  vatEnabled,
  taxRate,
  currency
}: CreateOrderClientProps) {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState("WALK_IN");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cartOpenMobile, setCartOpenMobile] = useState(false);
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

  const visibleProducts = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return categoryProducts;
    return categoryProducts.filter((item) =>
      [item.name, item.category || "", item.sku || ""].join(" ").toLowerCase().includes(keyword)
    );
  }, [categoryProducts, searchText]);

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

  const reloadProducts = useCallback(async () => {
    try {
      const response = await fetch("/api/products?active=1&limit=500", { cache: "no-store" });
      if (!response.ok) return;

      const rows = (await response.json()) as Product[];
      const activeRows = rows.filter((item) => item.isActive !== false);
      const stockByProductId = new Map(activeRows.map((item) => [item.id, item]));

      setProducts(activeRows);
      setCartLines((prev) =>
        prev
          .map((line) => {
            const nextProduct = stockByProductId.get(line.productId);
            if (!nextProduct) return null;
            const qty = Math.min(line.qty, nextProduct.stockQty);
            if (qty <= 0) return null;
            return {
              ...line,
              name: nextProduct.name,
              imageUrl: nextProduct.imageUrl,
              unitPrice: nextProduct.price,
              stockQty: nextProduct.stockQty,
              qty
            };
          })
          .filter((line): line is CartLine => line !== null)
      );
    } catch {
      // keep existing data when reload fails
    }
  }, []);

  useRealtime((event) => {
    if (
      event.type === "order.created" ||
      event.type === "order.updated" ||
      event.type === "stock.updated" ||
      event.type === "product.updated"
    ) {
      void reloadProducts();
    }
  });

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
          customerName: selectedCustomer ? selectedCustomer.name : "ลูกค้า",
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
      setCartOpenMobile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create order");
    } finally {
      setSubmitting(false);
    }
  }

  function renderOrderPanel(isMobile = false) {
    const idSuffix = isMobile ? "-mobile" : "-desktop";
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-xl font-semibold text-[var(--text)]">Current Order ({itemCount})</h2>
          <div className="flex items-center gap-2">
            <button type="button" className="secondary px-2 py-1 text-xs" onClick={clearCart} disabled={cartLines.length === 0}>
              Delete All
            </button>
            {isMobile ? (
              <button type="button" className="secondary px-2 py-1 text-xs" onClick={() => setCartOpenMobile(false)}>
                ปิด
              </button>
            ) : null}
          </div>
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
          <div className={`grid gap-2 ${isMobile ? "grid-cols-3 gap-1" : "grid-cols-3"}`}>
            <div className="field mb-0 space-y-1">
              <label htmlFor={`create-order-customer${idSuffix}`} className="text-[11px]">
                ลูกค้า
              </label>
              <select
                id={`create-order-customer${idSuffix}`}
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
                className={`h-9 px-2 py-1 text-xs ${isMobile ? "min-w-0 px-1.5 text-[11px]" : ""}`}
              >
                <option value="WALK_IN">ลูกค้า</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field mb-0 space-y-1">
              <label htmlFor={`create-order-payment${idSuffix}`} className="text-[11px]">
                ชำระเงิน
              </label>
              <select
                id={`create-order-payment${idSuffix}`}
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                className={`h-9 px-2 py-1 text-xs ${isMobile ? "min-w-0 px-1.5 text-[11px]" : ""}`}
              >
                <option value="CASH">เงินสด</option>
                <option value="CARD">บัตร</option>
                <option value="TRANSFER">โอนเงิน</option>
                <option value="QR">QR</option>
              </select>
            </div>

            <div className="field mb-0 space-y-1">
              <label htmlFor={`create-order-discount${idSuffix}`} className="text-[11px]">
                ส่วนลด
              </label>
              <input
                id={`create-order-discount${idSuffix}`}
                type="number"
                min={0}
                value={discount}
                onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))}
                className={`h-9 px-2 py-1 text-xs ${isMobile ? "min-w-0 px-1.5 text-[11px]" : ""}`}
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
      </div>
    );
  }

  return (
    <div className="w-full max-w-full space-y-4 overflow-x-hidden pb-20 lg:pb-0">
      <div className="grid w-full min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card min-w-0 space-y-3 overflow-x-hidden !p-3 sm:space-y-4 sm:!p-4">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
              {categoryTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveCategory(tab)}
                  className={`${activeCategory === tab ? "" : "secondary"} whitespace-nowrap rounded-full px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm`}
                >
                  {tab === "ALL" ? "ทั้งหมด" : tab}
                </button>
              ))}
            </div>
            <Link href="/" className="secondary shrink-0 rounded-lg px-3 py-2 text-sm">
              กลับหน้าหลัก
            </Link>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="ค้นหาเมนู / หมวด / SKU"
              className="w-full sm:max-w-md"
            />
            {searchText ? (
              <button type="button" className="secondary w-full whitespace-nowrap sm:w-auto" onClick={() => setSearchText("")}>
                ล้าง
              </button>
            ) : null}
          </div>

          <div className="grid w-full min-w-0 grid-cols-3 gap-1.5 min-[420px]:grid-cols-4 sm:gap-2 md:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6">
            {visibleProducts.map((product) => (
              <article
                key={product.id}
                className="group relative overflow-hidden rounded-lg border border-[var(--line)] bg-white p-1.5 transition duration-150 hover:bg-[#f9fafb] sm:rounded-xl sm:p-2"
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
                      className="aspect-square w-full rounded-md border border-[var(--line)] object-cover sm:rounded-lg"
                    />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center rounded-md border border-dashed border-[var(--line)] text-[10px] text-[var(--muted)] sm:rounded-lg sm:text-xs">
                      ไม่มีรูปสินค้า
                    </div>
                  )}

                  <div className="mt-1.5 space-y-0.5 sm:mt-2 sm:space-y-1">
                    <p className="m-0 line-clamp-2 text-[11px] font-semibold text-[var(--text)] sm:text-sm">{product.name}</p>
                    <p className="m-0 text-[10px] text-[var(--muted)] sm:text-xs">คงเหลือ {product.stockQty}</p>
                    <p className="m-0 text-xs font-bold text-[var(--brand)] sm:text-base">{formatCurrency(product.price, currency)}</p>
                  </div>
                </button>

                {product.stockQty <= 0 ? (
                  <div className="absolute inset-0 grid place-items-center bg-black/35 text-lg font-semibold text-white sm:text-2xl">Sold out</div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <aside className="card hidden lg:flex lg:sticky lg:top-6 lg:h-[calc(100dvh-48px)]">{renderOrderPanel()}</aside>
      </div>

      <button
        type="button"
        className="fixed bottom-4 right-4 z-30 rounded-full px-4 py-3 text-sm font-semibold shadow-sm lg:hidden"
        onClick={() => setCartOpenMobile(true)}
      >
        Order ({itemCount}) • {formatCurrency(total, currency)}
      </button>

      {cartOpenMobile ? (
        <div
          className="modal-overlay lg:hidden"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCartOpenMobile(false);
          }}
        >
          <div className="modal-panel flex h-[min(88dvh,760px)] w-full max-w-xl flex-col">{renderOrderPanel(true)}</div>
        </div>
      ) : null}
    </div>
  );
}
