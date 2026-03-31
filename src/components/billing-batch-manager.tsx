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

/* ─────────────────────────── Icons ──────────────────────────── */
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconX = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCash = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M6 12h.01M18 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconCard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M2 10h20" stroke="currentColor" strokeWidth="2" />
    <path d="M6 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconTransfer = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 8l4-4 4 4M7 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21 16l-4 4-4-4M17 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconQR = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
    <path d="M14 14h3v3h-3zM17 17h4M17 20v1M20 14v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─────────────────────────── Helpers ──────────────────────────── */
function createLineId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `line-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function toDateTimeLocalValue(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: "CASH",     label: "เงินสด",  icon: <IconCash /> },
  { value: "CARD",     label: "บัตร",    icon: <IconCard /> },
  { value: "TRANSFER", label: "โอนเงิน", icon: <IconTransfer /> },
  { value: "QR",       label: "QR",      icon: <IconQR /> },
];

/* ═══════════════════════ Main Component ═══════════════════════ */
export function BillingBatchManager({ products, customers, currency }: BillingBatchManagerProps) {
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [dateTime, setDateTime] = useState(toDateTimeLocalValue());
  const [customerId, setCustomerId] = useState("WALK_IN");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [discount, setDiscount] = useState(0);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [cartOpenMobile, setCartOpenMobile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const categoryTabs = useMemo(() => {
    const unique = new Set<string>();
    for (const p of products) { if (p.category) unique.add(p.category); }
    return ["ALL", ...Array.from(unique)];
  }, [products]);

  const categoryProducts = useMemo(() => {
    if (activeCategory === "ALL") return products;
    return products.filter((p) => (p.category || "Uncategory") === activeCategory);
  }, [activeCategory, products]);

  const visibleProducts = useMemo(() => {
    const kw = searchText.trim().toLowerCase();
    if (!kw) return categoryProducts;
    return categoryProducts.filter((p) =>
      [p.name, p.category ?? "", p.sku ?? ""].join(" ").toLowerCase().includes(kw)
    );
  }, [categoryProducts, searchText]);

  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = useMemo(() =>
    items.reduce((sum, item) => {
      const p = productById.get(item.productId);
      return sum + (p ? p.price * item.qty : 0);
    }, 0),
  [items, productById]);
  const safeDiscount = Math.max(0, Math.min(discount, subtotal));
  const total = Math.max(0, subtotal - safeDiscount);

  /* ── Cart actions ── */
  function addToOrder(product: Product) {
    if (product.stockQty <= 0) return;
    setItems((prev) => {
      const idx = prev.findIndex((l) => l.productId === product.id && l.note.trim() === "");
      if (idx < 0) return [...prev, { lineId: createLineId(), productId: product.id, qty: 1, note: "" }];
      const next = [...prev];
      const t = next[idx];
      next[idx] = { ...t, qty: t.qty + 1 };
      return next;
    });
  }

  function updateQty(lineId: string, delta: number) {
    setItems((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        const p = productById.get(l.productId);
        return { ...l, qty: Math.max(0, Math.min(p?.stockQty ?? 999, l.qty + delta)) };
      }).filter((l) => l.qty > 0)
    );
  }

  function updateNote(lineId: string, value: string) {
    setItems((prev) => prev.map((l) => l.lineId === lineId ? { ...l, note: value } : l));
  }

  function clearCart() { setItems([]); }

  async function submitBill() {
    if (submitting) return;
    setMessage(""); setError("");
    if (!dateTime) { setError("กรุณาเลือกวันเวลา"); return; }
    if (items.length === 0) { setError("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ"); return; }

    const validItems = items
      .filter((i) => i.productId && i.qty > 0)
      .map((i) => ({ productId: i.productId, qty: Math.max(1, Math.trunc(i.qty)), note: i.note.trim() || undefined }));

    const selectedCustomer = customerId === "WALK_IN" ? null : customerById.get(customerId) ?? null;

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: validItems,
          discount: Math.max(0, Number(discount) || 0),
          paymentMethod,
          customerId: selectedCustomer?.id,
          customerType: selectedCustomer ? selectedCustomer.type : "WALK_IN",
          customerName: selectedCustomer?.name || "ลูกค้า",
          note: note.trim() || undefined,
          orderStatus: "PAID",
          billAt: new Date(dateTime).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cannot create order");
      setMessage(`บันทึกบิลสำเร็จ ${data.orderNumber}`);
      setItems([]); setNote(""); setDiscount(0); setCartOpenMobile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create order");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Cart Panel ── */
  function renderOrderPanel(isMobile = false) {
    const idSfx = isMobile ? "-m" : "-d";
    return (
      <div className="flex h-full flex-col" style={{ gap: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "color-mix(in srgb, var(--brand) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}>
              <IconCart />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>บิล</p>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)", lineHeight: 1.2 }}>{itemCount} ชิ้น</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {items.length > 0 && (
              <button type="button" onClick={clearCart} style={{ height: 32, padding: "0 10px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 500, background: "transparent", border: "1px solid var(--line)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, boxShadow: "none" }}>
                <IconTrash />ล้าง
              </button>
            )}
            {isMobile && (
              <button type="button" onClick={() => setCartOpenMobile(false)} aria-label="ปิด" style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "1px solid var(--line)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "none", padding: 0 }}>
                <IconX />
              </button>
            )}
          </div>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {items.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--muted)", padding: "40px 0" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.6 }}>
                <IconCart />
              </div>
              <p style={{ margin: 0, fontSize: "0.82rem", textAlign: "center" }}>ยังไม่มีสินค้า<br />แตะสินค้าเพื่อเพิ่มลงบิล</p>
            </div>
          ) : items.map((item) => {
            const p = productById.get(item.productId);
            return (
              <div key={item.lineId} style={{ borderRadius: 12, border: "1px solid var(--line)", background: "#fff", overflow: "hidden" }}>
                {/* Item row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
                  {p?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} style={{ width: 40, height: 40, borderRadius: 7, objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 7, border: "1px dashed var(--line)", flexShrink: 0, background: "var(--bg)" }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.name || "-"}</p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>{p ? formatCurrency(p.price, currency) : "-"}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <button type="button" onClick={() => updateQty(item.lineId, -1)} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "none", padding: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="#1a1614" strokeWidth="2.5" strokeLinecap="round" /></svg>
                    </button>
                    <span style={{ minWidth: 22, textAlign: "center", fontSize: "0.875rem", fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{item.qty}</span>
                    <button type="button" onClick={() => updateQty(item.lineId, +1)} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "var(--brand)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "none", padding: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></svg>
                    </button>
                  </div>
                  <p style={{ margin: 0, minWidth: 54, textAlign: "right", fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    {p ? formatCurrency(p.price * item.qty, currency) : "-"}
                  </p>
                </div>
                {/* Note row */}
                <div style={{ borderTop: "1px solid var(--line)", padding: "6px 10px" }}>
                  <input
                    value={item.note}
                    onChange={(e) => updateNote(item.lineId, e.target.value)}
                    placeholder="หมายเหตุรายการ..."
                    style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontSize: "0.72rem", color: "var(--text)", outline: "none" }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer summary */}
        <div style={{ borderTop: "1px solid var(--line)", padding: "14px 16px 16px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* DateTime */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor={`dt${idSfx}`} style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>วัน / เวลาของบิล</label>
            <input
              id={`dt${idSfx}`}
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              style={{ height: 36, borderRadius: 8, border: "1px solid var(--line)", fontSize: "0.8rem", padding: "0 8px", background: "#fff", color: "var(--text)" }}
            />
          </div>

          {/* Customer + Discount */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label htmlFor={`cust${idSfx}`} style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>ลูกค้า</label>
              <select id={`cust${idSfx}`} value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ height: 36, borderRadius: 8, border: "1px solid var(--line)", fontSize: "0.8rem", padding: "0 8px", background: "#fff", color: "var(--text)" }}>
                <option value="WALK_IN">ลูกค้า</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label htmlFor={`disc${idSfx}`} style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>ส่วนลด</label>
              <input id={`disc${idSfx}`} type="number" min={0} value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} style={{ height: 36, borderRadius: 8, border: "1px solid var(--line)", fontSize: "0.8rem", padding: "0 8px", background: "#fff", color: "var(--text)" }} />
            </div>
          </div>

          {/* Bill note */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor={`note${idSfx}`} style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>หมายเหตุบิล</label>
            <input id={`note${idSfx}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ..." style={{ height: 36, borderRadius: 8, border: "1px solid var(--line)", fontSize: "0.8rem", padding: "0 8px", background: "#fff", color: "var(--text)" }} />
          </div>

          {/* Payment method */}
          <div>
            <p style={{ margin: "0 0 6px", fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>ชำระเงิน</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  style={{
                    height: 48, borderRadius: 10,
                    border: paymentMethod === opt.value ? "2px solid var(--brand)" : "1px solid var(--line)",
                    background: paymentMethod === opt.value ? "color-mix(in srgb, var(--brand) 10%, transparent)" : "#fff",
                    color: paymentMethod === opt.value ? "var(--brand)" : "var(--muted)",
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                    fontSize: "0.62rem", fontWeight: 600, transition: "all 130ms ease", boxShadow: "none", padding: 0,
                  }}
                >
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price summary */}
          <div style={{ background: "var(--bg)", borderRadius: 12, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--muted)" }}>
              <span>ยอดก่อนส่วนลด</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(subtotal, currency)}</span>
            </div>
            {safeDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--muted)" }}>
                <span>ส่วนลด</span>
                <span style={{ color: "#16a34a", fontVariantNumeric: "tabular-nums" }}>−{formatCurrency(safeDiscount, currency)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--line)", alignItems: "baseline" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}>ยอดสุทธิ</span>
              <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--brand)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{formatCurrency(total, currency)}</span>
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={() => void submitBill()}
            disabled={submitting || items.length === 0}
            style={{
              width: "100%", height: 50, borderRadius: 12, border: "none",
              background: items.length === 0 ? "var(--line)" : "var(--brand)",
              color: items.length === 0 ? "var(--muted)" : "#fff",
              fontSize: "0.95rem", fontWeight: 700,
              cursor: items.length === 0 ? "not-allowed" : "pointer",
              transition: "all 150ms ease", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {submitting ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                กำลังบันทึก...
              </>
            ) : "บันทึกบิล"}
          </button>

          {message && (
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#16a34a", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {message}
            </p>
          )}
          {error && (
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════ Render ══════════════════════════ */
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .bb-product-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .bb-product-card:active { transform: scale(0.97); }
      `}</style>

      <div style={{ width: "100%", maxWidth: "100%", overflowX: "hidden", paddingBottom: 80 }} className="lg:pb-0">
        <div style={{ display: "grid", width: "100%" }} className="lg:grid-cols-[1fr_360px]">

          {/* ── Left: Product Browser ── */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>

            {/* Sticky header */}
            <div style={{ padding: "14px 16px 0", position: "sticky", top: 0, zIndex: 20, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>

              {/* Page title row + search */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: "0 0 auto" }}>
                  <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.2, whiteSpace: "nowrap" }}>ลงบิลย้อนหลัง</h1>
                </div>
                <div style={{ flex: 1, position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "flex", pointerEvents: "none" }}><IconSearch /></span>
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="ค้นหาสินค้า / หมวด / SKU..."
                    style={{ width: "100%", height: 38, paddingLeft: 34, paddingRight: searchText ? 34 : 12, borderRadius: 9, border: "1px solid var(--line)", fontSize: "0.875rem", background: "#fff", color: "var(--text)" }}
                  />
                  {searchText && (
                    <button type="button" onClick={() => setSearchText("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "flex", padding: 2, boxShadow: "none" }}>
                      <IconX size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Category pills */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 12 }}>
                {categoryTabs.map((tab) => {
                  const active = activeCategory === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveCategory(tab)}
                      style={{
                        height: 34, padding: "0 14px", borderRadius: 17,
                        border: active ? "2px solid var(--brand)" : "1px solid var(--line)",
                        background: active ? "var(--brand)" : "#fff",
                        color: active ? "#fff" : "var(--muted)",
                        fontSize: "0.82rem", fontWeight: active ? 700 : 400, whiteSpace: "nowrap", cursor: "pointer",
                        transition: "all 130ms ease", flexShrink: 0, boxShadow: "none",
                      }}
                    >
                      {tab === "ALL" ? "ทั้งหมด" : tab}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product grid */}
            <div style={{ padding: "14px 16px", display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
              {visibleProducts.length === 0 && (
                <div style={{ gridColumn: "1/-1", padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
                  ไม่พบสินค้าที่ค้นหา
                </div>
              )}
              {visibleProducts.map((product) => {
                const outOfStock = product.stockQty <= 0;
                const lowStock = product.stockQty > 0 && product.stockQty <= 5;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToOrder(product)}
                    disabled={outOfStock}
                    className="bb-product-card"
                    style={{
                      position: "relative", display: "flex", flexDirection: "column", alignItems: "stretch",
                      padding: 0, borderRadius: 14, border: "1px solid var(--line)", background: "#fff",
                      cursor: outOfStock ? "not-allowed" : "pointer", opacity: outOfStock ? 0.6 : 1,
                      textAlign: "left", overflow: "hidden", transition: "transform 120ms ease, box-shadow 120ms ease",
                      boxShadow: "none",
                    }}
                  >
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.name} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block", borderBottom: "1px solid var(--line)" }} />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "1/1", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>ไม่มีรูปสินค้า</span>
                      </div>
                    )}
                    <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{product.name}</p>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 4 }}>
                        <p style={{ margin: 0, fontSize: "0.68rem", color: outOfStock ? "#dc2626" : lowStock ? "#d97706" : "var(--muted)" }}>
                          {outOfStock ? "หมด" : `เหลือ ${product.stockQty}`}
                        </p>
                        <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 800, color: "var(--brand)", fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(product.price, currency)}
                        </p>
                      </div>
                    </div>
                    {outOfStock && (
                      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ background: "#1a1614", color: "#fff", fontSize: "0.7rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>สินค้าหมด</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: Cart (desktop) ── */}
          <aside
            style={{ borderLeft: "1px solid var(--line)", background: "#fff" }}
            className="hidden lg:flex lg:sticky lg:top-0 lg:h-dvh lg:flex-col"
          >
            {renderOrderPanel()}
          </aside>
        </div>

        {/* Mobile: floating cart button */}
        <button
          type="button"
          onClick={() => setCartOpenMobile(true)}
          className="flex lg:hidden"
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 40,
            height: 54, padding: "0 20px", borderRadius: 27,
            background: "var(--brand)", border: "none",
            color: "#fff", fontSize: "0.9rem", fontWeight: 700,
            alignItems: "center", gap: 10,
            boxShadow: "0 6px 24px rgba(212,43,43,0.35)", cursor: "pointer",
          }}
        >
          <IconCart />
          บิล {itemCount > 0 && (
            <span style={{ background: "#fff", color: "var(--brand)", borderRadius: 99, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800 }}>
              {itemCount}
            </span>
          )}
        </button>

        {/* Mobile: cart drawer */}
        {cartOpenMobile && (
          <>
            <style>{`@keyframes _slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
            <div
              className="flex lg:hidden"
              style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", flexDirection: "column", justifyContent: "flex-end" }}
              onClick={(e) => { if (e.target === e.currentTarget) setCartOpenMobile(false); }}
            >
              <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "90dvh", display: "flex", flexDirection: "column", animation: "_slideUp 280ms cubic-bezier(0.32, 0.72, 0, 1) both" }}>
                {renderOrderPanel(true)}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}


