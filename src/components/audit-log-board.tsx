"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

  return (
    <div className="grid gap-4">
      <section className="card">
        <form onSubmit={onSearch}>
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="field">
              <label htmlFor="action">Action</label>
              <input id="action" value={actionInput} onChange={(event) => setActionInput(event.target.value)} placeholder="เช่น ORDER_CREATED" />
            </div>
            <div className="field">
              <label htmlFor="entity">Entity</label>
              <input id="entity" value={entityInput} onChange={(event) => setEntityInput(event.target.value)} placeholder="เช่น Order / Product" />
            </div>
            <div className="field">
              <label htmlFor="audit-q">ค้นหา</label>
              <input id="audit-q" value={qInput} onChange={(event) => setQInput(event.target.value)} placeholder="action / entity / actor / id" />
            </div>
            <div className="field">
              <label htmlFor="from">ตั้งแต่</label>
              <input id="from" type="date" value={fromInput} onChange={(event) => setFromInput(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="to">ถึง</label>
              <input id="to" type="date" value={toInput} onChange={(event) => setToInput(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="audit-sort">เรียงลำดับ</label>
              <select id="audit-sort" value={sortInput} onChange={(event) => setSortInput(event.target.value as AuditSort)}>
                <option value="created_desc">ล่าสุดก่อน</option>
                <option value="created_asc">เก่าสุดก่อน</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
              <button type="submit" disabled={loading}>
                ค้นหา
              </button>
              <button type="button" className="secondary" onClick={resetFilters} disabled={loading}>
                ล้างตัวกรอง
              </button>
              <button type="button" className="secondary" onClick={() => void load()} disabled={loading}>
                รีเฟรช
              </button>
              <a className="secondary" href={`/api/audit-logs/export?${exportQuery}`} target="_blank" rel="noreferrer">
                export csv
              </a>
            </div>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">Audit Logs</h2>
        {loading ? <p className="text-sm text-[var(--muted)]">กำลังโหลด...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!loading ? (
          <div className="space-y-2 md:hidden">
            {logs.map((log) => (
              <article key={log.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="m-0 text-sm font-semibold text-[var(--text)]">{log.action}</p>
                    <p className="m-0 text-xs text-[var(--muted)]">{formatDateTime(log.createdAt)}</p>
                  </div>
                  <span className="text-xs text-[var(--muted)]">{log.actor?.fullName || log.actorUsername || "-"}</span>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-[var(--muted)]">
                  <p className="m-0">
                    Entity: {log.entity}
                    {log.entityId ? ` (${log.entityId.slice(0, 8)})` : ""}
                  </p>
                  <p className="m-0 break-words">Metadata: {safeString(log.metadata)}</p>
                </div>
              </article>
            ))}
            {logs.length === 0 ? <p className="text-center text-sm text-[var(--muted)]">ไม่พบรายการ</p> : null}
          </div>
        ) : null}

        {!loading ? (
          <div className="hidden overflow-x-auto md:block">
            <table className="table min-w-[920px]">
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
                    <td className="max-w-[420px] whitespace-pre-wrap text-xs">{safeString(log.metadata)}</td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-[var(--muted)]">
                      ไม่พบรายการ
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
        <PaginationControls
          page={currentPage}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
          onPageChange={goPage}
        />
      </section>
    </div>
  );
}
