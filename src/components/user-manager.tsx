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
};

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
  totalItems
}: UserManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

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

        <div className="overflow-x-auto">
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
