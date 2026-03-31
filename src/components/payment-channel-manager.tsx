"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type PaymentChannel = {
  id: string;
  name: string;
  type: "CASH" | "CARD" | "TRANSFER" | "QR";
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  qrCodeUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type PaymentChannelManagerProps = {
  initialChannels: PaymentChannel[];
};

type DraftMap = Record<
  string,
  {
    name: string;
    type: "CASH" | "CARD" | "TRANSFER" | "QR";
    bankName: string;
    accountNumber: string;
    accountName: string;
    qrCodeUrl: string;
    sortOrder: number;
    isActive: boolean;
  }
>;

function buildDrafts(channels: PaymentChannel[]): DraftMap {
  return channels.reduce<DraftMap>((map, channel) => {
    map[channel.id] = {
      name: channel.name,
      type: channel.type,
      bankName: channel.bankName || "",
      accountNumber: channel.accountNumber || "",
      accountName: channel.accountName || "",
      qrCodeUrl: channel.qrCodeUrl || "",
      sortOrder: channel.sortOrder,
      isActive: channel.isActive
    };
    return map;
  }, {});
}

function paymentTypeLabel(type: "CASH" | "CARD" | "TRANSFER" | "QR") {
  if (type === "CASH") return "เงินสด";
  if (type === "CARD") return "บัตร";
  if (type === "TRANSFER") return "โอนเงิน";
  return "QR";
}

export function PaymentChannelManager({ initialChannels }: PaymentChannelManagerProps) {
  const [channels, setChannels] = useState(initialChannels);
  const [drafts, setDrafts] = useState<DraftMap>(() => buildDrafts(initialChannels));
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "CASH" | "CARD" | "TRANSFER" | "QR">("ALL");
  const [showInactive, setShowInactive] = useState(false);

  const activeCount = useMemo(() => channels.filter((item) => item.isActive).length, [channels]);

  const filteredChannels = useMemo(() => {
    let result = channels;
    if (filterType !== "ALL") {
      result = result.filter((item) => item.type === filterType);
    }
    if (!showInactive) {
      result = result.filter((item) => item.isActive);
    }
    return result.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name, "th");
    });
  }, [channels, filterType, showInactive]);

  useEffect(() => {
    setChannels(initialChannels);
    setDrafts(buildDrafts(initialChannels));
  }, [initialChannels]);

  function setDraftValue(
    channelId: string,
    key: keyof DraftMap[string],
    value: string | number | boolean
  ) {
    setDrafts((prev) => ({
      ...prev,
      [channelId]: {
        ...prev[channelId],
        [key]: value
      }
    }));
  }

  async function saveChannel(channelId: string) {
    const draft = drafts[channelId];
    if (!draft) return;

    setSavingId(channelId);
    setError("");

    try {
      const response = await fetch(`/api/payment-channels/${channelId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          type: draft.type,
          bankName: draft.bankName.trim() || null,
          accountNumber: draft.accountNumber.trim() || null,
          accountName: draft.accountName.trim() || null,
          qrCodeUrl: draft.qrCodeUrl.trim() || null,
          sortOrder: draft.sortOrder,
          isActive: draft.isActive
        })
      });

      const data = (await response.json()) as PaymentChannel | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot update payment channel");
      }

      const updated = data as PaymentChannel;
      setChannels((prev) => prev.map((item) => (item.id === channelId ? updated : item)));
      setDrafts((prev) => ({
        ...prev,
        [channelId]: {
          name: updated.name,
          type: updated.type,
          bankName: updated.bankName || "",
          accountNumber: updated.accountNumber || "",
          accountName: updated.accountName || "",
          qrCodeUrl: updated.qrCodeUrl || "",
          sortOrder: updated.sortOrder,
          isActive: updated.isActive
        }
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot update payment channel");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteChannel(channelId: string) {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return;

    if (!confirm(`ต้องการลบช่องทางการชำระเงิน "${channel.name}" หรือไม่?`)) {
      return;
    }

    setDeletingId(channelId);
    setError("");

    try {
      const response = await fetch(`/api/payment-channels/${channelId}`, {
        method: "DELETE"
      });

      const data = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot delete payment channel");
      }

      setChannels((prev) => prev.filter((item) => item.id !== channelId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot delete payment channel");
    } finally {
      setDeletingId(null);
    }
  }

  async function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const name = String(form.get("name") || "").trim();
    const type = String(form.get("type") || "CASH") as "CASH" | "CARD" | "TRANSFER" | "QR";
    const bankName = String(form.get("bankName") || "").trim();
    const accountNumber = String(form.get("accountNumber") || "").trim();
    const accountName = String(form.get("accountName") || "").trim();
    const qrCodeUrl = String(form.get("qrCodeUrl") || "").trim();
    const sortOrder = Number(form.get("sortOrder") || 0);

    if (!name) {
      setError("กรุณากรอกชื่อช่องทางการชำระเงิน");
      return;
    }

    setSavingId("new");
    setError("");

    try {
      const response = await fetch("/api/payment-channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          bankName: bankName || null,
          accountNumber: accountNumber || null,
          accountName: accountName || null,
          qrCodeUrl: qrCodeUrl || null,
          sortOrder,
          isActive: true
        })
      });

      const data = (await response.json()) as PaymentChannel | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot create payment channel");
      }

      const created = data as PaymentChannel;
      setChannels((prev) => [...prev, created]);
      setCreateModalOpen(false);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create payment channel");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--text)"
            }}
          >
            <option value="ALL">ทั้งหมด</option>
            <option value="CASH">เงินสด</option>
            <option value="CARD">บัตร</option>
            <option value="TRANSFER">โอนเงิน</option>
            <option value="QR">QR</option>
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span>แสดงที่ปิดใช้งาน</span>
          </label>

          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            ใช้งาน: {activeCount} / {channels.length}
          </div>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            background: "var(--brand-accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 500
          }}
        >
          + เพิ่มช่องทางการชำระเงิน
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: "#fee",
            color: "#c00",
            border: "1px solid #fcc"
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredChannels.map((channel) => {
          const draft = drafts[channel.id];
          if (!draft) return null;

          const hasChanges =
            draft.name !== channel.name ||
            draft.type !== channel.type ||
            draft.bankName !== (channel.bankName || "") ||
            draft.accountNumber !== (channel.accountNumber || "") ||
            draft.accountName !== (channel.accountName || "") ||
            draft.qrCodeUrl !== (channel.qrCodeUrl || "") ||
            draft.sortOrder !== channel.sortOrder ||
            draft.isActive !== channel.isActive;

          return (
            <div
              key={channel.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 20,
                opacity: draft.isActive ? 1 : 0.6
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                      ชื่อช่องทาง
                    </label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => setDraftValue(channel.id, "name", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                      ประเภท
                    </label>
                    <select
                      value={draft.type}
                      onChange={(e) => setDraftValue(channel.id, "type", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)"
                      }}
                    >
                      <option value="CASH">เงินสด</option>
                      <option value="CARD">บัตร</option>
                      <option value="TRANSFER">โอนเงิน</option>
                      <option value="QR">QR</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                      ธนาคาร
                    </label>
                    <input
                      type="text"
                      value={draft.bankName}
                      onChange={(e) => setDraftValue(channel.id, "bankName", e.target.value)}
                      placeholder="ธนาคารกสิกรไทย"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                      เลขที่บัญชี/เบอร์โทร
                    </label>
                    <input
                      type="text"
                      value={draft.accountNumber}
                      onChange={(e) => setDraftValue(channel.id, "accountNumber", e.target.value)}
                      placeholder="123-4-56789-0"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                      ชื่อบัญชี
                    </label>
                    <input
                      type="text"
                      value={draft.accountName}
                      onChange={(e) => setDraftValue(channel.id, "accountName", e.target.value)}
                      placeholder="ร้านหมูปิ้ง"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                      ลำดับ
                    </label>
                    <input
                      type="number"
                      value={draft.sortOrder}
                      onChange={(e) => setDraftValue(channel.id, "sortOrder", Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        color: "var(--text)"
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) => setDraftValue(channel.id, "isActive", e.target.checked)}
                    />
                    <span style={{ fontSize: 14 }}>เปิดใช้งาน</span>
                  </label>

                  <div style={{ flex: 1 }} />

                  {hasChanges && (
                    <button
                      onClick={() => saveChannel(channel.id)}
                      disabled={savingId === channel.id}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "var(--brand-primary)",
                        color: "#fff",
                        border: "none",
                        cursor: savingId === channel.id ? "not-allowed" : "pointer",
                        fontSize: 14,
                        fontWeight: 500
                      }}
                    >
                      {savingId === channel.id ? "กำลังบันทึก..." : "บันทึก"}
                    </button>
                  )}

                  <button
                    onClick={() => deleteChannel(channel.id)}
                    disabled={deletingId === channel.id}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      background: "#fee",
                      color: "#c00",
                      border: "1px solid #fcc",
                      cursor: deletingId === channel.id ? "not-allowed" : "pointer",
                      fontSize: 14,
                      fontWeight: 500
                    }}
                  >
                    {deletingId === channel.id ? "กำลังลบ..." : "ลบ"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {createModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateModalOpen(false);
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: 32,
              maxWidth: 600,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto"
            }}
          >
            <h2 style={{ margin: "0 0 24px 0", fontSize: 20, fontWeight: 600 }}>
              เพิ่มช่องทางการชำระเงิน
            </h2>

            <form onSubmit={createChannel} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  ชื่อช่องทาง *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="เงินสด"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--text)"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  ประเภท *
                </label>
                <select
                  name="type"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--text)"
                  }}
                >
                  <option value="CASH">เงินสด</option>
                  <option value="CARD">บัตร</option>
                  <option value="TRANSFER">โอนเงิน</option>
                  <option value="QR">QR</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  ธนาคาร
                </label>
                <input
                  type="text"
                  name="bankName"
                  placeholder="ธนาคารกสิกรไทย"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--text)"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  เลขที่บัญชี/เบอร์โทร
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  placeholder="123-4-56789-0"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--text)"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  ชื่อบัญชี
                </label>
                <input
                  type="text"
                  name="accountName"
                  placeholder="ร้านหมูปิ้ง"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--text)"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 500 }}>
                  ลำดับการแสดง
                </label>
                <input
                  type="number"
                  name="sortOrder"
                  defaultValue={0}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--text)"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={savingId === "new"}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    background: "var(--surface)",
                    color: "var(--text)",
                    border: "1px solid var(--line)",
                    cursor: savingId === "new" ? "not-allowed" : "pointer",
                    fontSize: 15
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={savingId === "new"}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 8,
                    background: "var(--brand-accent)",
                    color: "#fff",
                    border: "none",
                    cursor: savingId === "new" ? "not-allowed" : "pointer",
                    fontSize: 15,
                    fontWeight: 500
                  }}
                >
                  {savingId === "new" ? "กำลังสร้าง..." : "สร้าง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
