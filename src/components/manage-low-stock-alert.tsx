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

export function ManageLowStockAlert({ threshold, products }: ManageLowStockAlertProps) {
  const [open, setOpen] = useState(false);
  const hasLowStock = products.length > 0;

  return (
    <>
      <section className="card mb-4">
        <h2 className="mt-0 text-xl font-semibold">แจ้งเตือนสต็อกต่ำ (≤ {threshold})</h2>
        {!hasLowStock ? (
          <p className="mb-0 text-[var(--ok)]">สต็อกอยู่ในระดับปกติ</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
              พบสินค้าสต็อกต่ำ {products.length} รายการ
            </span>
            <button type="button" className="secondary" onClick={() => setOpen(true)}>
              ดูรายการ
            </button>
            <Link href="/manage/products" className="secondary">
              ไปหน้าสินค้า
            </Link>
          </div>
        )}
      </section>

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
