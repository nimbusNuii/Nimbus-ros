"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ภาพรวม" },
  { href: "/pos", label: "หน้าร้าน" },
  { href: "/kitchen", label: "หน้าครัว" },
  { href: "/summary", label: "หน้าสรุป" },
  { href: "/manage", label: "หน้าจัดการ" },
  { href: "/auth/login", label: "ล็อกอิน" }
];

export function MainNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<null | { fullName: string; role: string }>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled) {
          setUser(data.user ?? null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/auth/login";
  }

  return (
    <nav className="nav">
      <div className="nav-inner" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link key={link.href} href={link.href} className={`nav-link ${active ? "active" : ""}`}>
              {link.label}
            </Link>
          );
        })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user ? (
            <>
              <span className="pill">
                {user.fullName} ({user.role})
              </span>
              <button className="secondary" type="button" onClick={logout}>
                ออกจากระบบ
              </button>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
