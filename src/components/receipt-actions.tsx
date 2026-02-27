"use client";

import Link from "next/link";
import { useState } from "react";

type ReceiptActionsProps = {
  orderId: string;
};

export function ReceiptActions({ orderId }: ReceiptActionsProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [printerTarget, setPrinterTarget] = useState("");

  async function enqueuePrint(channel: "CASHIER_RECEIPT" | "KITCHEN_TICKET") {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/print/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ orderId, channel, printerTarget: printerTarget.trim() || undefined })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Cannot enqueue print");
      }

      setMessage(`ส่งคิวพิมพ์แล้ว (${data.id})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot enqueue print");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    setDownloadingPdf(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/receipts/${orderId}/pdf`, { cache: "no-store" });
      if (!response.ok) {
        let message = "Cannot download PDF";
        try {
          const payload = await response.json();
          if (payload?.error) message = payload.error;
        } catch {
          // ignore parse errors and keep generic message
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `receipt-${orderId}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      setMessage("ดาวน์โหลด PDF แล้ว");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="hide-print" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="secondary" type="button" disabled={downloadingPdf} onClick={() => void downloadPdf()}>
          {downloadingPdf ? "กำลังดาวน์โหลด..." : "ดาวน์โหลด PDF"}
        </button>
        <input
          value={printerTarget}
          onChange={(event) => setPrinterTarget(event.target.value)}
          placeholder="target (optional): cashier / kitchen"
          style={{ minWidth: 220 }}
        />
        <button className="secondary" type="button" disabled={loading} onClick={() => enqueuePrint("CASHIER_RECEIPT")}>
          {loading ? "กำลังส่งคิว..." : "คิวใบเสร็จ"}
        </button>
        <button className="secondary" type="button" disabled={loading} onClick={() => enqueuePrint("KITCHEN_TICKET")}>
          {loading ? "กำลังส่งคิว..." : "คิวบิลครัว"}
        </button>
        <Link href={`/api/print/receipt/${orderId}`} target="_blank" className="nav-link">
          ดาวน์โหลดคำสั่ง ESC/POS
        </Link>
        <Link href="/pos" className="pill" style={{ alignSelf: "center" }}>
          กลับหน้าร้าน
        </Link>
      </div>
      {message ? <p style={{ color: "var(--ok)" }}>{message}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </div>
  );
}
