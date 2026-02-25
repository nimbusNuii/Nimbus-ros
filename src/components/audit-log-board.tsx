"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorUserId: string | null;
  actorUsername: string | null;
  actorRole: "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN" | null;
  metadata: unknown;
  createdAt: string;
  actor: {
    id: string;
    username: string;
    fullName: string;
    role: "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN";
  } | null;
};

function safeString(value: unknown) {
  try {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  } catch {
    return "-";
  }
}

export function AuditLogBoard() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = new URLSearchParams();
  query.set("limit", "200");
  if (action.trim()) query.set("action", action.trim());
  if (entity.trim()) query.set("entity", entity.trim());
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const queryString = query.toString();

  async function load() {
    const response = await fetch(`/api/audit-logs?${queryString}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Cannot load audit logs");
    }

    setLogs(data);
  }

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Cannot load audit logs");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load audit logs");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <section className="card">
        <form onSubmit={onSearch}>
          <div className="grid grid-3" style={{ alignItems: "end" }}>
            <div className="field">
              <label htmlFor="action">Action</label>
              <input id="action" value={action} onChange={(event) => setAction(event.target.value)} placeholder="เช่น ORDER_CREATED" />
            </div>
            <div className="field">
              <label htmlFor="entity">Entity</label>
              <input id="entity" value={entity} onChange={(event) => setEntity(event.target.value)} placeholder="เช่น Order / Product" />
            </div>
            <div className="field">
              <label htmlFor="from">ตั้งแต่</label>
              <input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="to">ถึง</label>
              <input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            <button type="submit" disabled={loading}>
              ค้นหา
            </button>
            <a className="nav-link" href={`/api/audit-logs/export?${queryString}`} target="_blank" rel="noreferrer">
              export csv
            </a>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Audit Logs</h2>
        {loading ? <p style={{ color: "var(--muted)" }}>กำลังโหลด...</p> : null}
        {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

        {!loading ? (
          <table className="table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{log.action}</td>
                  <td>
                    {log.entity}
                    {log.entityId ? ` (${log.entityId.slice(0, 8)})` : ""}
                  </td>
                  <td>{log.actor?.fullName || log.actorUsername || "-"}</td>
                  <td style={{ maxWidth: 420, whiteSpace: "pre-wrap", fontSize: 12 }}>{safeString(log.metadata)}</td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                    ไม่พบรายการ
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
