"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { ImageCropModal } from "@/components/image-crop-modal";

type StoreSettings = {
  businessName: string;
  branchName: string | null;
  address: string | null;
  phone: string | null;
  vatNumber: string | null;
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

export function StoreSettingsForm({ initialSettings }: StoreSettingsFormProps) {
  const [state, setState] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [logoInfo, setLogoInfo] = useState("");
  const [processingLogo, setProcessingLogo] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [cropLogoFile, setCropLogoFile] = useState<File | null>(null);

  async function onLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoInfo("");
      setCropLogoFile(null);
      setProcessingLogo(false);
      return;
    }

    setError("");
    setProcessingLogo(true);
    setCropLogoFile(file);
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
      appThemeKey: "sandstone",
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
    <form
      onSubmit={onSubmit}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {/* ── Section: ข้อมูลร้าน ── */}
      <div style={{ padding: "20px 24px" }}>
        <p style={{ margin: "0 0 14px", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>
          ข้อมูลร้าน
        </p>
        <div style={{ display: "grid", gap: "12px 16px", gridTemplateColumns: "repeat(2, 1fr)" }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="businessName">ชื่อร้าน *</label>
            <input id="businessName" name="businessName" defaultValue={state.businessName} required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="branchName">สาขา</label>
            <input id="branchName" name="branchName" defaultValue={state.branchName || ""} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="phone">เบอร์โทร</label>
            <input id="phone" name="phone" defaultValue={state.phone || ""} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="vatNumber">เลขภาษี</label>
            <input id="vatNumber" name="vatNumber" defaultValue={state.vatNumber || ""} />
          </div>
          <div className="field" style={{ margin: 0, gridColumn: "1 / -1" }}>
            <label htmlFor="address">ที่อยู่</label>
            <textarea id="address" name="address" rows={2} defaultValue={state.address || ""} style={{ resize: "vertical" }} />
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "var(--line)" }} />

      {/* ── Section: การเงิน ── */}
      <div style={{ padding: "20px 24px" }}>
        <p style={{ margin: "0 0 14px", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>
          การเงิน
        </p>
        <div style={{ display: "grid", gap: "12px 16px", gridTemplateColumns: "repeat(2, 1fr)" }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="currency">สกุลเงิน</label>
            <input id="currency" name="currency" defaultValue={state.currency} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="taxRate">ภาษี (%)</label>
            <input
              id="taxRate"
              name="taxRate"
              type="number"
              step="0.01"
              value={state.taxRate}
              onChange={(e) => setState((prev) => ({ ...prev, taxRate: Number(e.target.value) || 0 }))}
              disabled={!state.vatEnabled}
            />
          </div>
          <div className="field" style={{ margin: 0, gridColumn: "1 / -1" }}>
            <label
              htmlFor="vatEnabled"
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            >
              <input
                id="vatEnabled"
                name="vatEnabled"
                type="checkbox"
                style={{ width: 15, height: 15, accentColor: "var(--brand)", margin: 0 }}
                checked={state.vatEnabled}
                onChange={(e) => setState((prev) => ({ ...prev, vatEnabled: e.target.checked }))}
              />
              <span style={{ fontSize: "0.825rem", color: "var(--text)" }}>
                เปิดใช้งาน VAT — {state.vatEnabled ? "ระบบจะคำนวณ VAT จาก % ที่กำหนด" : "ปิดอยู่ ใบเสร็จจะไม่คิดภาษี"}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "var(--line)" }} />

      {/* ── Section: รูปแบบ ── */}
      <div style={{ padding: "20px 24px" }}>
        <p style={{ margin: "0 0 14px", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>
          รูปแบบ
        </p>
        <div style={{ display: "grid", gap: "12px 16px", gridTemplateColumns: "repeat(2, 1fr)" }}>
          {/* Brand primary */}
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="brandPrimary">สีหลักแบรนด์</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="brandPrimary"
                type="color"
                value={state.brandPrimary}
                onChange={(e) => setState((prev) => ({ ...prev, brandPrimary: e.target.value }))}
                style={{ width: 40, height: 36, padding: 2, borderRadius: 8, border: "1px solid var(--line)", cursor: "pointer", flexShrink: 0 }}
              />
              <input type="hidden" name="brandPrimary" value={state.brandPrimary} />
              <input
                aria-label="Brand primary hex"
                value={state.brandPrimary}
                onChange={(e) => setState((prev) => ({ ...prev, brandPrimary: e.target.value }))}
                style={{ flex: 1 }}
              />
            </div>
          </div>
          {/* Brand accent */}
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="brandAccent">สีรองแบรนด์</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="brandAccent"
                type="color"
                value={state.brandAccent}
                onChange={(e) => setState((prev) => ({ ...prev, brandAccent: e.target.value }))}
                style={{ width: 40, height: 36, padding: 2, borderRadius: 8, border: "1px solid var(--line)", cursor: "pointer", flexShrink: 0 }}
              />
              <input type="hidden" name="brandAccent" value={state.brandAccent} />
              <input
                aria-label="Brand accent hex"
                value={state.brandAccent}
                onChange={(e) => setState((prev) => ({ ...prev, brandAccent: e.target.value }))}
                style={{ flex: 1 }}
              />
            </div>
          </div>
          {/* Logo */}
          <div className="field" style={{ margin: 0, gridColumn: "1 / -1" }}>
            <label htmlFor="receiptLogoFile">โลโก้ใบเสร็จ</label>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {state.receiptLogoUrl && (
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.receiptLogoUrl}
                    alt="Receipt logo preview"
                    style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: "1px solid var(--line)" }}
                  />
                  <button
                    type="button"
                    className="secondary"
                    style={{ fontSize: "0.7rem", padding: "3px 10px" }}
                    onClick={() => {
                      setState((prev) => ({ ...prev, receiptLogoUrl: null }));
                      setLogoInfo("");
                      setCropLogoFile(null);
                      setProcessingLogo(false);
                      setFileInputKey((prev) => prev + 1);
                    }}
                  >
                    ลบ
                  </button>
                </div>
              )}
              <div style={{ flex: 1 }}>
                <input
                  key={fileInputKey}
                  id="receiptLogoFile"
                  type="file"
                  accept="image/*"
                  onChange={onLogoFileChange}
                  disabled={processingLogo}
                />
                <input type="hidden" name="receiptLogoUrl" value={state.receiptLogoUrl || ""} />
                <p style={{ margin: "4px 0 0", fontSize: "0.7rem", color: "var(--muted)" }}>
                  {logoInfo ? logoInfo : "ครอปอัตโนมัติ 1:1 · บีบไม่เกิน 10KB"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer: save ── */}
      <div
        style={{
          borderTop: "1px solid var(--line)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "var(--bg)",
        }}
      >
        <div style={{ fontSize: "0.8rem" }}>
          {message && <span style={{ color: "var(--ok)" }}>{message}</span>}
          {error && <span style={{ color: "crimson" }}>{error}</span>}
        </div>
        <button disabled={saving || processingLogo} style={{ margin: 0, minWidth: 140 }}>
          {saving ? "กำลังบันทึก..." : processingLogo ? "กำลังย่อรูป..." : "บันทึกข้อมูลร้าน"}
        </button>
      </div>

      <ImageCropModal
        open={Boolean(cropLogoFile)}
        file={cropLogoFile}
        title="ครอปโลโก้ใบเสร็จ"
        description="เลือกตำแหน่งโลโก้สำหรับแสดงบนหัวใบเสร็จ"
        onCancel={() => {
          setCropLogoFile(null);
          setProcessingLogo(false);
          setFileInputKey((prev) => prev + 1);
        }}
        onApply={({ dataUrl, info }) => {
          setState((prev) => ({ ...prev, receiptLogoUrl: dataUrl }));
          setLogoInfo(info);
          setCropLogoFile(null);
          setProcessingLogo(false);
          setFileInputKey((prev) => prev + 1);
        }}
      />
    </form>
  );
}
