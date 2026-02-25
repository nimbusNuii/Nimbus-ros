"use client";

import { FormEvent, useState } from "react";

type StoreSettings = {
  businessName: string;
  branchName: string | null;
  address: string | null;
  phone: string | null;
  vatNumber: string | null;
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
    <section className="card">
      <h2 style={{ marginTop: 0 }}>ข้อมูลร้าน</h2>
      <form onSubmit={onSubmit}>
        <div className="grid grid-2">
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
            <input id="taxRate" name="taxRate" type="number" step="0.01" defaultValue={state.taxRate} />
          </div>
          <div className="field">
            <label htmlFor="currency">สกุลเงิน</label>
            <input id="currency" name="currency" defaultValue={state.currency} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="address">ที่อยู่</label>
          <textarea id="address" name="address" rows={3} defaultValue={state.address || ""} />
        </div>

        <button disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูลร้าน"}</button>
      </form>
      {message ? <p style={{ color: "var(--ok)" }}>{message}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </section>
  );
}
