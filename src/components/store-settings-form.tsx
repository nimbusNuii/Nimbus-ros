"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { APP_THEME_PRESETS } from "@/lib/app-theme-presets";

type StoreSettings = {
  businessName: string;
  branchName: string | null;
  address: string | null;
  phone: string | null;
  vatNumber: string | null;
  appThemeKey: string;
  brandPrimary: string;
  brandAccent: string;
  receiptLogoUrl: string | null;
  vatEnabled: boolean;
  taxRate: number;
  currency: string;
};

type StoreSettingsFormProps = {
  initialSettings: StoreSettings;
};

const IMAGE_MAX_SIDE = 720;
const TARGET_DATA_URL_LENGTH = 320_000;
const MIN_QUALITY = 0.55;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Cannot read image file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cannot load image"));
    image.src = source;
  });
}

async function resizeImageFile(file: File) {
  const src = await readFileAsDataUrl(file);
  const image = await loadImage(src);
  const ratio = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot process image");

  ctx.drawImage(image, 0, 0, width, height);
  let quality = 0.82;
  let output = canvas.toDataURL("image/jpeg", quality);
  while (output.length > TARGET_DATA_URL_LENGTH && quality > MIN_QUALITY) {
    quality -= 0.08;
    output = canvas.toDataURL("image/jpeg", quality);
  }

  return output;
}

export function StoreSettingsForm({ initialSettings }: StoreSettingsFormProps) {
  const [state, setState] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoInfo, setLogoInfo] = useState("");
  const [processingLogo, setProcessingLogo] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  async function onLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoInfo("");
      return;
    }

    setProcessingLogo(true);
    setError("");
    try {
      const resized = await resizeImageFile(file);
      const sizeKb = Math.round((resized.length * 0.75) / 1024);
      setState((prev) => ({ ...prev, receiptLogoUrl: resized }));
      setLogoInfo(`ไฟล์ถูกย่อและแปลงแล้ว ~${sizeKb} KB`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot process image");
    } finally {
      setProcessingLogo(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      businessName: String(form.get("businessName") || ""),
      branchName: String(form.get("branchName") || ""),
      address: String(form.get("address") || ""),
      phone: String(form.get("phone") || ""),
      vatNumber: String(form.get("vatNumber") || ""),
      appThemeKey: String(form.get("appThemeKey") || "sandstone"),
      brandPrimary: String(form.get("brandPrimary") || "#b24a2b"),
      brandAccent: String(form.get("brandAccent") || "#8f381f"),
      receiptLogoUrl: String(form.get("receiptLogoUrl") || ""),
      vatEnabled: Boolean(form.get("vatEnabled")),
      taxRate: Number(form.get("taxRate") || "0"),
      currency: String(form.get("currency") || "THB")
    };

    try {
      const response = await fetch("/api/store-settings", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Cannot update settings");
      }

      setState(data);
      setMessage("บันทึกข้อมูลร้านเรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot update settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card space-y-4">
      <h2 className="mt-0 text-xl font-semibold">ข้อมูลร้าน</h2>
      <form onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="field">
            <label htmlFor="businessName">ชื่อร้าน *</label>
            <input id="businessName" name="businessName" defaultValue={state.businessName} required />
          </div>
          <div className="field">
            <label htmlFor="branchName">สาขา</label>
            <input id="branchName" name="branchName" defaultValue={state.branchName || ""} />
          </div>
          <div className="field">
            <label htmlFor="phone">เบอร์โทร</label>
            <input id="phone" name="phone" defaultValue={state.phone || ""} />
          </div>
          <div className="field">
            <label htmlFor="vatNumber">เลขภาษี</label>
            <input id="vatNumber" name="vatNumber" defaultValue={state.vatNumber || ""} />
          </div>
          <div className="field">
            <label htmlFor="taxRate">ภาษี (%)</label>
            <input
              id="taxRate"
              name="taxRate"
              type="number"
              step="0.01"
              value={state.taxRate}
              onChange={(event) => setState((prev) => ({ ...prev, taxRate: Number(event.target.value) || 0 }))}
              disabled={!state.vatEnabled}
            />
            <p className="mb-0 mt-1 text-xs text-[var(--muted)]">
              {state.vatEnabled ? "ระบบจะคำนวณ VAT จาก % นี้" : "ปิด VAT อยู่ จะไม่คิดภาษีในใบเสร็จใหม่"}
            </p>
          </div>
          <div className="field">
            <label htmlFor="currency">สกุลเงิน</label>
            <input id="currency" name="currency" defaultValue={state.currency} />
          </div>
          <div className="field">
            <label htmlFor="vatEnabled">เปิดใช้งาน VAT</label>
            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
              <input
                id="vatEnabled"
                name="vatEnabled"
                type="checkbox"
                checked={state.vatEnabled}
                onChange={(event) => setState((prev) => ({ ...prev, vatEnabled: event.target.checked }))}
              />
              คิด VAT อัตโนมัติใน POS/ใบเสร็จ
            </label>
          </div>
          <div className="field">
            <label htmlFor="appThemeKey">ธีมหลักของระบบ</label>
            <select
              id="appThemeKey"
              name="appThemeKey"
              value={state.appThemeKey}
              onChange={(event) => setState((prev) => ({ ...prev, appThemeKey: event.target.value }))}
            >
              {APP_THEME_PRESETS.map((theme) => (
                <option key={theme.key} value={theme.key}>
                  {theme.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="receiptLogoFile">โลโก้ใบเสร็จ (ไฟล์)</label>
            <input
              key={fileInputKey}
              id="receiptLogoFile"
              type="file"
              accept="image/*"
              onChange={onLogoFileChange}
              disabled={processingLogo}
            />
            <input type="hidden" name="receiptLogoUrl" value={state.receiptLogoUrl || ""} />
            <p className="mb-0 mt-1 text-xs text-[var(--muted)]">
              ระบบจะย่อรูปอัตโนมัติและเก็บเป็น base64 เหมือนรูปสินค้า
            </p>
          </div>
          <div className="field">
            <label htmlFor="brandPrimary">สีหลักแบรนด์</label>
            <div className="flex items-center gap-2">
              <input
                id="brandPrimary"
                type="color"
                value={state.brandPrimary}
                onChange={(event) => setState((prev) => ({ ...prev, brandPrimary: event.target.value }))}
                className="h-10 w-14 cursor-pointer rounded-lg border"
              />
              <input type="hidden" name="brandPrimary" value={state.brandPrimary} />
              <input
                aria-label="Brand primary hex"
                value={state.brandPrimary}
                onChange={(event) => setState((prev) => ({ ...prev, brandPrimary: event.target.value }))}
                className="flex-1"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="brandAccent">สีรองแบรนด์</label>
            <div className="flex items-center gap-2">
              <input
                id="brandAccent"
                type="color"
                value={state.brandAccent}
                onChange={(event) => setState((prev) => ({ ...prev, brandAccent: event.target.value }))}
                className="h-10 w-14 cursor-pointer rounded-lg border"
              />
              <input type="hidden" name="brandAccent" value={state.brandAccent} />
              <input
                aria-label="Brand accent hex"
                value={state.brandAccent}
                onChange={(event) => setState((prev) => ({ ...prev, brandAccent: event.target.value }))}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="address">ที่อยู่</label>
          <textarea id="address" name="address" rows={3} defaultValue={state.address || ""} />
        </div>

        <button disabled={saving || processingLogo}>
          {saving ? "กำลังบันทึก..." : processingLogo ? "กำลังย่อรูป..." : "บันทึกข้อมูลร้าน"}
        </button>
      </form>
      {state.receiptLogoUrl ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
          <p className="mb-2 text-sm text-[var(--muted)]">
            ตัวอย่างโลโก้บนใบเสร็จ {logoInfo ? `(${logoInfo})` : ""}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.receiptLogoUrl} alt="Receipt logo preview" className="mx-auto max-h-20 w-auto object-contain" />
          <button
            type="button"
            className="secondary mt-2"
            onClick={() => {
              setState((prev) => ({ ...prev, receiptLogoUrl: null }));
              setLogoInfo("");
              setFileInputKey((prev) => prev + 1);
            }}
          >
            ลบรูป
          </button>
        </div>
      ) : null}
      {message ? <p style={{ color: "var(--ok)" }}>{message}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </section>
  );
}
