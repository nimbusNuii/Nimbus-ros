"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ReceiptDocument } from "@/components/receipt-document";
import { useRealtime } from "@/lib/use-realtime";

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

type EnqueueResponse = {
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
    status: "PAID" | "OPEN" | "CANCELLED";
    customerType?: "WALK_IN" | "REGULAR";
    customerName?: string | null;
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
    receiptLogoUrl: string | null;
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

function isPrinterAvailable(item: PrinterOption) {
  return item.state !== "disabled";
}

function truncate(text: string, max = 42) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function formatPrinterOptionLabel(item: PrinterOption) {
  const badge: string[] = [];
  if (item.isDefault) badge.push("default");
  if (item.state && item.source === "system") badge.push(item.state);
  if (item.source === "history") badge.push("history");
  const suffix = badge.length ? ` [${badge.join(", ")}]` : "";
  return `${truncate(item.label)}${suffix}`;
}

function statusTone(status: PrintJobStatus) {
  if (status === "FAILED") return "text-red-600";
  if (status === "PRINTED") return "text-[var(--ok)]";
  return "text-[var(--muted)]";
}

export function ReceiptPreviewModal({ orderId, onClose }: ReceiptPreviewModalProps) {
  const [data, setData] = useState<ReceiptPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [queueingAction, setQueueingAction] = useState<PrintChannel | "BOTH" | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [printers, setPrinters] = useState<PrinterOption[]>([]);
  const [cashierPrinter, setCashierPrinter] = useState("");
  const [kitchenPrinter, setKitchenPrinter] = useState("");
  const [printJobs, setPrintJobs] = useState<Partial<Record<PrintChannel, PrintJobLive>>>({});
  const printMenuRef = useRef<HTMLDivElement | null>(null);
  const printDisabled = data?.order.status === "CANCELLED";

  const cashierSelectedPrinter = useMemo(
    () => printers.find((item) => item.target === cashierPrinter) || null,
    [printers, cashierPrinter]
  );
  const kitchenSelectedPrinter = useMemo(
    () => printers.find((item) => item.target === kitchenPrinter) || null,
    [printers, kitchenPrinter]
  );

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      setMessage("");
      setPrintJobs({});
      setPrintMenuOpen(false);

      try {
        const [receiptResponse, printersResponse] = await Promise.all([
          fetch(`/api/receipts/${orderId}`, { cache: "no-store" }),
          fetch("/api/printers", { cache: "no-store" })
        ]);

        const payload = (await receiptResponse.json()) as ReceiptPayload | { error?: string };
        const printerPayload = (await printersResponse.json()) as PrinterOption[];

        if (!receiptResponse.ok) {
          throw new Error(("error" in payload && payload.error) || "Cannot load receipt");
        }

        if (!cancelled) {
          setData(payload as ReceiptPayload);
          if (printersResponse.ok && Array.isArray(printerPayload)) {
            const list = printerPayload;
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
    if (!printMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!printMenuRef.current) return;
      const target = event.target as Node;
      if (!printMenuRef.current.contains(target)) {
        setPrintMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [printMenuOpen]);

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
      if (document.visibilityState === "visible") {
        void poll();
      }
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [printJobs]);

  useRealtime((event) => {
    if (event.type !== "print.updated" || !orderId) return;

    const payload = event.payload || {};
    const payloadOrderId = typeof payload.orderId === "string" ? payload.orderId : "";
    if (payloadOrderId && payloadOrderId !== orderId) return;

    const payloadJobId = typeof payload.jobId === "string" ? payload.jobId : "";
    const payloadChannel =
      payload.channel === "CASHIER_RECEIPT" || payload.channel === "KITCHEN_TICKET" ? payload.channel : null;
    const payloadStatus =
      payload.status === "PENDING" || payload.status === "PRINTED" || payload.status === "FAILED"
        ? payload.status
        : null;
    const payloadError = typeof payload.errorMessage === "string" ? payload.errorMessage : null;
    const payloadUpdatedAt =
      typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString();

    if (!payloadStatus) return;

    setPrintJobs((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const channel of ["CASHIER_RECEIPT", "KITCHEN_TICKET"] as PrintChannel[]) {
        const current = prev[channel];
        if (!current) continue;
        if (payloadJobId && current.id !== payloadJobId) continue;
        if (!payloadJobId && payloadChannel && channel !== payloadChannel) continue;

        next[channel] = {
          id: current.id,
          status: payloadStatus,
          errorMessage: payloadError,
          updatedAt: payloadUpdatedAt
        };
        changed = true;
      }

      if (!changed && payloadChannel && !payloadJobId) {
        const current = prev[payloadChannel];
        if (current) {
          next[payloadChannel] = {
            id: current.id,
            status: payloadStatus,
            errorMessage: payloadError,
            updatedAt: payloadUpdatedAt
          };
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  });

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

  async function enqueueOne(channel: PrintChannel, printerTarget: string) {
    const response = await fetch("/api/print/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        orderId,
        channel,
        printerTarget
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Cannot enqueue print");
    }

    return {
      id: payload.id,
      status: (payload.status as PrintJobStatus) || "PENDING",
      errorMessage: payload.errorMessage || null,
      updatedAt: payload.updatedAt || new Date().toISOString()
    } as EnqueueResponse;
  }

  async function enqueue(channel: PrintChannel) {
    if (!orderId) return;
    if (printDisabled) {
      setError("บิลที่ยกเลิกแล้วไม่สามารถส่งพิมพ์ได้");
      return;
    }
    const selectedPrinter = channel === "CASHIER_RECEIPT" ? cashierPrinter : kitchenPrinter;
    if (!selectedPrinter) {
      setError("กรุณาเลือกเครื่องปริ้นก่อนส่งคิว");
      return;
    }

    setQueueingAction(channel);
    setPrintMenuOpen(false);
    setError("");
    setMessage("");

    try {
      const result = await enqueueOne(channel, selectedPrinter);
      setPrintJobs((prev) => ({
        ...prev,
        [channel]: result
      }));
      setMessage(`ส่งคิวแล้ว (${result.id})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot enqueue print");
    } finally {
      setQueueingAction(null);
    }
  }

  async function enqueueBoth() {
    if (!orderId) return;
    if (printDisabled) {
      setError("บิลที่ยกเลิกแล้วไม่สามารถส่งพิมพ์ได้");
      return;
    }
    if (!cashierPrinter || !kitchenPrinter) {
      setError("กรุณาเลือกเครื่องพิมพ์ทั้งใบเสร็จและบิลครัวก่อน");
      return;
    }

    setQueueingAction("BOTH");
    setPrintMenuOpen(false);
    setError("");
    setMessage("");

    try {
      const [cashierJob, kitchenJob] = await Promise.all([
        enqueueOne("CASHIER_RECEIPT", cashierPrinter),
        enqueueOne("KITCHEN_TICKET", kitchenPrinter)
      ]);

      setPrintJobs((prev) => ({
        ...prev,
        CASHIER_RECEIPT: cashierJob,
        KITCHEN_TICKET: kitchenJob
      }));
      setMessage(`ส่งคิวสองเครื่องแล้ว (${cashierJob.id}, ${kitchenJob.id})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot enqueue both print jobs");
    } finally {
      setQueueingAction(null);
    }
  }

  async function downloadPdf() {
    if (!orderId) return;
    setDownloadingPdf(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/receipts/${orderId}/pdf`, {
        cache: "no-store"
      });

      if (!response.ok) {
        let message = "Cannot download PDF";
        try {
          const payload = await response.json();
          if (payload?.error) {
            message = payload.error;
          }
        } catch {
          // ignore parse errors and keep generic message
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const fileName = `receipt-${data?.order.orderNumber || orderId}.pdf`;
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      setMessage(`ดาวน์โหลด PDF แล้ว (${fileName})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (!orderId) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel">
        <div className="modal-header hide-print">
          <h3 className="m-0 text-lg font-semibold">พรีวิวใบเสร็จ</h3>
          <button className="secondary" onClick={onClose}>
            ปิด
          </button>
        </div>

        <section className="hide-print mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <div className="field mb-0">
              <label className="text-xs">เครื่องพิมพ์ใบเสร็จ</label>
              <select value={cashierPrinter} onChange={(event) => setCashierPrinter(event.target.value)}>
                <option value="">เลือกเครื่องพิมพ์</option>
                {printers
                  .filter((item) => item.channels.includes("CASHIER_RECEIPT"))
                  .map((item) => (
                    <option key={`cashier-${item.target}`} value={item.target} disabled={!isPrinterAvailable(item)}>
                      {formatPrinterOptionLabel(item)}
                    </option>
                  ))}
              </select>
              <p className="mt-1 break-all text-xs text-[var(--muted)]">
                {cashierSelectedPrinter ? `เลือก: ${cashierSelectedPrinter.label} (${cashierSelectedPrinter.target})` : "ยังไม่เลือกเครื่อง"}
              </p>
            </div>

            <div className="field mb-0">
              <label className="text-xs">เครื่องพิมพ์บิลครัว</label>
              <select value={kitchenPrinter} onChange={(event) => setKitchenPrinter(event.target.value)}>
                <option value="">เลือกเครื่องพิมพ์</option>
                {printers
                  .filter((item) => item.channels.includes("KITCHEN_TICKET"))
                  .map((item) => (
                    <option key={`kitchen-${item.target}`} value={item.target} disabled={!isPrinterAvailable(item)}>
                      {formatPrinterOptionLabel(item)}
                    </option>
                  ))}
              </select>
              <p className="mt-1 break-all text-xs text-[var(--muted)]">
                {kitchenSelectedPrinter ? `เลือก: ${kitchenSelectedPrinter.label} (${kitchenSelectedPrinter.target})` : "ยังไม่เลือกเครื่อง"}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <button type="button" className="secondary" onClick={() => void downloadPdf()} disabled={downloadingPdf}>
                {downloadingPdf ? "กำลังดาวน์โหลด..." : "ดาวน์โหลด PDF"}
              </button>
              <div className="relative" ref={printMenuRef}>
                <div className="inline-flex">
                  <button
                    type="button"
                    disabled={queueingAction !== null || printDisabled}
                    onClick={() => void enqueueBoth()}
                    className="rounded-r-none border-r border-white/30 px-4"
                  >
                    {queueingAction === "BOTH"
                      ? "กำลังส่ง 2 เครื่อง..."
                      : queueingAction === "CASHIER_RECEIPT"
                        ? "กำลังส่งใบเสร็จ..."
                        : queueingAction === "KITCHEN_TICKET"
                          ? "กำลังส่งบิลครัว..."
                          : "พิมพ์ 2 เครื่อง"}
                  </button>
                  <button
                    type="button"
                    className="rounded-l-none px-3"
                    disabled={queueingAction !== null || printDisabled}
                    onClick={() => setPrintMenuOpen((prev) => !prev)}
                    aria-label="เปิดตัวเลือกการพิมพ์"
                  >
                    <span className="text-xs">▾</span>
                  </button>
                </div>

                {printMenuOpen ? (
                  <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-1 shadow-lg">
                    <button
                      type="button"
                      className="secondary mb-1 w-full justify-start text-left"
                      disabled={queueingAction !== null}
                      onClick={() => void enqueueBoth()}
                    >
                      พิมพ์ 2 เครื่อง (ใบเสร็จ + ครัว)
                    </button>
                    <button
                      type="button"
                      className="secondary mb-1 w-full justify-start text-left"
                      disabled={queueingAction !== null}
                      onClick={() => void enqueue("CASHIER_RECEIPT")}
                    >
                      พิมพ์เฉพาะใบเสร็จ
                    </button>
                    <button
                      type="button"
                      className="secondary w-full justify-start text-left"
                      disabled={queueingAction !== null}
                      onClick={() => void enqueue("KITCHEN_TICKET")}
                    >
                      พิมพ์เฉพาะบิลครัว
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {printJobs.CASHIER_RECEIPT ? (
          <p className={`hide-print mt-0 text-sm ${statusTone(printJobs.CASHIER_RECEIPT.status)}`}>
            สถานะใบเสร็จ: {jobStatusText("CASHIER_RECEIPT")}
          </p>
        ) : null}
        {printJobs.KITCHEN_TICKET ? (
          <p className={`hide-print mt-0 text-sm ${statusTone(printJobs.KITCHEN_TICKET.status)}`}>
            สถานะบิลครัว: {jobStatusText("KITCHEN_TICKET")}
          </p>
        ) : null}

        {message ? <p className="hide-print mt-0 text-sm text-[var(--ok)]">{message}</p> : null}
        {error ? <p className="hide-print mt-0 text-sm text-red-600">{error}</p> : null}
        {data ? (
          <p className="hide-print mt-0 text-sm text-[var(--muted)]">
            สถานะบิล: {data.order.status === "PAID" ? "ชำระแล้ว" : data.order.status === "OPEN" ? "บิลล่วงหน้า" : "ยกเลิก"}
          </p>
        ) : null}

        {loading ? <p>กำลังโหลดใบเสร็จ...</p> : null}
        {data ? <ReceiptDocument order={data.order} store={data.store} template={data.template} /> : null}
      </div>
    </div>
  );
}
