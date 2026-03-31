"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { useRealtime } from "@/lib/use-realtime";
import { PaginationControls } from "@/components/pagination-controls";

type PrintJob = {
  id: string;
  orderId: string;
  status: "PENDING" | "PRINTED" | "FAILED";
  channel: "CASHIER_RECEIPT" | "KITCHEN_TICKET";
  printerTarget: string | null;
  errorMessage: string | null;
  createdAt: string;
  order: {
    orderNumber: string;
    total: number;
  };
};

type PrintJobsPayload = {
  rows: PrintJob[];
  total: number;
  page: number;
  pageSize: number;
};

type PrintStatusFilter = PrintJob["status"] | "ALL";
type PrintSort = "created_desc" | "created_asc";

const statusLabel: Record<PrintJob["status"], string> = {
  PENDING: "รอพิมพ์",
  PRINTED: "พิมพ์แล้ว",
  FAILED: "พิมพ์ไม่สำเร็จ"
};

const channelLabel: Record<PrintJob["channel"], string> = {
  CASHIER_RECEIPT: "ใบเสร็จแคชเชียร์",
  KITCHEN_TICKET: "บิลครัว"
};

const PAGE_SIZE = 30;

function parsePage(value: string | null) {
  const num = Number(value || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.trunc(num));
}

export function PrintJobsBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = parsePage(searchParams.get("page"));
  const statusParam = (searchParams.get("status") as PrintStatusFilter | null) || "PENDING";
  const channelParam = (searchParams.get("channel") as PrintJob["channel"] | null) || "";
  const printerTargetParam = searchParams.get("printerTarget") || "";
  const qParam = searchParams.get("q") || "";
  const sortParam: PrintSort = searchParams.get("sort") === "created_asc" ? "created_asc" : "created_desc";

  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusInput, setStatusInput] = useState<PrintStatusFilter>(statusParam);
  const [channelInput, setChannelInput] = useState<PrintJob["channel"] | "">(channelParam);
  const [printerTargetInput, setPrinterTargetInput] = useState(printerTargetParam);
  const [qInput, setQInput] = useState(qParam);
  const [sortInput, setSortInput] = useState<PrintSort>(sortParam);

  useEffect(() => {
    setStatusInput(statusParam);
    setChannelInput(channelParam);
    setPrinterTargetInput(printerTargetParam);
    setQInput(qParam);
    setSortInput(sortParam);
  }, [channelParam, printerTargetParam, qParam, sortParam, statusParam]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      query.set("withMeta", "1");
      query.set("limit", String(PAGE_SIZE));
      query.set("page", String(currentPage));
      query.set("status", statusParam);
      if (channelParam) query.set("channel", channelParam);
      if (printerTargetParam.trim()) query.set("printerTarget", printerTargetParam.trim());
      if (qParam.trim()) query.set("q", qParam.trim());
      if (sortParam !== "created_desc") query.set("sort", sortParam);

      const response = await fetch(`/api/print/jobs?${query.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as PrintJobsPayload | PrintJob[] | { error?: string };

      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot load print jobs");
      }

      if (Array.isArray(data)) {
        setJobs(data);
        setTotalItems(data.length);
      } else if ("rows" in data && Array.isArray(data.rows)) {
        setJobs(data.rows);
        setTotalItems(typeof data.total === "number" ? data.total : data.rows.length);
      } else {
        setJobs([]);
        setTotalItems(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load print jobs");
    } finally {
      setLoading(false);
    }
  }, [channelParam, currentPage, printerTargetParam, qParam, sortParam, statusParam]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime((event) => {
    if (event.type === "print.updated" || event.type === "order.created" || event.type === "order.updated") {
      void load();
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
    params.set("status", statusInput);
    if (channelInput) params.set("channel", channelInput);
    else params.delete("channel");
    if (printerTargetInput.trim()) params.set("printerTarget", printerTargetInput.trim());
    else params.delete("printerTarget");
    if (qInput.trim()) params.set("q", qInput.trim());
    else params.delete("q");
    if (sortInput === "created_desc") params.delete("sort");
    else params.set("sort", sortInput);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function resetFilters() {
    setStatusInput("PENDING");
    setChannelInput("");
    setPrinterTargetInput("");
    setQInput("");
    setSortInput("created_desc");
    router.push(pathname);
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters();
  }

  async function updateStatus(jobId: string, status: PrintJob["status"]) {
    const response = await fetch(`/api/print/jobs/${jobId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      await load();
    }
  }

  return (
    <section className="card space-y-3">
      <h2 className="mt-0 text-xl font-semibold">Print Queue</h2>
      <form onSubmit={onSearch} className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="field">
          <label htmlFor="statusFilter">Status</label>
          <select id="statusFilter" value={statusInput} onChange={(event) => setStatusInput(event.target.value as PrintStatusFilter)}>
            <option value="PENDING">รอพิมพ์</option>
            <option value="FAILED">พิมพ์ไม่สำเร็จ</option>
            <option value="PRINTED">พิมพ์แล้ว</option>
            <option value="ALL">ทั้งหมด</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="channelFilter">Channel</label>
          <select
            id="channelFilter"
            value={channelInput}
            onChange={(event) => setChannelInput(event.target.value as PrintJob["channel"] | "")}
          >
            <option value="">ทั้งหมด</option>
            <option value="CASHIER_RECEIPT">ใบเสร็จแคชเชียร์</option>
            <option value="KITCHEN_TICKET">บิลครัว</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="targetFilter">Printer Target</label>
          <input
            id="targetFilter"
            value={printerTargetInput}
            onChange={(event) => setPrinterTargetInput(event.target.value)}
            placeholder="cashier / kitchen"
          />
        </div>
        <div className="field">
          <label htmlFor="print-q">ค้นหา</label>
          <input
            id="print-q"
            value={qInput}
            onChange={(event) => setQInput(event.target.value)}
            placeholder="order / printer / error"
          />
        </div>
        <div className="field">
          <label htmlFor="print-sort">เรียงลำดับ</label>
          <select id="print-sort" value={sortInput} onChange={(event) => setSortInput(event.target.value as PrintSort)}>
            <option value="created_desc">ล่าสุดก่อน</option>
            <option value="created_asc">เก่าสุดก่อน</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
          <button type="submit" disabled={loading}>
            ค้นหา
          </button>
          <button className="secondary" type="button" onClick={resetFilters} disabled={loading}>
            ล้างตัวกรอง
          </button>
          <button className="secondary" type="button" onClick={() => void load()} disabled={loading}>
            รีเฟรช
          </button>
        </div>
      </form>

      {loading ? <p className="text-sm text-[var(--muted)]">กำลังโหลดคิวพิมพ์...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && jobs.length === 0 ? <p className="text-sm text-[var(--muted)]">ไม่มีคิวพิมพ์ค้าง</p> : null}

      <div className="space-y-2 lg:hidden">
        {jobs.map((job) => (
          <article key={job.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="m-0 text-sm font-semibold text-[var(--text)]">{job.order.orderNumber}</p>
                <p className="m-0 text-xs text-[var(--muted)]">{formatDateTime(job.createdAt)}</p>
              </div>
              <span className="text-xs font-medium text-[var(--muted)]">{statusLabel[job.status]}</span>
            </div>
            <div className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
              <p className="m-0">ช่องทาง: {channelLabel[job.channel]}</p>
              <p className="m-0">เครื่องพิมพ์: {job.printerTarget || "-"}</p>
              {job.errorMessage ? <p className="m-0 text-red-600">error: {job.errorMessage}</p> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="secondary" onClick={() => void updateStatus(job.id, "PRINTED")}>
                พิมพ์แล้ว
              </button>
              <button className="secondary" onClick={() => void updateStatus(job.id, "FAILED")}>
                ล้มเหลว
              </button>
              <button className="secondary" onClick={() => void updateStatus(job.id, "PENDING")}>
                retry
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="table min-w-[920px]">
          <thead>
            <tr>
              <th>เวลา</th>
              <th>Order</th>
              <th>Channel</th>
              <th>Target</th>
              <th>สถานะ</th>
              <th>เปลี่ยนสถานะ</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{formatDateTime(job.createdAt)}</td>
                <td>{job.order.orderNumber}</td>
                <td>{channelLabel[job.channel]}</td>
                <td>{job.printerTarget || "-"}</td>
                <td>{statusLabel[job.status]}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button className="secondary" onClick={() => void updateStatus(job.id, "PRINTED")}>
                      พิมพ์แล้ว
                    </button>
                    <button className="secondary" onClick={() => void updateStatus(job.id, "FAILED")}>
                      ล้มเหลว
                    </button>
                    <button className="secondary" onClick={() => void updateStatus(job.id, "PENDING")}>
                      retry
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-[var(--muted)]">
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={totalItems}
        onPageChange={goPage}
      />
    </section>
  );
}
