"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { useRealtime } from "@/lib/use-realtime";

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

const statusLabel: Record<PrintJob["status"], string> = {
  PENDING: "รอพิมพ์",
  PRINTED: "พิมพ์แล้ว",
  FAILED: "พิมพ์ไม่สำเร็จ"
};

const channelLabel: Record<PrintJob["channel"], string> = {
  CASHIER_RECEIPT: "ใบเสร็จแคชเชียร์",
  KITCHEN_TICKET: "บิลครัว"
};

export function PrintJobsBoard() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<PrintJob["status"] | "ALL">("PENDING");
  const [channel, setChannel] = useState<PrintJob["channel"] | "">("");
  const [printerTarget, setPrinterTarget] = useState("");

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ status, limit: "100" });
      if (channel) query.set("channel", channel);
      if (printerTarget.trim()) query.set("printerTarget", printerTarget.trim());

      const response = await fetch(`/api/print/jobs?${query.toString()}`, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Cannot load print jobs");
      }

      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load print jobs");
    } finally {
      setLoading(false);
    }
  }, [status, channel, printerTarget]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 15000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useRealtime((event) => {
    if (event.type === "print.updated" || event.type === "order.created" || event.type === "order.updated") {
      void load();
    }
  });

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

  if (loading) return <p>กำลังโหลดคิวพิมพ์...</p>;

  return (
    <section className="card space-y-3">
      <h2 className="mt-0 text-xl font-semibold">Print Queue</h2>
      <div className="grid grid-3 items-end gap-3">
        <div className="field">
          <label htmlFor="statusFilter">Status</label>
          <select id="statusFilter" value={status} onChange={(event) => setStatus(event.target.value as PrintJob["status"] | "ALL")}>
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
            value={channel}
            onChange={(event) => setChannel(event.target.value as PrintJob["channel"] | "")}
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
            value={printerTarget}
            onChange={(event) => setPrinterTarget(event.target.value)}
            placeholder="cashier / kitchen"
          />
        </div>
        <button className="secondary" type="button" onClick={() => void load()}>
          ค้นหา
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {jobs.length === 0 ? <p className="text-sm text-[var(--muted)]">ไม่มีคิวพิมพ์ค้าง</p> : null}

      <div className="overflow-x-auto">
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
                    <button className="secondary" onClick={() => updateStatus(job.id, "PRINTED")}>
                      พิมพ์แล้ว
                    </button>
                    <button className="secondary" onClick={() => updateStatus(job.id, "FAILED")}>
                      ล้มเหลว
                    </button>
                    <button className="secondary" onClick={() => updateStatus(job.id, "PENDING")}>
                      retry
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
