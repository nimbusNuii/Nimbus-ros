"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";
import { useRealtime } from "@/lib/use-realtime";

/* ══════════════════════════════════════════════════════════════════════
   Types
══════════════════════════════════════════════════════════════════════ */
type Product = {
  id: string; sku?: string | null;
  name: string; category: string | null;
  imageUrl: string | null; price: number; stockQty: number; isActive?: boolean;
};
type Category  = { id: string; name: string };
type Customer  = { id: string; name: string; type: "WALK_IN" | "REGULAR" };
type PaymentChannel = { id: string; name: string; type: "CASH" | "CARD" | "TRANSFER" | "QR" };
type PayMethod = "CASH" | "CARD" | "TRANSFER" | "QR";
type CartLine  = {
  lineId: string; productId: string; name: string; imageUrl: string | null;
  unitPrice: number; qty: number; stockQty: number;
};
type Props = {
  products: Product[]; categories: Category[]; customers: Customer[];
  paymentChannels: PaymentChannel[];
  vatEnabled: boolean; taxRate: number; currency: string;
};

/* ══════════════════════════════════════════════════════════════════════
   Icons
══════════════════════════════════════════════════════════════════════ */
const IcSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IcX = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IcTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcCart = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcBack = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcCash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M6 12h.01M18 12h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IcCard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M2 10h20" stroke="currentColor" strokeWidth="2"/>
    <path d="M6 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IcTransfer = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 8l4-4 4 4M7 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M21 16l-4 4-4-4M17 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcQR = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
    <path d="M14 14h3v3h-3zM17 17h4M17 20v1M20 14v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcWarn = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IcSpin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: "pos-spin .75s linear infinite" }}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25"/>
    <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

/* ══════════════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════════════ */
function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `l-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getPaymentIcon(type: PayMethod): React.ReactNode {
  if (type === "CASH") return <IcCash />;
  if (type === "CARD") return <IcCard />;
  if (type === "TRANSFER") return <IcTransfer />;
  return <IcQR />;
}

/* ══════════════════════════════════════════════════════════════════════
   CSS (scoped to .pos-root)
══════════════════════════════════════════════════════════════════════ */
const CSS = `
@keyframes pos-spin { to { transform: rotate(360deg); } }
@keyframes pos-slide-up {
  from { transform: translateY(40px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes pos-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── root: full viewport ── */
.pos-root {
  position: fixed;
  inset: 0;
  display: flex;
  background: var(--bg);
  overflow: hidden;
  font-family: var(--font-sarabun), system-ui, sans-serif;
}

/* ── Left: category sidebar (desktop ≥1024) ── */
.pos-sidebar {
  display: none;
}
@media (min-width: 1024px) {
  .pos-sidebar {
    display: flex;
    flex-direction: column;
    width: 168px;
    border-right: 1px solid var(--line);
    background: #fff;
    flex-shrink: 0;
    overflow: hidden;
  }
}

.pos-sidebar-head {
  padding: 14px 12px 12px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.pos-sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 8px 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}

.pos-cat-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 100ms, color 100ms;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}
.pos-cat-btn:hover { background: var(--bg-subtle); color: var(--text); }
.pos-cat-btn.is-active {
  background: var(--brand-light);
  color: var(--brand);
  font-weight: 700;
}

/* ── Center: product browser ── */
.pos-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* ── Topbar ── */
.pos-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  background: #fff;
  flex-shrink: 0;
  min-height: 56px;
}

.pos-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--muted);
  background: #fff;
  flex-shrink: 0;
  white-space: nowrap;
  text-decoration: none;
  transition: background 100ms;
}
.pos-back-btn:hover { background: var(--bg-subtle); }
@media (min-width: 1024px) { .pos-back-btn { display: none; } }

.pos-search-wrap {
  flex: 1;
  position: relative;
  min-width: 0;
}
.pos-search-wrap svg {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.pos-search-input {
  width: 100%;
  height: 36px;
  border-radius: 9px;
  border: 1px solid var(--line);
  padding: 0 10px 0 34px;
  font-size: 0.85rem;
  background: var(--bg-subtle);
  color: var(--text);
  transition: border-color 150ms, background 150ms;
  outline: none;
}
.pos-search-input:focus {
  border-color: var(--brand);
  background: #fff;
  box-shadow: 0 0 0 3px var(--input-ring);
}
.pos-search-input::placeholder { color: var(--muted-light); }

/* mobile cart trigger in topbar */
.pos-topbar-cart {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border-radius: 18px;
  border: none;
  background: var(--brand);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
  transition: background 100ms;
}
.pos-topbar-cart:active { background: var(--brand-dark); }
@media (min-width: 768px) { .pos-topbar-cart { display: none; } }

/* ── Category tabs (≤1023) ── */
.pos-tabs {
  display: flex;
  gap: 6px;
  padding: 10px 14px;
  overflow-x: auto;
  border-bottom: 1px solid var(--line);
  background: var(--bg-subtle);
  flex-shrink: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.pos-tabs::-webkit-scrollbar { display: none; }
@media (min-width: 1024px) { .pos-tabs { display: none; } }

.pos-tab {
  height: 32px;
  padding: 0 14px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 120ms;
}
.pos-tab:hover { background: var(--bg-subtle); color: var(--text); }
.pos-tab.is-active {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
  font-weight: 700;
}

/* ── Product grid ── */
.pos-grid-scroll {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  /* Safari iOS momentum */
  -webkit-overflow-scrolling: touch;
}

.pos-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px;
  align-content: start;
}
@media (min-width: 400px)  { .pos-grid { grid-template-columns: repeat(5,1fr); } }
@media (min-width: 600px)  { .pos-grid { grid-template-columns: repeat(6,1fr); gap:10px; padding:14px; } }
@media (min-width: 768px)  { .pos-grid { grid-template-columns: repeat(4,1fr); padding:12px; gap:8px; } }
@media (min-width: 900px)  { .pos-grid { grid-template-columns: repeat(5,1fr); } }
@media (min-width: 1100px) { .pos-grid { grid-template-columns: repeat(6,1fr); } }
@media (min-width: 1300px) { .pos-grid { grid-template-columns: repeat(5,1fr); } }
@media (min-width: 1500px) { .pos-grid { grid-template-columns: repeat(6,1fr); } }

.pos-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1.5px solid var(--line);
  background: #fff;
  text-align: left;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.pos-card:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.09);
  border-color: var(--brand);
}
.pos-card:not(:disabled):active { transform: scale(0.96); }
.pos-card:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 2px;
}

.pos-card-in-cart { border-color: var(--brand) !important; }

.pos-card-img {
  width: 100%;
  aspect-ratio: 1/1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--line);
  overflow: hidden;
  position: relative;
}
.pos-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }

.pos-card-qty-badge {
  position: absolute;
  top: 6px; right: 6px;
  min-width: 22px; height: 22px;
  border-radius: 11px;
  background: var(--brand);
  color: #fff;
  font-size: 0.72rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  padding: 0 5px;
  box-shadow: 0 2px 6px rgba(212,43,43,0.45);
  font-variant-numeric: tabular-nums;
  animation: pos-slide-up 200ms cubic-bezier(0.16,1,0.3,1);
}

.pos-card-info { padding: 5px 8px 7px; }
.pos-card-name {
  margin: 0;
  font-size: 0.72rem; font-weight: 600;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--text);
}
.pos-card-price {
  margin: 3px 0 0;
  font-size: 0.8rem; font-weight: 800;
  color: var(--brand);
  font-variant-numeric: tabular-nums;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pos-card-stock {
  margin: 1px 0 0;
  font-size: 0.6rem;
  font-variant-numeric: tabular-nums;
}

.pos-oos-overlay {
  position: absolute; inset: 0;
  background: rgba(255,255,255,0.72);
  display: flex; align-items: center; justify-content: center;
  border-radius: inherit;
}
.pos-oos-label {
  background: #1a1614; color: #fff;
  font-size: 0.68rem; font-weight: 700;
  padding: 3px 12px; border-radius: 20px;
  letter-spacing: .04em;
}

/* ── Right: Cart panel (≥768) ── */
.pos-cart-panel {
  display: none;
}
@media (min-width: 768px) {
  .pos-cart-panel {
    display: flex;
    flex-direction: column;
    width: 310px;
    border-left: 1px solid var(--line);
    background: #fff;
    flex-shrink: 0;
    overflow: hidden;
  }
}
@media (min-width: 1024px) { .pos-cart-panel { width: 350px; } }
@media (min-width: 1280px) { .pos-cart-panel { width: 390px; } }

/* ── Cart items list ── */
.pos-cart-items {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 0;
}

.pos-cart-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #fff;
  min-height: 62px;
  transition: border-color 100ms;
}
.pos-cart-row:hover { border-color: var(--line-strong); }

/* ── Mobile: Floating cart button ── */
.pos-fab {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 22px;
  border-radius: 26px;
  border: none;
  background: var(--brand);
  color: #fff;
  font-size: 0.88rem; font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 24px rgba(212,43,43,0.42);
  z-index: 40;
  white-space: nowrap;
  transition: transform 120ms ease, box-shadow 120ms ease;
  -webkit-tap-highlight-color: transparent;
}
.pos-fab:active { transform: translateX(-50%) scale(0.96); box-shadow: 0 2px 12px rgba(212,43,43,0.35); }
@media (min-width: 768px) { .pos-fab { display: none; } }

/* ── Mobile: Cart bottom sheet ── */
.pos-overlay {
  position: fixed; inset: 0;
  background: rgba(20,12,10,0.52);
  z-index: 50;
  display: flex;
  align-items: flex-end;
  animation: pos-fade-in 200ms ease;
}
@media (min-width: 768px) { .pos-overlay { display: none !important; } }

.pos-sheet {
  width: 100%;
  max-height: 92dvh;
  background: #fff;
  border-radius: 20px 20px 0 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: pos-slide-up 260ms cubic-bezier(0.16,1,0.3,1);
}
.pos-sheet-handle {
  width: 38px; height: 4px;
  border-radius: 2px;
  background: var(--line-strong);
  margin: 10px auto 0;
  flex-shrink: 0;
}

/* ── Stepper buttons ── */
.pos-step-btn {
  width: 28px; height: 28px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; font-weight: 700; line-height: 1;
  flex-shrink: 0;
  transition: background 80ms, transform 80ms;
  -webkit-tap-highlight-color: transparent;
}
.pos-step-btn:active:not(:disabled) { transform: scale(0.9); }
.pos-step-btn.add-btn {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
}
.pos-step-btn.add-btn:disabled {
  background: var(--bg-subtle);
  color: var(--muted);
  border-color: var(--line);
  cursor: not-allowed;
}

/* ── Empty cart ── */
.pos-cart-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
  padding: 40px 20px;
  text-align: center;
}

/* ── Form elements ── */
.pos-input, .pos-select {
  width: 100%;
  height: 34px;
  border-radius: 7px;
  border: 1px solid var(--line);
  padding: 0 8px;
  font-size: 0.8rem;
  background: var(--bg-subtle);
  color: var(--text);
  outline: none;
  transition: border-color 150ms, background 150ms;
  font-family: inherit;
}
.pos-input:focus, .pos-select:focus {
  border-color: var(--brand);
  background: #fff;
  box-shadow: 0 0 0 3px var(--input-ring);
}

/* ── Pay method buttons ── */
.pos-pay-btn {
  height: 46px;
  border-radius: 9px;
  border: 1.5px solid var(--line);
  background: #fff;
  color: var(--muted);
  cursor: pointer;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 2px;
  font-size: 0.62rem; font-weight: 600;
  transition: all 120ms;
  -webkit-tap-highlight-color: transparent;
}
.pos-pay-btn.is-active {
  background: var(--brand-light);
  color: var(--brand);
  border-color: var(--brand);
  border-width: 2px;
}

/* ── Submit button ── */
.pos-submit {
  flex: 1;
  height: 50px;
  border-radius: 12px;
  border: none;
  background: var(--brand);
  color: #fff;
  font-size: 0.92rem; font-weight: 700;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  gap: 7px;
  transition: background 120ms, transform 120ms;
  -webkit-tap-highlight-color: transparent;
}
.pos-submit:disabled {
  background: var(--line);
  color: var(--muted);
  cursor: not-allowed;
}
.pos-submit:not(:disabled):active { transform: scale(0.98); background: var(--brand-dark); }

/* ── Sidebar back button ── */
.pos-sidebar-back {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  font-size: 0.8rem; font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background 100ms;
}
.pos-sidebar-back:hover { background: var(--bg-subtle); color: var(--text); }
`;

/* ══════════════════════════════════════════════════════════════════════
   Component
══════════════════════════════════════════════════════════════════════ */
export function CreateOrderClient({
  products: init, categories: catMaster, customers, paymentChannels,
  vatEnabled, taxRate, currency,
}: Props) {
  const [activeCat, setActiveCat]   = useState("ALL");
  const [search, setSearch]         = useState("");
  const [products, setProducts]     = useState<Product[]>(init);
  const [cart, setCart]             = useState<CartLine[]>([]);
  const [discount, setDiscount]     = useState(0);
  const [custId, setCustId]         = useState("WALK_IN");
  const [payChannelId, setPayChannelId] = useState(paymentChannels[0]?.id || "");
  const [cartOpen, setCartOpen]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage]       = useState("");
  const [error, setError]           = useState("");

  const customer = useMemo(
    () => customers.find(c => c.id === custId) ?? null,
    [customers, custId]
  );

  const payOpts = useMemo(() => {
    return paymentChannels.map(ch => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      icon: getPaymentIcon(ch.type)
    }));
  }, [paymentChannels]);

  const selectedChannel = useMemo(
    () => paymentChannels.find(ch => ch.id === payChannelId),
    [paymentChannels, payChannelId]
  );

  const catTabs = useMemo(() => {
    const s = new Set<string>();
    catMaster.forEach(c => s.add(c.name));
    products.forEach(p => { if (p.category) s.add(p.category); });
    return ["ALL", ...Array.from(s)];
  }, [catMaster, products]);

  const visible = useMemo(() => {
    let list = activeCat === "ALL" ? products
      : products.filter(p => (p.category ?? "Uncategory") === activeCat);
    const kw = search.trim().toLowerCase();
    if (kw) list = list.filter(p =>
      [p.name, p.category ?? "", p.sku ?? ""].join(" ").toLowerCase().includes(kw)
    );
    return list;
  }, [products, activeCat, search]);

  /* ── Totals ── */
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);
  const subtotal  = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const safeDsc   = Math.max(0, Math.min(discount, subtotal));
  const taxable   = Math.max(0, subtotal - safeDsc);
  const tax       = vatEnabled ? (taxable * taxRate) / 100 : 0;
  const total     = taxable + tax;

  /* ── Cart actions ── */
  function addItem(p: Product) {
    if (p.stockQty <= 0) return;
    setCart(prev => {
      const idx = prev.findIndex(l => l.productId === p.id);
      if (idx < 0) return [...prev, {
        lineId: uid(), productId: p.id, name: p.name,
        imageUrl: p.imageUrl, unitPrice: p.price, qty: 1, stockQty: p.stockQty,
      }];
      const next = [...prev]; const t = next[idx];
      if (t.qty >= t.stockQty) return prev;
      next[idx] = { ...t, qty: t.qty + 1 };
      return next;
    });
  }

  function changeQty(lineId: string, delta: number) {
    setCart(prev =>
      prev.map(l => l.lineId !== lineId ? l
        : { ...l, qty: Math.max(0, Math.min(l.stockQty, l.qty + delta)) }
      ).filter(l => l.qty > 0)
    );
  }

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/products?active=1&limit=500", { cache: "no-store" });
      if (!res.ok) return;
      const rows = (await res.json()) as Product[];
      const active = rows.filter(r => r.isActive !== false);
      const byId   = new Map(active.map(r => [r.id, r]));
      setProducts(active);
      setCart(prev =>
        prev.map(l => {
          const p = byId.get(l.productId); if (!p) return null;
          const qty = Math.min(l.qty, p.stockQty); if (qty <= 0) return null;
          return { ...l, name: p.name, imageUrl: p.imageUrl, unitPrice: p.price, stockQty: p.stockQty, qty };
        }).filter((l): l is CartLine => l !== null)
      );
    } catch { /* keep existing */ }
  }, []);

  useRealtime(ev => {
    if (["order.created","order.updated","stock.updated","product.updated"].includes(ev.type))
      void reload();
  });

  async function submit() {
    if (submitting) return;
    if (!cart.length) { setError("ยังไม่มีสินค้าในออเดอร์"); return; }
    if (!selectedChannel) { setError("กรุณาเลือกช่องทางการชำระเงิน"); return; }
    setSubmitting(true); setMessage(""); setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: cart.map(l => ({ productId: l.productId, qty: l.qty })),
          discount: safeDsc,
          paymentMethod: selectedChannel.type,
          paymentChannelId: selectedChannel.id,
          orderStatus: "PAID",
          customerId: customer?.id,
          customerType: customer ? customer.type : "WALK_IN",
          customerName: customer ? customer.name : "ลูกค้า",
          note: "Create Order Screen",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ไม่สามารถสร้างออเดอร์ได้");
      setMessage(`สร้างออเดอร์สำเร็จ ${data.orderNumber}`);
      setCart([]); setDiscount(0); setCartOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่สามารถสร้างออเดอร์ได้");
    } finally { setSubmitting(false); }
  }

  /* ══════════════════════════════════════════════════════════════════
     Cart panel (shared: desktop sidebar + mobile sheet)
  ══════════════════════════════════════════════════════════════════ */
  function CartPanel({ isMobile = false }: { isMobile?: boolean }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 16px", borderBottom: "1px solid var(--line)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "var(--brand-light)", color: "var(--brand)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <IcCart size={16} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.25, color: "var(--text)" }}>ออเดอร์</p>
              <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--muted)", lineHeight: 1.25 }}>
                {itemCount > 0 ? `${itemCount} รายการ` : "ว่างอยู่"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {cart.length > 0 && (
              <button type="button" onClick={() => setCart([])} style={{
                height: 30, padding: "0 10px", borderRadius: 7,
                border: "1px solid var(--line)", background: "transparent",
                color: "var(--muted)", fontSize: "0.75rem", fontWeight: 500,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}>
                <IcTrash /> ล้าง
              </button>
            )}
            {isMobile && (
              <button type="button" onClick={() => setCartOpen(false)} aria-label="ปิด" style={{
                width: 30, height: 30, borderRadius: 7,
                border: "1px solid var(--line)", background: "transparent",
                color: "var(--muted)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <IcX />
              </button>
            )}
          </div>
        </div>

        {/* ── Cart items ── */}
        <div className="pos-cart-items">
          {cart.length === 0 ? (
            <div className="pos-cart-empty">
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "var(--bg-subtle)",
                display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5,
              }}>
                <IcCart size={22} />
              </div>
              <p style={{ margin: 0, fontSize: "0.82rem" }}>
                ยังไม่มีสินค้า<br />
                <span style={{ color: "var(--muted-light)", fontSize: "0.75rem" }}>แตะเมนูเพื่อเพิ่มลงออเดอร์</span>
              </p>
            </div>
          ) : cart.map(line => {
            const rem = line.stockQty - line.qty;
            const stockColor = rem <= 0 ? "var(--error)" : rem <= 5 ? "var(--warn)" : "var(--muted)";
            return (
              <div key={line.lineId} className="pos-cart-row">
                {/* Thumb */}
                <div style={{
                  width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                  overflow: "hidden", border: "1px solid var(--line)", background: "var(--bg-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {line.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={line.imageUrl} alt={line.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: "0.5rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.2 }}>ไม่มีรูป</span>
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontSize: "0.82rem", fontWeight: 600,
                    color: "var(--text)", lineHeight: 1.4,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{line.name}</p>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(line.unitPrice, currency)}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.64rem", color: stockColor, fontVariantNumeric: "tabular-nums" }}>
                    {rem <= 0 ? "ครบสต็อก" : `เหลือ ${rem}`}
                  </p>
                </div>

                {/* Stepper + total */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <button type="button" className="pos-step-btn" onClick={() => changeQty(line.lineId, -1)} aria-label="ลด">−</button>
                    <span style={{
                      minWidth: 22, textAlign: "center",
                      fontSize: "0.875rem", fontWeight: 700, color: "var(--text)",
                      fontVariantNumeric: "tabular-nums",
                    }}>{line.qty}</span>
                    <button type="button" className={`pos-step-btn add-btn`} onClick={() => changeQty(line.lineId, 1)} disabled={rem <= 0} aria-label="เพิ่ม">+</button>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(line.unitPrice * line.qty, currency)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer: Controls + Summary ── */}
        <div style={{
          borderTop: "1px solid var(--line)",
          padding: "12px 14px env(safe-area-inset-bottom, 14px)",
          display: "flex", flexDirection: "column", gap: 10, flexShrink: 0,
        }}>

          {/* Customer + Discount */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 88px", gap: 8 }}>
            <div>
              <label style={{ fontSize: "0.63rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", display: "block", marginBottom: 4 }}>ลูกค้า</label>
              <select className="pos-select" value={custId} onChange={e => setCustId(e.target.value)}>
                <option value="WALK_IN">ลูกค้าทั่วไป</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.63rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", display: "block", marginBottom: 4 }}>ส่วนลด</label>
              <input
                type="number" min={0} className="pos-input"
                value={discount}
                onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>

          {/* Payment */}
          <div>
            <p style={{ margin: "0 0 5px", fontSize: "0.63rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>วิธีชำระเงิน</p>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(payOpts.length, 4)}, 1fr)`, gap: 5 }}>
              {payOpts.map(o => (
                <button key={o.id} type="button"
                  className={`pos-pay-btn${payChannelId === o.id ? " is-active" : ""}`}
                  onClick={() => setPayChannelId(o.id)}
                >
                  {o.icon}
                  <span style={{ fontSize: "0.7rem" }}>{o.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price breakdown (only when relevant) */}
          {(safeDsc > 0 || vatEnabled) && (
            <div style={{
              background: "var(--bg-subtle)", borderRadius: 8,
              padding: "8px 11px", display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)" }}>
                <span>ยอดสินค้า</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(subtotal, currency)}</span>
              </div>
              {safeDsc > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)" }}>
                  <span>ส่วนลด</span>
                  <span style={{ color: "var(--ok)", fontVariantNumeric: "tabular-nums" }}>−{formatCurrency(safeDsc, currency)}</span>
                </div>
              )}
              {vatEnabled && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)" }}>
                  <span>ภาษี ({taxRate}%)</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(tax, currency)}</span>
                </div>
              )}
            </div>
          )}

          {/* Total row + Submit */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>ยอดสุทธิ</p>
              <p style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "var(--brand)", lineHeight: 1, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {formatCurrency(total, currency)}
              </p>
            </div>
            <button type="button" className="pos-submit" onClick={() => void submit()} disabled={submitting || !cart.length} style={{ flexShrink: 0, width: "auto", padding: "0 20px" }}>
              {submitting ? <><IcSpin />กำลังบันทึก...</> : "สร้างออเดอร์"}
            </button>
          </div>

          {/* Feedback */}
          {message && (
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ok)", display: "flex", alignItems: "center", gap: 5 }}>
              <IcCheck /> {message}
            </p>
          )}
          {error && (
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--error)", display: "flex", alignItems: "center", gap: 5 }}>
              <IcWarn /> {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     Render
  ══════════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{CSS}</style>

      <div className="pos-root">

        {/* ══ Left: Category sidebar (desktop only) ══ */}
        <nav className="pos-sidebar" aria-label="หมวดหมู่สินค้า">
          <div className="pos-sidebar-head">
            <Link href="/" className="pos-sidebar-back">
              <IcBack /> กลับหน้าหลัก
            </Link>
          </div>
          <div className="pos-sidebar-scroll">
            {catTabs.map(tab => (
              <button key={tab} type="button"
                className={`pos-cat-btn${activeCat === tab ? " is-active" : ""}`}
                onClick={() => setActiveCat(tab)}
              >
                {tab === "ALL" ? "ทั้งหมด" : tab}
              </button>
            ))}
          </div>
        </nav>

        {/* ══ Center: Product Browser ══ */}
        <div className="pos-center">

          {/* Topbar */}
          <div className="pos-topbar">
            <Link href="/" className="pos-back-btn" aria-label="กลับ">
              <IcBack /> กลับ
            </Link>
            <div className="pos-search-wrap">
              <IcSearch />
              <input
                className="pos-search-input"
                type="search"
                placeholder="ค้นหาเมนู / หมวดหมู่ / SKU…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="ค้นหาสินค้า"
              />
            </div>
            {/* Mobile: cart trigger in topbar */}
            <button type="button" className="pos-topbar-cart" onClick={() => setCartOpen(true)} aria-label={`ดูออเดอร์ ${itemCount} รายการ`}>
              <IcCart size={16} />
              {itemCount > 0 && (
                <span style={{
                  background: "rgba(255,255,255,0.25)", borderRadius: 9,
                  padding: "1px 6px", fontSize: "0.78rem", fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                }}>{itemCount}</span>
              )}
              <span style={{ borderLeft: "1px solid rgba(255,255,255,0.35)", paddingLeft: 9, fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(total, currency)}
              </span>
            </button>
          </div>

          {/* Category tabs (tablet + mobile) */}
          <div className="pos-tabs" role="tablist" aria-label="หมวดหมู่">
            {catTabs.map(tab => (
              <button key={tab} type="button" role="tab"
                className={`pos-tab${activeCat === tab ? " is-active" : ""}`}
                onClick={() => setActiveCat(tab)}
                aria-selected={activeCat === tab}
              >
                {tab === "ALL" ? "ทั้งหมด" : tab}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="pos-grid-scroll">
            {visible.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
                ไม่พบสินค้าที่ค้นหา
              </div>
            ) : (
              <div className="pos-grid">
                {visible.map(product => {
                  const oos   = product.stockQty <= 0;
                  const low   = !oos && product.stockQty <= 5;
                  const inCart = cart.find(l => l.productId === product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={`pos-card${inCart ? " pos-card-in-cart" : ""}`}
                      onClick={() => addItem(product)}
                      disabled={oos}
                      aria-label={`เพิ่ม ${product.name} ราคา ${formatCurrency(product.price, currency)}`}
                      style={{ opacity: oos ? 0.55 : 1 }}
                    >
                      {/* Image area */}
                      <div className="pos-card-img">
                        {product.imageUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={product.imageUrl} alt={product.name} />
                          : <span style={{ fontSize: "0.6rem", color: "var(--muted-light)", textAlign: "center", padding: "0 8px" }}>ไม่มีรูปสินค้า</span>
                        }
                        {inCart && (
                          <div className="pos-card-qty-badge">{inCart.qty}</div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="pos-card-info">
                        <p className="pos-card-name">{product.name}</p>
                        <p className="pos-card-price">{formatCurrency(product.price, currency)}</p>
                        <p className="pos-card-stock" style={{ color: oos ? "var(--error)" : low ? "var(--warn)" : "var(--muted)" }}>
                          {oos ? "หมด" : `เหลือ ${product.stockQty}`}
                        </p>
                      </div>

                      {/* Out of stock overlay */}
                      {oos && (
                        <div className="pos-oos-overlay">
                          <span className="pos-oos-label">สินค้าหมด</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══ Right: Cart sidebar (tablet/desktop) ══ */}
        <aside className="pos-cart-panel" aria-label="ออเดอร์ปัจจุบัน">
          <CartPanel />
        </aside>
      </div>

      {/* ══ Mobile: FAB ══ */}
      <button type="button" className="pos-fab" onClick={() => setCartOpen(true)}
        aria-label={`ดูออเดอร์ ${itemCount} รายการ`}
      >
        <IcCart size={18} />
        <span>ออเดอร์</span>
        {itemCount > 0 && (
          <span style={{
            background: "rgba(255,255,255,0.22)", borderRadius: 10,
            padding: "1px 8px", fontSize: "0.78rem", fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}>{itemCount}</span>
        )}
        <span style={{ borderLeft: "1px solid rgba(255,255,255,0.32)", paddingLeft: 10, fontVariantNumeric: "tabular-nums" }}>
          {formatCurrency(total, currency)}
        </span>
      </button>

      {/* ══ Mobile: Bottom sheet ══ */}
      {cartOpen && (
        <div
          className="pos-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="ออเดอร์ปัจจุบัน"
          onClick={e => { if (e.target === e.currentTarget) setCartOpen(false); }}
        >
          <div className="pos-sheet">
            <div className="pos-sheet-handle" aria-hidden="true" />
            <CartPanel isMobile />
          </div>
        </div>
      )}
    </>
  );
}
