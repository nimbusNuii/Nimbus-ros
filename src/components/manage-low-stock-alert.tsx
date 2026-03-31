"use client";

import { useState } from "react";
import Link from "next/link";

type LowStockProduct = {
  id: string;
  name: string;
  category: string | null;
  stockQty: number;
};

type ManageLowStockAlertProps = {
  threshold: number;
  products: LowStockProduct[];
};

const CHIP: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 12px 7px 8px",
  borderRadius: 10,
  textDecoration: "none",
  flexShrink: 0,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "#fff",
  border: "1px solid var(--line)",
};

export function ManageLowStockAlert({ threshold, products }: ManageLowStockAlertProps) {
  const [open, setOpen] = useState(false);
  const hasLowStock = products.length > 0;

  return (
    <>
      {hasLowStock ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ ...CHIP, background: "#fff5f5", border: "1px solid #fca5a5" }}
        >
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", color: "#b91c1c", flexShrink: 0 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ margin: 0, fontSize: "0.7rem", color: "#ef4444", lineHeight: 1.1, whiteSpace: "nowrap" }}>สต็อกต่ำ</p>
            <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#b91c1c", lineHeight: 1.2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {products.length}<span style={{ fontSize: "0.62rem", fontWeight: 400, color: "#ef4444", marginLeft: 3 }}>รายการ</span>
            </p>
          </div>
        </button>
      ) : (
        <Link
          href="/manage/products"
          style={{ ...CHIP }}
        >
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a", flexShrink: 0 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--muted)", lineHeight: 1.1, whiteSpace: "nowrap" }}>สต็อก</p>
            <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#16a34a", lineHeight: 1.2, whiteSpace: "nowrap" }}>ปกติ</p>
          </div>
        </Link>
      )}

      {open ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="modal-panel" style={{ width: "min(920px, 100%)" }}>
            <div className="modal-header">
              <div>
                <h3 className="m-0 text-lg font-semibold">รายการสต็อกต่ำ</h3>
                <p className="m-0 mt-1 text-sm text-[var(--muted)]">สินค้าเหลือไม่เกิน {threshold}</p>
              </div>
              <button type="button" className="secondary" onClick={() => setOpen(false)}>
                ปิด
              </button>
            </div>

            <div className="space-y-2 md:hidden">
              {products.map((product) => (
                <article key={product.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                  <p className="m-0 text-sm font-semibold">{product.name}</p>
                  <p className="m-0 mt-1 text-xs text-[var(--muted)]">หมวดหมู่: {product.category || "-"}</p>
                  <p className="m-0 mt-2 text-sm">
                    คงเหลือ: <span className="font-semibold text-red-600">{product.stockQty}</span>
                  </p>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="table min-w-[680px]">
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>หมวดหมู่</th>
                    <th>คงเหลือ</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.category || "-"}</td>
                      <td className="font-semibold text-red-600">{product.stockQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
