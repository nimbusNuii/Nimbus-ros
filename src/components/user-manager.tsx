"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PaginationControls } from "@/components/pagination-controls";

type Role = "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN";

type User = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

type UserManagerProps = {
  initialUsers: User[];
  isAdmin: boolean;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  initialQuery: string;
  initialSort: UserSort;
};

type UserSort = "role_username" | "username_asc" | "username_desc" | "created_desc" | "created_asc";

const roleLabel: Record<Role, string> = {
  CASHIER: "แคชเชียร์",
  KITCHEN: "ครัว",
  MANAGER: "ผู้จัดการ",
  ADMIN: "แอดมิน"
};

export function UserManager({
  initialUsers,
  isAdmin,
  currentPage,
  pageSize,
  totalItems,
  initialQuery,
  initialSort
}: UserManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState(initialQuery);
  const [sortInput, setSortInput] = useState<UserSort>(initialSort);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  useEffect(() => {
    setQueryInput(initialQuery);
    setSortInput(initialSort);
  }, [initialQuery, initialSort]);

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
    const q = queryInput.trim();
    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }
    if (sortInput === "role_username") {
      params.delete("sort");
    } else {
      params.set("sort", sortInput);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function resetFilters() {
    setQueryInput("");
    setSortInput("role_username");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("sort");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;

    const form = new FormData(event.currentTarget);

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username") || "").trim(),
          fullName: String(form.get("fullName") || "").trim(),
          role: form.get("role"),
          pin: String(form.get("pin") || ""),
          isActive: true
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Cannot create user");
      }

      setUsers((prev) => [data, ...prev].slice(0, pageSize));
      goPage(1);
      router.refresh();
      event.currentTarget.reset();
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot create user");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(userId: string, payload: { role?: Role; isActive?: boolean; pin?: string }) {
    if (!isAdmin) return;

    setEditingId(userId);
    setError("");

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Cannot update user");
      }

      setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, ...data } : user)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot update user");
    } finally {
      setEditingId(null);
    }
  }

  const ROLE_CHIP: Record<Role, { bg: string; border: string; color: string; label: string }> = {
    CASHIER: { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8", label: "แคชเชียร์" },
    KITCHEN: { bg: "#fff7ed", border: "#fdba74", color: "#c2410c", label: "ครัว" },
    MANAGER: { bg: "#f5f3ff", border: "#c4b5fd", color: "#7c3aed", label: "ผู้จัดการ" },
    ADMIN:   { bg: "#fef2f2", border: "#fca5a5", color: "#b91c1c", label: "แอดมิน" },
  };

  const FIELD: React.CSSProperties = {
    height: 36, borderRadius: 8, border: "1px solid var(--line)",
    fontSize: "0.875rem", padding: "0 10px", background: "#fff", color: "var(--text)", width: "100%",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text)" }}>ผู้ใช้งาน</h1>
          <span style={{ height: 26, padding: "0 10px", borderRadius: 99, background: "var(--bg)", border: "1px solid var(--line)", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", display: "inline-flex", alignItems: "center" }}>
            {totalItems} คน
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isAdmin && (
            <span style={{ fontSize: "0.8rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              บัญชี manager: ดูได้อย่างเดียว
            </span>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{ height: 36, padding: "0 14px", borderRadius: 9, border: "none", background: "var(--brand)", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "none", flexShrink: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></svg>
              เพิ่มผู้ใช้ใหม่
            </button>
          )}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); applyFilters(); }}
        style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>ค้นหา</span>
            <input value={queryInput} onChange={(e) => setQueryInput(e.target.value)} placeholder="username / ชื่อ..." style={FIELD} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>เรียงลำดับ</span>
            <select value={sortInput} onChange={(e) => setSortInput(e.target.value as UserSort)} style={FIELD}>
              <option value="role_username">บทบาท + username</option>
              <option value="username_asc">username A-Z</option>
              <option value="username_desc">username Z-A</option>
              <option value="created_desc">สร้างล่าสุดก่อน</option>
              <option value="created_asc">สร้างเก่าสุดก่อน</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, paddingTop: 2, borderTop: "1px solid var(--line)" }}>
          <button type="submit" style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--brand)", color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#fff" strokeWidth="2.2" /><path d="M21 21l-4.35-4.35" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /></svg>
            ค้นหา
          </button>
          <button type="button" onClick={resetFilters} style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--muted)", fontSize: "0.82rem", fontWeight: 500, cursor: "pointer", boxShadow: "none" }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Mobile cards */}
          <div className="flex flex-col lg:hidden" style={{ gap: 8 }}>
            {users.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--muted)", padding: "40px 0", fontSize: "0.875rem" }}>ยังไม่มีผู้ใช้งาน</p>
            ) : users.map((user) => {
              const chip = ROLE_CHIP[user.role];
              return (
                <article key={user.id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
                  {/* Top zone */}
                  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: chip.bg, border: `1px solid ${chip.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={chip.color} strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke={chip.color} strokeWidth="2" /></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.username}</p>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>{user.fullName}</p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 99, border: `1px solid ${chip.border}`, background: chip.bg, color: chip.color, fontSize: "0.7rem", fontWeight: 700 }}>{chip.label}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: "0.68rem", fontWeight: 600, background: user.isActive ? "#f0fdf4" : "#f5f5f4", color: user.isActive ? "#16a34a" : "#78716c", border: `1px solid ${user.isActive ? "#86efac" : "#d6d3d1"}` }}>
                        {user.isActive ? "ใช้งาน" : "ปิด"}
                      </span>
                    </div>
                  </div>
                  {/* Bottom zone: actions */}
                  {isAdmin && (
                    <div style={{ padding: "10px 14px 12px", borderTop: "1px solid var(--line)", background: "var(--bg)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <select
                        value={user.role}
                        onChange={(e) => void updateUser(user.id, { role: e.target.value as Role })}
                        disabled={editingId === user.id}
                        style={{ height: 32, borderRadius: 7, border: "1px solid var(--line)", fontSize: "0.78rem", padding: "0 8px", background: "#fff", color: "var(--text)", cursor: "pointer" }}
                      >
                        <option value="CASHIER">แคชเชียร์</option>
                        <option value="KITCHEN">ครัว</option>
                        <option value="MANAGER">ผู้จัดการ</option>
                        <option value="ADMIN">แอดมิน</option>
                      </select>
                      <button type="button" disabled={editingId === user.id} onClick={() => void updateUser(user.id, { isActive: !user.isActive })}
                        style={{ height: 32, padding: "0 12px", borderRadius: 7, border: "1px solid var(--line)", background: "#fff", color: user.isActive ? "#dc2626" : "#16a34a", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", boxShadow: "none" }}>
                        {user.isActive ? "ปิดบัญชี" : "เปิดบัญชี"}
                      </button>
                      <button type="button" disabled={editingId === user.id}
                        onClick={() => { const pin = window.prompt(`ตั้ง PIN ใหม่ให้ ${user.username}`)?.trim(); if (pin) void updateUser(user.id, { pin }); }}
                        style={{ height: 32, padding: "0 12px", borderRadius: 7, border: "1px solid var(--line)", background: "#fff", color: "var(--muted)", fontSize: "0.78rem", fontWeight: 500, cursor: "pointer", boxShadow: "none" }}>
                        เปลี่ยน PIN
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block" style={{ border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
                    {["ผู้ใช้งาน", "บทบาท", "สถานะ", ...(isAdmin ? ["จัดการ"] : [])].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 4 : 3} style={{ padding: "40px 14px", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>ยังไม่มีผู้ใช้งาน</td></tr>
                  ) : users.map((user, idx) => {
                    const chip = ROLE_CHIP[user.role];
                    return (
                      <tr key={user.id} style={{ borderTop: idx > 0 ? "1px solid var(--line)" : undefined }}>
                        {/* User info */}
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 9, background: chip.bg, border: `1px solid ${chip.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={chip.color} strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="7" r="4" stroke={chip.color} strokeWidth="2" /></svg>
                            </div>
                            <div>
                              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}>{user.username}</p>
                              <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>{user.fullName}</p>
                            </div>
                          </div>
                        </td>
                        {/* Role */}
                        <td style={{ padding: "10px 14px" }}>
                          {isAdmin ? (
                            <select
                              value={user.role}
                              onChange={(e) => void updateUser(user.id, { role: e.target.value as Role })}
                              disabled={editingId === user.id}
                              style={{ height: 32, borderRadius: 7, border: "1px solid var(--line)", fontSize: "0.8rem", padding: "0 8px", background: "#fff", color: "var(--text)", cursor: "pointer" }}
                            >
                              <option value="CASHIER">แคชเชียร์</option>
                              <option value="KITCHEN">ครัว</option>
                              <option value="MANAGER">ผู้จัดการ</option>
                              <option value="ADMIN">แอดมิน</option>
                            </select>
                          ) : (
                            <span style={{ padding: "3px 10px", borderRadius: 99, border: `1px solid ${chip.border}`, background: chip.bg, color: chip.color, fontSize: "0.75rem", fontWeight: 700 }}>{chip.label}</span>
                          )}
                        </td>
                        {/* Status */}
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: "0.75rem", fontWeight: 700, background: user.isActive ? "#f0fdf4" : "#f5f5f4", color: user.isActive ? "#16a34a" : "#78716c", border: `1px solid ${user.isActive ? "#86efac" : "#d6d3d1"}` }}>
                            {user.isActive ? "ใช้งาน" : "ปิด"}
                          </span>
                        </td>
                        {/* Actions */}
                        {isAdmin && (
                          <td style={{ padding: "10px 14px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" disabled={editingId === user.id}
                                onClick={() => void updateUser(user.id, { isActive: !user.isActive })}
                                style={{ height: 30, padding: "0 10px", borderRadius: 7, border: "1px solid var(--line)", background: "#fff", color: user.isActive ? "#dc2626" : "#16a34a", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "none" }}>
                                {user.isActive ? "ปิดบัญชี" : "เปิดบัญชี"}
                              </button>
                              <button type="button" disabled={editingId === user.id}
                                onClick={() => { const pin = window.prompt(`ตั้ง PIN ใหม่ให้ ${user.username}`)?.trim(); if (pin) void updateUser(user.id, { pin }); }}
                                style={{ height: 30, padding: "0 10px", borderRadius: 7, border: "1px solid var(--line)", background: "#fff", color: "var(--muted)", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "none" }}>
                                เปลี่ยน PIN
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationControls page={currentPage} pageSize={pageSize} totalItems={totalItems} onPageChange={goPage} />
      </div>

      {/* ── Create modal ── */}
      {showCreateModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}
          className="items-end p-0 md:items-center md:p-4"
        >
          <div
            style={{ background: "#fff", width: "100%", padding: "24px 20px", maxHeight: "90vh", overflowY: "auto", animation: "_modalSlide 240ms cubic-bezier(0.32,0.72,0,1)" }}
            className="rounded-t-[18px] md:rounded-2xl md:max-w-md"
          >
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text)" }}>เพิ่มผู้ใช้ใหม่</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: "none", flexShrink: 0 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#1a1614" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>

            <form onSubmit={createUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="c-username" style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>username <span style={{ color: "var(--brand)" }}>*</span></label>
                <input id="c-username" name="username" required disabled={saving} autoFocus style={{ ...FIELD, opacity: saving ? 0.5 : 1 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label htmlFor="c-fullName" style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>ชื่อแสดงผล <span style={{ color: "var(--brand)" }}>*</span></label>
                <input id="c-fullName" name="fullName" required disabled={saving} style={{ ...FIELD, opacity: saving ? 0.5 : 1 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="c-role" style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>บทบาท <span style={{ color: "var(--brand)" }}>*</span></label>
                  <select id="c-role" name="role" defaultValue="CASHIER" disabled={saving} style={{ ...FIELD, opacity: saving ? 0.5 : 1 }}>
                    <option value="CASHIER">แคชเชียร์</option>
                    <option value="KITCHEN">ครัว</option>
                    <option value="MANAGER">ผู้จัดการ</option>
                    <option value="ADMIN">แอดมิน</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label htmlFor="c-pin" style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>PIN <span style={{ color: "var(--brand)" }}>*</span></label>
                  <input id="c-pin" name="pin" type="password" minLength={4} required disabled={saving} placeholder="••••" style={{ ...FIELD, opacity: saving ? 0.5 : 1 }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={saving}
                  style={{ flex: 1, height: 42, borderRadius: 10, border: "1px solid var(--line)", background: "#fff", color: "var(--muted)", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", boxShadow: "none" }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ flex: 2, height: 42, borderRadius: 10, border: "none", background: saving ? "var(--line)" : "var(--brand)", color: saving ? "var(--muted)" : "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "none" }}
                >
                  {saving ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                        <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></svg>
                      สร้างผู้ใช้
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes _modalSlide { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media (min-width: 768px) {
          @keyframes _modalSlide { from { transform: translateY(8px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        }
      `}</style>
    </div>
  );
}
