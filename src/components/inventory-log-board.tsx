"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

  return (
    <div className="grid gap-4">
      <section className="card">
        <form onSubmit={onFilter}>
          <div className="grid items-end gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div className="field">
              <label htmlFor="reason">ประเภท</label>
              <select id="reason" value={reasonInput} onChange={(event) => setReasonInput(event.target.value)}>
                <option value="">ทั้งหมด</option>
                <option value="SALE">ขาย</option>
                <option value="ADJUST">ปรับ</option>
                <option value="RESTOCK">เติมสต็อก</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="product">สินค้า</label>
              <select id="product" value={productIdInput} onChange={(event) => setProductIdInput(event.target.value)}>
                <option value="">ทั้งหมด</option>
                {products.map((product) => (
                  <option value={product.id} key={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="from">ตั้งแต่</label>
              <input id="from" type="date" value={fromInput} onChange={(event) => setFromInput(event.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="to">ถึง</label>
              <input id="to" type="date" value={toInput} onChange={(event) => setToInput(event.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="inventoryQ">ค้นหา</label>
              <input
                id="inventoryQ"
                value={qInput}
                onChange={(event) => setQInput(event.target.value)}
                placeholder="ค้นหาโน้ต/ผู้ทำรายการ"
              />
            </div>

            <div className="field">
              <label htmlFor="inventorySort">เรียงลำดับ</label>
              <select id="inventorySort" value={sortInput} onChange={(event) => setSortInput(event.target.value as InventorySort)}>
                <option value="created_desc">ล่าสุดก่อน</option>
                <option value="created_asc">เก่าสุดก่อน</option>
              </select>
            </div>

            <button type="submit" disabled={loading}>
              ค้นหา
            </button>

            <button type="button" className="secondary" onClick={resetFilters} disabled={loading}>
              ล้างตัวกรอง
            </button>

            <button type="button" className="secondary" onClick={() => void loadLogs()} disabled={loading}>
              รีเฟรช
            </button>
            <a className="secondary" href={`/api/inventory-logs/export?${exportQuery}`} target="_blank" rel="noreferrer">
              export csv
            </a>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">ประวัติสต็อก</h2>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-[var(--muted)]">กำลังโหลด...</p> : null}

        {!loading ? (
          <div className="overflow-x-auto">
            <table className="table min-w-[900px]">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>สินค้า</th>
                  <th>ประเภท</th>
                  <th>จำนวน</th>
                  <th>Order</th>
                  <th>ผู้ทำรายการ</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{productMap.get(log.productId)?.name || log.product.name}</td>
                    <td>{reasonLabel[log.reason]}</td>
                    <td className={`font-semibold ${log.deltaQty < 0 ? "text-red-600" : "text-[var(--ok)]"}`}>
                      {log.deltaQty > 0 ? `+${log.deltaQty}` : log.deltaQty}
                    </td>
                    <td>{log.order?.orderNumber || "-"}</td>
                    <td>{log.actor || "-"}</td>
                    <td>{log.note || "-"}</td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-[var(--muted)]">
                      ไม่พบรายการ
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
        <PaginationControls
          page={currentPage}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
          onPageChange={goPage}
        />
      </section>
    </div>
  );
}
