"use client";

import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { useRealtime } from "@/lib/use-realtime";
import { PaginationControls } from "@/components/pagination-controls";

type Product = {
  id: string;
  name: string;
  sku: string | null;
};

type InventoryLog = {
  id: string;
  productId: string;
  orderId: string | null;
  deltaQty: number;
  reason: "SALE" | "ADJUST" | "RESTOCK";
  note: string | null;
  actor: string | null;
  createdAt: string;
  product: Product;
  order: { id: string; orderNumber: string } | null;
};

type InventoryLogPayload = {
  rows: InventoryLog[];
  total: number;
  page: number;
  pageSize: number;
};

type InventorySort = "created_desc" | "created_asc";

const reasonLabel: Record<InventoryLog["reason"], string> = {
  SALE: "ขาย",
  ADJUST: "ปรับ",
  RESTOCK: "เติมสต็อก"
};

const PAGE_SIZE = 50;

function parsePage(value: string | null) {
  const num = Number(value || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.trunc(num));
}

export function InventoryLogBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = parsePage(searchParams.get("page"));
  const reasonParam = searchParams.get("reason") || "";
  const productIdParam = searchParams.get("productId") || "";
  const fromParam = searchParams.get("from") || "";
  const toParam = searchParams.get("to") || "";
  const qParam = searchParams.get("q") || "";
  const sortParam: InventorySort = searchParams.get("sort") === "created_asc" ? "created_asc" : "created_desc";

  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reasonInput, setReasonInput] = useState<string>(reasonParam);
  const [productIdInput, setProductIdInput] = useState<string>(productIdParam);
  const [fromInput, setFromInput] = useState<string>(fromParam);
  const [toInput, setToInput] = useState<string>(toParam);
  const [qInput, setQInput] = useState<string>(qParam);
  const [sortInput, setSortInput] = useState<InventorySort>(sortParam);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  useEffect(() => {
    setReasonInput(reasonParam);
    setProductIdInput(productIdParam);
    setFromInput(fromParam);
    setToInput(toParam);
    setQInput(qParam);
    setSortInput(sortParam);
  }, [reasonParam, productIdParam, fromParam, toParam, qParam, sortParam]);

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (reasonParam) params.set("reason", reasonParam);
    if (productIdParam) params.set("productId", productIdParam);
    if (fromParam) params.set("from", fromParam);
    if (toParam) params.set("to", toParam);
    return params.toString();
  }, [reasonParam, productIdParam, fromParam, toParam]);

  const loadProducts = useCallback(async () => {
    const response = await fetch("/api/products?active=1&limit=1000", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Cannot load products");
    }
    setProducts(data.map((item: Product) => ({ id: item.id, name: item.name, sku: item.sku })));
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("page", String(currentPage));
      params.set("withMeta", "1");
      if (reasonParam) params.set("reason", reasonParam);
      if (productIdParam) params.set("productId", productIdParam);
      if (fromParam) params.set("from", fromParam);
      if (toParam) params.set("to", toParam);
      if (qParam) params.set("q", qParam);
      if (sortParam !== "created_desc") params.set("sort", sortParam);

      const response = await fetch(`/api/inventory-logs?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as InventoryLogPayload | InventoryLog[] | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot load inventory logs");
      }

      if (Array.isArray(data)) {
        setLogs(data);
        setTotalItems(data.length);
      } else if ("rows" in data && Array.isArray(data.rows)) {
        setLogs(data.rows);
        setTotalItems(typeof data.total === "number" ? data.total : data.rows.length);
      } else {
        setLogs([]);
        setTotalItems(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load inventory logs");
    } finally {
      setLoading(false);
    }
  }, [currentPage, fromParam, productIdParam, qParam, reasonParam, sortParam, toParam]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useRealtime((event) => {
    if (event.type === "stock.updated" || event.type === "order.created" || event.type === "order.updated") {
      void loadLogs();
    }
    if (event.type === "product.updated") {
      void loadProducts();
    }
  });

  function goPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    const safePage = Math.max(1, Math.trunc(nextPage));
    if (safePage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(safePage));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    const q = qInput.trim();
    if (reasonInput) params.set("reason", reasonInput);
    else params.delete("reason");
    if (productIdInput) params.set("productId", productIdInput);
    else params.delete("productId");
    if (fromInput) params.set("from", fromInput);
    else params.delete("from");
    if (toInput) params.set("to", toInput);
    else params.delete("to");
    if (q) params.set("q", q);
    else params.delete("q");
    if (sortInput === "created_desc") params.delete("sort");
    else params.set("sort", sortInput);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function resetFilters() {
    setReasonInput("");
    setProductIdInput("");
    setFromInput("");
    setToInput("");
    setQInput("");
    setSortInput("created_desc");
    router.push(pathname);
  }

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters();
  }

  const reasonColor: Record<InventoryLog["reason"], { bg: string; border: string; color: string }> = {
    SALE:    { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8" },
    ADJUST:  { bg: "#fffbeb", border: "#fcd34d", color: "#b45309" },
    RESTOCK: { bg: "#f0fdf4", border: "#86efac", color: "#16a34a" },
  };

  const FIELD_STYLE: CSSProperties = {
    height: 36, padding: "0 10px", borderRadius: 8,
    border: "1px solid var(--line)", background: "#fff",
    fontSize: "0.8rem", color: "var(--text)", cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>
            ประวัติสต็อก
          </h1>
          {!loading && (
            <span style={{
              display: "inline-flex", alignItems: "center",
              height: 22, padding: "0 9px", borderRadius: 99,
              border: "1px solid var(--line)", background: "var(--bg)",
              fontSize: "0.72rem", fontWeight: 600, color: "var(--muted)",
            }}>
              {totalItems} รายการ
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void loadLogs()}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 36, padding: "0 14px", borderRadius: 9,
              border: "1px solid var(--line)", background: "#fff",
              fontSize: "0.78rem", fontWeight: 500, color: "var(--text)",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
              boxShadow: "none",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                stroke="#1a1614" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            รีเฟรช
          </button>
          <a
            href={`/api/inventory-logs/export?${exportQuery}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 36, padding: "0 14px", borderRadius: 9,
              border: "1px solid var(--line)", background: "#fff",
              fontSize: "0.78rem", fontWeight: 500, color: "var(--text)",
              textDecoration: "none",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V19a2 2 0 002 2h14a2 2 0 002-2v-2"
                stroke="#1a1614" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Export CSV
          </a>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <form
        onSubmit={onFilter}
        style={{
          padding: "14px 16px 16px",
          borderRadius: 12,
          border: "1px solid var(--line)",
          background: "var(--bg)",
        }}
      >
        {/* Row 1: filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 14px", alignItems: "flex-end" }}>

          {/* ประเภท */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>ประเภท</span>
            <select
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              style={FIELD_STYLE}
            >
              <option value="">ทั้งหมด</option>
              <option value="SALE">ขาย</option>
              <option value="ADJUST">ปรับ</option>
              <option value="RESTOCK">เติมสต็อก</option>
            </select>
          </div>

          {/* สินค้า */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px", minWidth: 0, maxWidth: 240 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>สินค้า</span>
            <select
              value={productIdInput}
              onChange={(e) => setProductIdInput(e.target.value)}
              style={{ ...FIELD_STYLE, width: "100%" }}
            >
              <option value="">ทั้งหมด</option>
              {products.map((p) => (
                <option value={p.id} key={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* ช่วงวันที่ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>ช่วงวันที่</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="date"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                style={FIELD_STYLE}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>–</span>
              <input
                type="date"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                style={FIELD_STYLE}
              />
            </div>
          </div>

          {/* ค้นหา */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px", minWidth: 0 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>โน้ต / ผู้ทำรายการ</span>
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="ค้นหา..."
              style={{ ...FIELD_STYLE, width: "100%" }}
            />
          </div>

          {/* เรียง */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>เรียง</span>
            <select
              value={sortInput}
              onChange={(e) => setSortInput(e.target.value as InventorySort)}
              style={FIELD_STYLE}
            >
              <option value="created_desc">ล่าสุดก่อน</option>
              <option value="created_asc">เก่าสุดก่อน</option>
            </select>
          </div>
        </div>

        {/* Row 2: actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              height: 36, padding: "0 20px", borderRadius: 8,
              background: "var(--brand)", border: "none",
              fontSize: "0.8rem", fontWeight: 600, color: "#fff",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
            }}
          >
            ค้นหา
          </button>
          <button
            type="button"
            onClick={resetFilters}
            disabled={loading}
            style={{
              height: 36, padding: "0 14px", borderRadius: 8,
              border: "1px solid var(--line)", background: "#fff",
              fontSize: "0.8rem", fontWeight: 500, color: "var(--muted)",
              cursor: loading ? "not-allowed" : "pointer", boxShadow: "none",
            }}
          >
            ล้างตัวกรอง
          </button>
        </div>
      </form>

      {/* ── Error ── */}
      {error && (
        <p style={{ margin: 0, padding: "10px 14px", borderRadius: 9, background: "#fff5f5", border: "1px solid #fca5a5", color: "#dc2626", fontSize: "0.82rem" }}>
          {error}
        </p>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
          กำลังโหลด...
        </div>
      )}

      {/* ── Mobile cards ── */}
      {!loading && (
        <div className="flex flex-col lg:hidden" style={{ gap: 8 }}>
          {logs.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
              ไม่พบรายการ
            </div>
          ) : logs.map((log) => {
            const rc = reasonColor[log.reason];
            const isNeg = log.deltaQty < 0;
            return (
              <div
                key={log.id}
                style={{
                  borderRadius: 12, border: "1px solid var(--line)",
                  background: "#fff", overflow: "hidden",
                }}
              >
                <div style={{ padding: "11px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {productMap.get(log.productId)?.name || log.product.name}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                  {/* Delta badge */}
                  <span style={{
                    display: "inline-flex", alignItems: "center",
                    height: 26, padding: "0 10px", borderRadius: 99, flexShrink: 0,
                    background: isNeg ? "#fff5f5" : "#f0fdf4",
                    border: `1px solid ${isNeg ? "#fca5a5" : "#86efac"}`,
                    fontSize: "0.8rem", fontWeight: 700,
                    color: isNeg ? "#dc2626" : "#16a34a",
                  }}>
                    {log.deltaQty > 0 ? `+${log.deltaQty}` : log.deltaQty}
                  </span>
                </div>
                <div style={{
                  padding: "8px 14px", background: "var(--bg)",
                  borderTop: "1px solid var(--line)",
                  display: "flex", flexWrap: "wrap", gap: "4px 14px",
                }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center",
                    height: 20, padding: "0 8px", borderRadius: 99,
                    background: rc.bg, border: `1px solid ${rc.border}`,
                    fontSize: "0.68rem", fontWeight: 600, color: rc.color,
                  }}>
                    {reasonLabel[log.reason]}
                  </span>
                  {log.order && (
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                      #{log.order.orderNumber}
                    </span>
                  )}
                  {log.actor && (
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                      โดย {log.actor}
                    </span>
                  )}
                  {log.note && (
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)", flex: "1 1 100%" }}>
                      {log.note}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Desktop table ── */}
      {!loading && (
        <div
          className="hidden lg:block"
          style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", margin: 0, border: "none", minWidth: 800 }}>
              <thead>
                <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
                  {["เวลา", "สินค้า", "ประเภท", "จำนวน", "Order", "ผู้ทำรายการ", "หมายเหตุ"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: i === 3 ? "center" : "left",
                        fontSize: "0.72rem", fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        color: "var(--muted)", whiteSpace: "nowrap",
                        border: "none",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "40px 14px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem", border: "none" }}>
                      ไม่พบรายการ
                    </td>
                  </tr>
                ) : logs.map((log, idx) => {
                  const rc = reasonColor[log.reason];
                  const isNeg = log.deltaQty < 0;
                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderTop: idx === 0 ? "none" : "1px solid var(--line)",
                        background: "#fff",
                      }}
                    >
                      <td style={{ padding: "10px 14px", border: "none", fontSize: "0.8rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td style={{ padding: "10px 14px", border: "none", fontSize: "0.82rem", fontWeight: 500, color: "var(--text)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {productMap.get(log.productId)?.name || log.product.name}
                      </td>
                      <td style={{ padding: "10px 14px", border: "none" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          height: 22, padding: "0 9px", borderRadius: 99,
                          background: rc.bg, border: `1px solid ${rc.border}`,
                          fontSize: "0.7rem", fontWeight: 600, color: rc.color,
                          whiteSpace: "nowrap",
                        }}>
                          {reasonLabel[log.reason]}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", border: "none", textAlign: "center" }}>
                        <span style={{
                          fontSize: "0.85rem", fontWeight: 700,
                          color: isNeg ? "#dc2626" : "#16a34a",
                        }}>
                          {log.deltaQty > 0 ? `+${log.deltaQty}` : log.deltaQty}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", border: "none", fontSize: "0.8rem", color: "var(--muted)" }}>
                        {log.order?.orderNumber ? `#${log.order.orderNumber}` : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", border: "none", fontSize: "0.8rem", color: "var(--muted)" }}>
                        {log.actor || "—"}
                      </td>
                      <td style={{ padding: "10px 14px", border: "none", fontSize: "0.8rem", color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.note || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      <PaginationControls
        page={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={totalItems}
        onPageChange={goPage}
      />
    </div>
  );
}
