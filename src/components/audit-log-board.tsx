"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { PaginationControls } from "@/components/pagination-controls";

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

type AuditLogPayload = {
  rows: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
};

type AuditSort = "created_desc" | "created_asc";

const PAGE_SIZE = 50;

function safeString(value: unknown) {
  try {
    if (value === null || value === undefined) return "-";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  } catch {
    return "-";
  }
}

function parsePage(value: string | null) {
  const num = Number(value || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.trunc(num));
}

export function AuditLogBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = parsePage(searchParams.get("page"));
  const actionParam = searchParams.get("action") || "";
  const entityParam = searchParams.get("entity") || "";
  const qParam = searchParams.get("q") || "";
  const fromParam = searchParams.get("from") || "";
  const toParam = searchParams.get("to") || "";
  const sortParam: AuditSort = searchParams.get("sort") === "created_asc" ? "created_asc" : "created_desc";

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [actionInput, setActionInput] = useState(actionParam);
  const [entityInput, setEntityInput] = useState(entityParam);
  const [qInput, setQInput] = useState(qParam);
  const [fromInput, setFromInput] = useState(fromParam);
  const [toInput, setToInput] = useState(toParam);
  const [sortInput, setSortInput] = useState<AuditSort>(sortParam);

  useEffect(() => {
    setActionInput(actionParam);
    setEntityInput(entityParam);
    setQInput(qParam);
    setFromInput(fromParam);
    setToInput(toParam);
    setSortInput(sortParam);
  }, [actionParam, entityParam, fromParam, qParam, sortParam, toParam]);

  const exportQuery = useMemo(() => {
    const query = new URLSearchParams();
    if (actionParam) query.set("action", actionParam);
    if (entityParam) query.set("entity", entityParam);
    if (qParam) query.set("q", qParam);
    if (fromParam) query.set("from", fromParam);
    if (toParam) query.set("to", toParam);
    if (sortParam !== "created_desc") query.set("sort", sortParam);
    query.set("limit", "3000");
    return query.toString();
  }, [actionParam, entityParam, fromParam, qParam, sortParam, toParam]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      query.set("withMeta", "1");
      query.set("limit", String(PAGE_SIZE));
      query.set("page", String(currentPage));
      if (actionParam.trim()) query.set("action", actionParam.trim());
      if (entityParam.trim()) query.set("entity", entityParam.trim());
      if (qParam.trim()) query.set("q", qParam.trim());
      if (fromParam) query.set("from", fromParam);
      if (toParam) query.set("to", toParam);
      if (sortParam !== "created_desc") query.set("sort", sortParam);

      const response = await fetch(`/api/audit-logs?${query.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as AuditLogPayload | AuditLog[] | { error?: string };

      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Cannot load audit logs");
      }

      if (Array.isArray(data)) {
        setLogs(data);
        setTotalItems(data.length);
      } else if ("rows" in data && Array.isArray(data.rows)) {
        setLogs(data.rows);
        setTotalItems(typeof data.total === "number" ? data.total : data.rows.length);
      } else {
        setLogs([]);
        setTotalItems(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load audit logs");
    } finally {
      setLoading(false);
    }
  }, [actionParam, currentPage, entityParam, fromParam, qParam, sortParam, toParam]);

  useEffect(() => {
    void load();
  }, [load]);

  function goPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    const safePage = Math.max(1, Math.trunc(nextPage));
    if (safePage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(safePage));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString());
    if (actionInput.trim()) params.set("action", actionInput.trim());
    else params.delete("action");
    if (entityInput.trim()) params.set("entity", entityInput.trim());
    else params.delete("entity");
    if (qInput.trim()) params.set("q", qInput.trim());
    else params.delete("q");
    if (fromInput) params.set("from", fromInput);
    else params.delete("from");
    if (toInput) params.set("to", toInput);
    else params.delete("to");
    if (sortInput === "created_desc") params.delete("sort");
    else params.set("sort", sortInput);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function resetFilters() {
    setActionInput("");
    setEntityInput("");
    setQInput("");
    setFromInput("");
    setToInput("");
    setSortInput("created_desc");
    router.push(pathname);
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters();
  }

  const FIELD: React.CSSProperties = {
    height: 36, borderRadius: 8, border: "1px solid var(--line)",
    fontSize: "0.875rem", padding: "0 10px", background: "#fff", color: "var(--text)", width: "100%",
  };

  function actionChip(action: string) {
    const u = action.toUpperCase();
    if (u.includes("CREAT") || u.includes("ADD")) return { bg: "#f0fdf4", border: "#86efac", color: "#16a34a" };
    if (u.includes("UPDAT") || u.includes("CHANG") || u.includes("EDIT")) return { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8" };
    if (u.includes("DELET") || u.includes("REMOV") || u.includes("CANCEL")) return { bg: "#fef2f2", border: "#fca5a5", color: "#b91c1c" };
    if (u.includes("LOGIN") || u.includes("AUTH") || u.includes("LOGOUT")) return { bg: "#f5f3ff", border: "#c4b5fd", color: "#7c3aed" };
    return { bg: "#f5f5f4", border: "#d6d3d1", color: "#57534e" };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text)" }}>Audit Log</h1>
          <span style={{ height: 26, padding: "0 10px", borderRadius: 99, background: "var(--bg)", border: "1px solid var(--line)", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", display: "inline-flex", alignItems: "center" }}>
            {totalItems.toLocaleString()} รายการ
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--muted)", fontSize: "0.8rem", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "none", opacity: loading ? 0.5 : 1 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="#1a1614" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="#1a1614" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            รีเฟรช
          </button>
          <a
            href={`/api/audit-logs/export?${exportQuery}`}
            target="_blank"
            rel="noreferrer"
            style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--muted)", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="#1a1614" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Export CSV
          </a>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <form
        onSubmit={onSearch}
        style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>ค้นหาทั่วไป</span>
            <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="action / entity / actor / id..." style={FIELD} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Action</span>
            <input value={actionInput} onChange={(e) => setActionInput(e.target.value)} placeholder="เช่น ORDER_CREATED" style={FIELD} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Entity</span>
            <input value={entityInput} onChange={(e) => setEntityInput(e.target.value)} placeholder="เช่น Order / Product" style={FIELD} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 280px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>ช่วงวันที่</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} style={{ ...FIELD, flex: 1 }} />
              <span style={{ fontSize: "0.78rem", color: "var(--muted)", flexShrink: 0 }}>—</span>
              <input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} style={{ ...FIELD, flex: 1 }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>เรียงลำดับ</span>
            <select value={sortInput} onChange={(e) => setSortInput(e.target.value as AuditSort)} style={FIELD}>
              <option value="created_desc">ล่าสุดก่อน</option>
              <option value="created_asc">เก่าสุดก่อน</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, paddingTop: 2, borderTop: "1px solid var(--line)" }}>
          <button type="submit" disabled={loading} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: loading ? "var(--line)" : "var(--brand)", color: loading ? "var(--muted)" : "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#fff" strokeWidth="2.2" /><path d="M21 21l-4.35-4.35" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></svg>
            ค้นหา
          </button>
          <button type="button" onClick={resetFilters} disabled={loading} style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--muted)", fontSize: "0.82rem", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", boxShadow: "none" }}>
            ล้าง
          </button>
        </div>
      </form>

      {error && (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          {error}
        </p>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "32px 0", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
            <circle cx="12" cy="12" r="10" stroke="var(--line)" strokeWidth="3" />
            <path d="M12 2a10 10 0 0110 10" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: "0.875rem", color: "var(--muted)" }}>กำลังโหลด...</span>
        </div>
      )}

      {/* ── Mobile cards ── */}
      {!loading && (
        <div className="flex flex-col lg:hidden" style={{ gap: 8 }}>
          {logs.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0", fontSize: "0.875rem" }}>ไม่พบรายการ</p>
          ) : logs.map((log) => {
            const chip = actionChip(log.action);
            return (
              <article key={log.id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 99, border: `1px solid ${chip.border}`, background: chip.bg, color: chip.color, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.02em" }}>{log.action}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--muted)" }}>
                      {log.entity}{log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>{formatDateTime(log.createdAt)}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--text)", fontWeight: 600 }}>{log.actor?.fullName || log.actorUsername || "—"}</p>
                  </div>
                </div>
                {!!log.metadata && safeString(log.metadata) !== "-" && (
                  <div style={{ padding: "8px 14px 12px", borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--muted)", wordBreak: "break-all" }}>{safeString(log.metadata).slice(0, 200)}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ── Desktop table ── */}
      {!loading && (
        <div className="hidden lg:block" style={{ border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
                  {["เวลา", "Action", "Entity", "Actor", "Metadata"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: "40px 14px", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>ไม่พบรายการ</td></tr>
                ) : logs.map((log, idx) => {
                  const chip = actionChip(log.action);
                  return (
                    <tr key={log.id} style={{ borderTop: idx > 0 ? "1px solid var(--line)" : undefined }}>
                      <td style={{ padding: "10px 14px", fontSize: "0.78rem", color: "var(--muted)", whiteSpace: "nowrap" }}>{formatDateTime(log.createdAt)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 99, border: `1px solid ${chip.border}`, background: chip.bg, color: chip.color, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>{log.action}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: "0.82rem", color: "var(--text)" }}>
                        <span style={{ fontWeight: 600 }}>{log.entity}</span>
                        {log.entityId && <span style={{ color: "var(--muted)", fontSize: "0.72rem", marginLeft: 4 }}>{log.entityId.slice(0, 8)}</span>}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: "0.82rem", color: "var(--text)", whiteSpace: "nowrap" }}>
                        {log.actor?.fullName || log.actorUsername || "—"}
                        {log.actor?.role && <span style={{ marginLeft: 6, fontSize: "0.68rem", color: "var(--muted)" }}>({log.actor.role})</span>}
                      </td>
                      <td style={{ padding: "10px 14px", maxWidth: 360, fontSize: "0.72rem", color: "var(--muted)", wordBreak: "break-all" }}>{safeString(log.metadata)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PaginationControls page={currentPage} pageSize={PAGE_SIZE} totalItems={totalItems} onPageChange={goPage} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
