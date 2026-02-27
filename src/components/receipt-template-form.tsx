"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ReceiptDocument } from "@/components/receipt-document";
import {
  getReceiptThemePreset,
  RECEIPT_THEME_PRESETS,
  type ReceiptThemePreset
} from "@/lib/receipt-theme-presets";

type Template = {
  id: string;
  name: string;
  selectedPresetKey: string | null;
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
  receiptLogoUrl?: string | null;
  currency: string;
};

type ReceiptTemplateFormProps = {
  initialTemplate: Template;
  store: Store;
};

const RECEIPT_PRESET_STORAGE_KEY = "receipt_template_selected_preset";

export function ReceiptTemplateForm({ initialTemplate, store }: ReceiptTemplateFormProps) {
  const [template, setTemplate] = useState(initialTemplate);
  const [previewThemeKey, setPreviewThemeKey] = useState(() => {
    const initial = initialTemplate.selectedPresetKey;
    const exists = RECEIPT_THEME_PRESETS.some((item) => item.key === initial);
    return exists && initial ? initial : RECEIPT_THEME_PRESETS[0].key;
  });
  const [themePresetModalOpen, setThemePresetModalOpen] = useState(false);
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

  const previewTheme = useMemo(
    () => getReceiptThemePreset(previewThemeKey),
    [previewThemeKey]
  );

  function mergeTemplateWithTheme(current: Template, preset: ReceiptThemePreset): Template {
    return {
      ...current,
      name: preset.template.name,
      selectedPresetKey: preset.key,
      headerText: preset.template.headerText,
      footerText: preset.template.footerText,
      showStoreInfo: preset.template.showStoreInfo,
      showVatNumber: preset.template.showVatNumber,
      showCostBreakdown: preset.template.showCostBreakdown,
      paperWidth: preset.template.paperWidth,
      customCss: preset.template.customCss
    };
  }

  async function persistSelectedPresetKey(nextKey: string) {
    try {
      const response = await fetch("/api/receipt-template", {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          selectedPresetKey: nextKey
        })
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Cannot persist selected preset");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot persist selected preset");
    }
  }

  function selectPresetKey(nextKey: string) {
    setPreviewThemeKey(nextKey);
    setTemplate((prev) => ({ ...prev, selectedPresetKey: nextKey }));
    void persistSelectedPresetKey(nextKey);
  }

  function applyThemePreset(preset: ReceiptThemePreset) {
    setTemplate((current) => mergeTemplateWithTheme(current, preset));
    selectPresetKey(preset.key);
    setThemePresetModalOpen(false);
    setMessage(`โหลดธีม ${preset.label} แล้ว กดบันทึกเพื่อใช้งานจริง`);
    setError("");
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(RECEIPT_PRESET_STORAGE_KEY);
    const exists = RECEIPT_THEME_PRESETS.some((item) => item.key === stored);
    if (stored && exists) {
      setPreviewThemeKey(stored);
      setTemplate((prev) => ({ ...prev, selectedPresetKey: stored }));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(RECEIPT_PRESET_STORAGE_KEY, previewThemeKey);
  }, [previewThemeKey]);

  useEffect(() => {
    if (!themePresetModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setThemePresetModalOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [themePresetModalOpen]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      id: template.id,
      name: String(form.get("name") || "Default Receipt"),
      selectedPresetKey: previewThemeKey,
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
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-semibold">Theme Presets</h2>
            <p className="mb-0 mt-1 text-sm text-[var(--muted)]">เลือกจาก Modal แล้วค่อยนำมาใช้กับ template ปัจจุบัน</p>
          </div>
          <button type="button" onClick={() => setThemePresetModalOpen(true)}>
            เลือก Theme Preset
          </button>
        </div>
        <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
          <p className="m-0 text-sm font-semibold text-[var(--text)]">ธีมที่กำลังพรีวิว: {previewTheme.label}</p>
          <p className="mb-0 mt-1 text-sm text-[var(--muted)]">{previewTheme.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {previewTheme.tags.map((tag) => (
              <span key={`preview-${previewTheme.key}-${tag}`} className="pill">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card">
          <h2 className="mt-0 text-xl font-semibold">ตั้งค่า Template ใบเสร็จ</h2>
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

            <div className="mb-3 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-[var(--text)]">
                <input
                  type="checkbox"
                  name="showStoreInfo"
                  checked={template.showStoreInfo}
                  onChange={(event) => setTemplate((prev) => ({ ...prev, showStoreInfo: event.target.checked }))}
                />
                แสดงข้อมูลร้าน
              </label>

              <label className="flex items-center gap-2 text-[var(--text)]">
                <input
                  type="checkbox"
                  name="showVatNumber"
                  checked={template.showVatNumber}
                  onChange={(event) => setTemplate((prev) => ({ ...prev, showVatNumber: event.target.checked }))}
                />
                แสดงเลขภาษี
              </label>

              <label className="flex items-center gap-2 text-[var(--text)]">
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

          {message ? <p className="m-0 text-sm text-[var(--ok)]">{message}</p> : null}
          {error ? <p className="m-0 text-sm text-red-600">{error}</p> : null}
        </section>

        <section className="card">
          <h2 className="mt-0 text-xl font-semibold">ตัวอย่างธีม: {previewTheme.label}</h2>
          <ReceiptDocument
            order={previewOrder}
            store={store}
            template={mergeTemplateWithTheme(template, previewTheme)}
          />

          <hr className="my-4 border-0 border-t border-[var(--line)]" />

          <h2 className="mt-0 text-xl font-semibold">ตัวอย่างใบเสร็จ (ค่าปัจจุบัน)</h2>
          <ReceiptDocument order={previewOrder} store={store} template={template} />
        </section>
      </div>

      {themePresetModalOpen ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setThemePresetModalOpen(false);
            }
          }}
        >
          <div className="modal-panel w-full max-w-6xl">
            <div className="modal-header">
              <div>
                <h3 className="m-0 text-lg font-semibold">Theme Presets</h3>
                <p className="m-0 mt-1 text-sm text-[var(--muted)]">เลือกธีมแล้วดูตัวอย่างก่อนใช้งานจริง</p>
              </div>
              <button type="button" className="secondary" onClick={() => setThemePresetModalOpen(false)}>
                ปิด
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-3">
                {RECEIPT_THEME_PRESETS.map((preset) => (
                  <article
                    key={preset.key}
                    className={`rounded-xl border p-3 ${
                      previewThemeKey === preset.key
                        ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_8%,white)]"
                        : "border-[var(--line)] bg-white"
                    }`}
                  >
                    <h4 className="m-0 text-sm font-semibold">{preset.label}</h4>
                    <p className="mb-0 mt-1 text-xs text-[var(--muted)]">{preset.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {preset.tags.map((tag) => (
                        <span key={`${preset.key}-${tag}`} className="pill">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="secondary" onClick={() => selectPresetKey(preset.key)}>
                        ดูตัวอย่าง
                      </button>
                      <button type="button" onClick={() => applyThemePreset(preset)}>
                        ใช้ธีมนี้
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                <h4 className="m-0 text-sm font-semibold">ตัวอย่างการแสดงผล</h4>
                <p className="mb-0 mt-1 text-xs text-[var(--muted)]">พรีวิวจากธีม: {previewTheme.label}</p>
                <div className="mt-3 max-h-[62vh] overflow-auto rounded-lg border border-[var(--line)] bg-white p-2">
                  <ReceiptDocument
                    order={previewOrder}
                    store={store}
                    template={mergeTemplateWithTheme(template, previewTheme)}
                  />
                </div>
                <button type="button" className="mt-3 w-full" onClick={() => applyThemePreset(previewTheme)}>
                  ใช้ธีมที่กำลังพรีวิว
                </button>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
