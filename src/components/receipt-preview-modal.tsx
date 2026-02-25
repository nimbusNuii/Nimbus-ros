"use client";

import { useEffect, useState } from "react";
import { ReceiptDocument } from "@/components/receipt-document";

type PrintChannel = "CASHIER_RECEIPT" | "KITCHEN_TICKET";
type PrintJobStatus = "PENDING" | "PRINTED" | "FAILED";

type PrinterOption = {
  target: string;
  label: string;
  channels: PrintChannel[];
  isDefault: boolean;
  source: "system" | "history";
  state?: "idle" | "printing" | "disabled" | "unknown";
  rawStatus?: string;
};

type PrintJobLive = {
  id: string;
  status: PrintJobStatus;
  errorMessage: string | null;
  updatedAt: string;
};

type ReceiptPayload = {
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    paymentMethod: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    items: Array<{
      id: string;
      name: string;
      qty: number;
      unitPrice: number;
      unitCost: number;
      lineTotal: number;
    }>;
  };
  store: {
    businessName: string;
    branchName: string | null;
    address: string | null;
    phone: string | null;
    vatNumber: string | null;
    currency: string;
  };
  template: {
    headerText: string;
    footerText: string;
    showStoreInfo: boolean;
    showVatNumber: boolean;
    showCostBreakdown: boolean;
    paperWidth: number;
    customCss: string | null;
  };
};

type ReceiptPreviewModalProps = {
  orderId: string | null;
  onClose: () => void;
};

export function ReceiptPreviewModal({ orderId, onClose }: ReceiptPreviewModalProps) {
  const [data, setData] = useState<ReceiptPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [queueingChannel, setQueueingChannel] = useState<PrintChannel | null>(null);
  const [printers, setPrinters] = useState<PrinterOption[]>([]);
  const [cashierPrinter, setCashierPrinter] = useState("");
  const [kitchenPrinter, setKitchenPrinter] = useState("");
  const [printJobs, setPrintJobs] = useState<Partial<Record<PrintChannel, PrintJobLive>>>({});

  function isPrinterAvailable(item: PrinterOption) {
    return item.state !== "disabled";
  }

  function formatPrinterLabel(item: PrinterOption) {
    const badges: string[] = [];
    if (item.isDefault) badges.push("default");
    if (item.state && item.source === "system") badges.push(item.state);
    if (item.source === "history") badges.push("history");
    return badges.length ? `${item.label} (${badges.join(", ")})` : item.label;
  }

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      setMessage("");
      setPrintJobs({});

      try {
        const [receiptResponse, printersResponse] = await Promise.all([
          fetch(`/api/receipts/${orderId}`, { cache: "no-store" }),
          fetch("/api/printers", { cache: "no-store" })
        ]);

        const payload = await receiptResponse.json();
        const printerPayload = await printersResponse.json();

        if (!receiptResponse.ok) {
          throw new Error(payload.error || "Cannot load receipt");
        }

        if (!cancelled) {
          setData(payload);
          if (printersResponse.ok && Array.isArray(printerPayload)) {
            const list = printerPayload as PrinterOption[];
            setPrinters(list);

            const cashierDefault =
              list.find(
                (item) => item.channels.includes("CASHIER_RECEIPT") && item.isDefault && isPrinterAvailable(item)
              )?.target ||
              list.find((item) => item.channels.includes("CASHIER_RECEIPT") && isPrinterAvailable(item))?.target ||
              "";
            const kitchenDefault =
              list.find(
                (item) => item.channels.includes("KITCHEN_TICKET") && item.isDefault && isPrinterAvailable(item)
              )?.target ||
              list.find((item) => item.channels.includes("KITCHEN_TICKET") && isPrinterAvailable(item))?.target ||
              "";

            setCashierPrinter(cashierDefault);
            setKitchenPrinter(kitchenDefault);
          } else {
            setPrinters([]);
            setCashierPrinter("");
            setKitchenPrinter("");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Cannot load receipt");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    const pendingEntries = Object.entries(printJobs).filter((entry) => entry[1]?.status === "PENDING");
    if (pendingEntries.length === 0) return;

    let cancelled = false;

    const poll = async () => {
      const updates = await Promise.all(
        pendingEntries.map(async ([channel, job]) => {
          if (!job?.id) return null;

          try {
            const response = await fetch(`/api/print/jobs/${job.id}`, { cache: "no-store" });
            if (!response.ok) return null;

            const payload = (await response.json()) as {
              id: string;
              status: PrintJobStatus;
              errorMessage: string | null;
              updatedAt: string;
            };

            return {
              channel: channel as PrintChannel,
              id: payload.id,
              status: payload.status,
              errorMessage: payload.errorMessage,
              updatedAt: payload.updatedAt
            };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      const validUpdates = updates.filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (validUpdates.length === 0) return;

      setPrintJobs((prev) => {
        const next = { ...prev };
        let changed = false;

        for (const update of validUpdates) {
          const current = prev[update.channel];
          if (
            current &&
            current.id === update.id &&
            current.status === update.status &&
            current.errorMessage === update.errorMessage &&
            current.updatedAt === update.updatedAt
          ) {
            continue;
          }

          next[update.channel] = {
            id: update.id,
            status: update.status,
            errorMessage: update.errorMessage,
            updatedAt: update.updatedAt
          };
          changed = true;
        }

        return changed ? next : prev;
      });
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [printJobs]);

  function jobStatusText(channel: PrintChannel) {
    const job = printJobs[channel];
    if (!job) return "";

    if (job.status === "PENDING") {
      return `กำลังรอพิมพ์... (job: ${job.id})`;
    }

    if (job.status === "PRINTED") {
      return `พิมพ์เสร็จแล้ว (job: ${job.id})`;
    }

    return `พิมพ์ไม่สำเร็จ (job: ${job.id})${job.errorMessage ? ` - ${job.errorMessage}` : ""}`;
  }

  async function enqueue(channel: PrintChannel) {
    if (!orderId) return;
    const selectedPrinter = channel === "CASHIER_RECEIPT" ? cashierPrinter : kitchenPrinter;
    if (!selectedPrinter) {
      setError("กรุณาเลือกเครื่องปริ้นก่อนส่งคิว");
      return;
    }

    setQueueingChannel(channel);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/print/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          orderId,
          channel,
          printerTarget: selectedPrinter
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Cannot enqueue print");
      }

      setPrintJobs((prev) => ({
        ...prev,
        [channel]: {
          id: payload.id,
          status: (payload.status as PrintJobStatus) || "PENDING",
          errorMessage: payload.errorMessage || null,
          updatedAt: payload.updatedAt || new Date().toISOString()
        }
      }));
      setMessage(`ส่งคิวแล้ว (${payload.id})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot enqueue print");
    } finally {
      setQueueingChannel(null);
    }
  }

  if (!orderId) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-header hide-print">
          <h3 style={{ margin: 0 }}>พรีวิวใบเสร็จ</h3>
          <button className="secondary" onClick={onClose}>
            ปิด
          </button>
        </div>

        <div className="hide-print" style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <button onClick={() => window.print()}>พิมพ์จาก Browser</button>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ color: "var(--muted)" }}>เครื่องพิมพ์ใบเสร็จ</label>
            <select value={cashierPrinter} onChange={(event) => setCashierPrinter(event.target.value)}>
              <option value="">เลือกเครื่องพิมพ์</option>
              {printers
                .filter((item) => item.channels.includes("CASHIER_RECEIPT"))
                .map((item) => (
                  <option key={`cashier-${item.target}`} value={item.target} disabled={!isPrinterAvailable(item)}>
                    {formatPrinterLabel(item)}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ color: "var(--muted)" }}>เครื่องพิมพ์บิลครัว</label>
            <select value={kitchenPrinter} onChange={(event) => setKitchenPrinter(event.target.value)}>
              <option value="">เลือกเครื่องพิมพ์</option>
              {printers
                .filter((item) => item.channels.includes("KITCHEN_TICKET"))
                .map((item) => (
                  <option key={`kitchen-${item.target}`} value={item.target} disabled={!isPrinterAvailable(item)}>
                    {formatPrinterLabel(item)}
                  </option>
                ))}
            </select>
          </div>
          <button
            className="secondary"
            disabled={queueingChannel !== null}
            onClick={() => void enqueue("CASHIER_RECEIPT")}
          >
            {queueingChannel === "CASHIER_RECEIPT" ? "กำลังส่ง..." : "คิวใบเสร็จ"}
          </button>
          <button
            className="secondary"
            disabled={queueingChannel !== null}
            onClick={() => void enqueue("KITCHEN_TICKET")}
          >
            {queueingChannel === "KITCHEN_TICKET" ? "กำลังส่ง..." : "คิวบิลครัว"}
          </button>
        </div>
        {printJobs.CASHIER_RECEIPT ? (
          <p className="hide-print" style={{ marginTop: 0, color: printJobs.CASHIER_RECEIPT.status === "FAILED" ? "crimson" : "var(--muted)" }}>
            สถานะใบเสร็จ: {jobStatusText("CASHIER_RECEIPT")}
          </p>
        ) : null}
        {printJobs.KITCHEN_TICKET ? (
          <p className="hide-print" style={{ marginTop: 0, color: printJobs.KITCHEN_TICKET.status === "FAILED" ? "crimson" : "var(--muted)" }}>
            สถานะบิลครัว: {jobStatusText("KITCHEN_TICKET")}
          </p>
        ) : null}

        {message ? <p className="hide-print" style={{ color: "var(--ok)", marginTop: 0 }}>{message}</p> : null}
        {error ? <p className="hide-print" style={{ color: "crimson", marginTop: 0 }}>{error}</p> : null}

        {loading ? <p>กำลังโหลดใบเสร็จ...</p> : null}

        {data ? (
          <ReceiptDocument
            order={data.order}
            store={data.store}
            template={data.template}
          />
        ) : null}
      </div>
    </div>
  );
}
