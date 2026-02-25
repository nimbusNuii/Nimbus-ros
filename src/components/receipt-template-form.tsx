"use client";

import { FormEvent, useMemo, useState } from "react";
import { ReceiptDocument } from "@/components/receipt-document";

type Template = {
  id: string;
  name: string;
  headerText: string;
  footerText: string;
  showStoreInfo: boolean;
  showVatNumber: boolean;
  showCostBreakdown: boolean;
  paperWidth: number;
  customCss: string | null;
  isDefault: boolean;
};

type Store = {
  businessName: string;
  branchName: string | null;
  address: string | null;
  phone: string | null;
  vatNumber: string | null;
  currency: string;
};

type ReceiptTemplateFormProps = {
  initialTemplate: Template;
  store: Store;
};

export function ReceiptTemplateForm({ initialTemplate, store }: ReceiptTemplateFormProps) {
  const [template, setTemplate] = useState(initialTemplate);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const previewOrder = useMemo(
    () => ({
      orderNumber: "ORD-DEMO-001",
      createdAt: new Date().toISOString(),
      paymentMethod: "CASH",
      subtotal: 240,
      discount: 10,
      tax: 16.1,
      total: 246.1,
      items: [
        { id: "1", name: "Americano", qty: 2, unitPrice: 70, unitCost: 24, lineTotal: 140 },
        { id: "2", name: "Croissant", qty: 1, unitPrice: 60, unitCost: 20, lineTotal: 60 },
        { id: "3", name: "Latte", qty: 1, unitPrice: 40, unitCost: 12, lineTotal: 40 }
      ]
    }),
    []
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      id: template.id,
      name: String(form.get("name") || "Default Receipt"),
      headerText: String(form.get("headerText") || ""),
      footerText: String(form.get("footerText") || ""),
      showStoreInfo: Boolean(form.get("showStoreInfo")),
      showVatNumber: Boolean(form.get("showVatNumber")),
      showCostBreakdown: Boolean(form.get("showCostBreakdown")),
      paperWidth: Number(form.get("paperWidth")) === 58 ? 58 : 80,
      customCss: String(form.get("customCss") || ""),
      isDefault: true
    };

    try {
      const response = await fetch("/api/receipt-template", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Cannot save template");
      }

      setTemplate(data);
      setMessage("บันทึก template สำเร็จ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>ตั้งค่า Template ใบเสร็จ</h2>
        <p className="page-subtitle" style={{ marginTop: 0 }}>
          ใช้ตัวแปร: {"{{businessName}}"}, {"{{orderNumber}}"}, {"{{date}}"}, {"{{total}}"}
        </p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">ชื่อ template</label>
            <input
              id="name"
              name="name"
              value={template.name}
              onChange={(event) => setTemplate((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="headerText">ข้อความหัวใบเสร็จ</label>
            <textarea
              id="headerText"
              name="headerText"
              rows={4}
              value={template.headerText}
              onChange={(event) => setTemplate((prev) => ({ ...prev, headerText: event.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="footerText">ข้อความท้ายใบเสร็จ</label>
            <textarea
              id="footerText"
              name="footerText"
              rows={4}
              value={template.footerText}
              onChange={(event) => setTemplate((prev) => ({ ...prev, footerText: event.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="paperWidth">ความกว้างกระดาษ</label>
            <select
              id="paperWidth"
              name="paperWidth"
              value={template.paperWidth}
              onChange={(event) => setTemplate((prev) => ({ ...prev, paperWidth: Number(event.target.value) }))}
            >
              <option value={80}>80 mm</option>
              <option value={58}>58 mm</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="customCss">Custom CSS (optional)</label>
            <textarea
              id="customCss"
              name="customCss"
              rows={6}
              value={template.customCss || ""}
              onChange={(event) => setTemplate((prev) => ({ ...prev, customCss: event.target.value }))}
            />
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "inherit" }}>
              <input
                type="checkbox"
                name="showStoreInfo"
                checked={template.showStoreInfo}
                onChange={(event) => setTemplate((prev) => ({ ...prev, showStoreInfo: event.target.checked }))}
              />
              แสดงข้อมูลร้าน
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "inherit" }}>
              <input
                type="checkbox"
                name="showVatNumber"
                checked={template.showVatNumber}
                onChange={(event) => setTemplate((prev) => ({ ...prev, showVatNumber: event.target.checked }))}
              />
              แสดงเลขภาษี
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "inherit" }}>
              <input
                type="checkbox"
                name="showCostBreakdown"
                checked={template.showCostBreakdown}
                onChange={(event) => setTemplate((prev) => ({ ...prev, showCostBreakdown: event.target.checked }))}
              />
              แสดงต้นทุนประมาณการ
            </label>
          </div>

          <button disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก template"}</button>
        </form>

        {message ? <p style={{ color: "var(--ok)" }}>{message}</p> : null}
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>ตัวอย่างใบเสร็จ</h2>
        <ReceiptDocument order={previewOrder} store={store} template={template} />
      </section>
    </div>
  );
}
