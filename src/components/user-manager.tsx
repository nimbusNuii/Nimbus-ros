"use client";

import { FormEvent, useEffect, useState } from "react";
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

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="card space-y-3">
        <h2 className="mt-0 text-xl font-semibold">ผู้ใช้งานระบบ</h2>
        {!isAdmin ? <p className="text-sm text-[var(--muted)]">บัญชี manager ดูรายการได้ แต่แก้ไขได้เฉพาะ admin</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <form
          className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="ค้นหา username / ชื่อ"
          />
          <select value={sortInput} onChange={(event) => setSortInput(event.target.value as UserSort)}>
            <option value="role_username">บทบาท + username (ค่าเริ่มต้น)</option>
            <option value="username_asc">username A-Z</option>
            <option value="username_desc">username Z-A</option>
            <option value="created_desc">สร้างล่าสุดก่อน</option>
            <option value="created_asc">สร้างเก่าสุดก่อน</option>
          </select>
          <button type="submit">ค้นหา</button>
          <button type="button" className="secondary" onClick={resetFilters}>
            ล้างตัวกรอง
          </button>
        </form>

        <div className="space-y-2 md:hidden">
          {users.map((user) => (
            <article key={user.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-semibold">{user.username}</p>
                  <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">{user.fullName}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    user.isActive ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {user.isActive ? "ใช้งาน" : "ปิด"}
                </span>
              </div>
              <p className="m-0 mt-2 text-xs text-[var(--muted)]">บทบาท: {roleLabel[user.role]}</p>

              {isAdmin ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={user.role}
                    onChange={(event) =>
                      updateUser(user.id, {
                        role: event.target.value as Role
                      })
                    }
                    disabled={editingId === user.id}
                    className="w-full"
                  >
                    <option value="CASHIER">Cashier</option>
                    <option value="KITCHEN">Kitchen</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>

                  <button
                    className="secondary"
                    type="button"
                    disabled={editingId === user.id}
                    onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                  >
                    {user.isActive ? "ปิด" : "เปิด"}
                  </button>

                  <button
                    className="secondary"
                    type="button"
                    disabled={editingId === user.id}
                    onClick={() => {
                      const pin = window.prompt(`ตั้ง PIN ใหม่ให้ ${user.username}`)?.trim();
                      if (!pin) return;
                      void updateUser(user.id, { pin });
                    }}
                  >
                    เปลี่ยน PIN
                  </button>
                </div>
              ) : (
                <p className="m-0 mt-2 text-xs text-[var(--muted)]">read-only</p>
              )}
            </article>
          ))}
          {users.length === 0 ? <p className="py-6 text-center text-[var(--muted)]">ยังไม่มีผู้ใช้งาน</p> : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="table min-w-[820px]">
            <thead>
              <tr>
                <th>username</th>
                <th>ชื่อ</th>
                <th>บทบาท</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.fullName}</td>
                  <td>{roleLabel[user.role]}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        user.isActive ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {user.isActive ? "ใช้งาน" : "ปิด"}
                    </span>
                  </td>
                  <td>
                    {isAdmin ? (
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={user.role}
                          onChange={(event) =>
                            updateUser(user.id, {
                              role: event.target.value as Role
                            })
                          }
                          disabled={editingId === user.id}
                          className="w-32"
                        >
                          <option value="CASHIER">Cashier</option>
                          <option value="KITCHEN">Kitchen</option>
                          <option value="MANAGER">Manager</option>
                          <option value="ADMIN">Admin</option>
                        </select>

                        <button
                          className="secondary"
                          type="button"
                          disabled={editingId === user.id}
                          onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                        >
                          {user.isActive ? "ปิด" : "เปิด"}
                        </button>

                        <button
                          className="secondary"
                          type="button"
                          disabled={editingId === user.id}
                          onClick={() => {
                            const pin = window.prompt(`ตั้ง PIN ใหม่ให้ ${user.username}`)?.trim();
                            if (!pin) return;
                            void updateUser(user.id, { pin });
                          }}
                        >
                          เปลี่ยน PIN
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">read-only</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-[var(--muted)]">
                    ยังไม่มีผู้ใช้งาน
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={currentPage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={goPage}
        />
      </section>

      <section className="card">
        <h2 className="mt-0 text-xl font-semibold">เพิ่มผู้ใช้ใหม่</h2>
        {!isAdmin ? <p className="text-sm text-[var(--muted)]">เฉพาะ admin ที่สร้างผู้ใช้ได้</p> : null}
        <form onSubmit={createUser} className="space-y-2">
          <div className="field">
            <label htmlFor="username">username *</label>
            <input id="username" name="username" required disabled={!isAdmin || saving} />
          </div>
          <div className="field">
            <label htmlFor="fullName">ชื่อแสดงผล *</label>
            <input id="fullName" name="fullName" required disabled={!isAdmin || saving} />
          </div>
          <div className="field">
            <label htmlFor="role">บทบาท *</label>
            <select id="role" name="role" defaultValue="CASHIER" disabled={!isAdmin || saving}>
              <option value="CASHIER">Cashier</option>
              <option value="KITCHEN">Kitchen</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="pin">PIN *</label>
            <input id="pin" name="pin" type="password" minLength={4} required disabled={!isAdmin || saving} />
          </div>

          <button disabled={!isAdmin || saving}>{saving ? "กำลังบันทึก..." : "สร้างผู้ใช้"}</button>
        </form>
      </section>
    </div>
  );
}
