"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuGroup = {
  title: string;
  items: Array<{ href: string; label: string; icon: string }>;
};

type ManageSideNavProps = {
  onNavigate?: () => void;
};

const menuGroups: MenuGroup[] = [
  {
    title: "ภาพรวม",
    items: [
      { href: "/manage", label: "หน้าหลัก", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    ],
  },
  {
    title: "สินค้า",
    items: [
      { href: "/manage/products",     label: "สินค้า",        icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
      { href: "/manage/categories",   label: "หมวดหมู่",      icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
      { href: "/manage/inventory",    label: "ประวัติสต็อก",  icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
    ],
  },
  {
    title: "ขายและลูกค้า",
    items: [
      { href: "/manage/customers",        label: "ลูกค้า",           icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" },
      { href: "/manage/billing-batch",    label: "ลงบิลย้อนหลัง",  icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
      { href: "/manage/expenses",         label: "ค่าใช้จ่าย",       icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
      { href: "/manage/receipt-template", label: "Template ใบเสร็จ", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
      { href: "/manage/print-jobs",       label: "คิวพิมพ์",         icon: "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { href: "/manage/users",             label: "ผู้ใช้งาน",        icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
      { href: "/manage/payment-channels",  label: "ช่องทางชำระเงิน", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
      { href: "/manage/audit",             label: "Audit Log",       icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
    ],
  },
];

export function ManageSideNav({ onNavigate }: ManageSideNavProps) {
  const pathname = usePathname();

  return (
    <aside
      className="lg:sticky lg:overflow-y-auto"
      style={{ top: 64, maxHeight: "calc(100dvh - 80px)", padding: "6px 0" }}
    >
      <nav style={{ display: "flex", flexDirection: "column" }}>
        {menuGroups.map((group, gi) => (
          <section key={group.title}>
            {/* separator between groups */}
            {gi > 0 && (
              <div style={{ height: 1, background: "var(--line)", margin: "10px 12px 8px" }} />
            )}
            <p
              style={{
                margin: "0 0 4px 12px",
                fontSize: "0.6rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.09em",
                color: "var(--muted)",
                opacity: 0.55,
              }}
            >
              {group.title}
            </p>
            <div>
              {group.items.map((item) => {
                const active =
                  item.href === "/manage"
                    ? pathname === "/manage"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavigate?.()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "7px 12px 7px 10px",
                      borderRadius: 8,
                      fontSize: "0.825rem",
                      fontWeight: active ? 600 : 400,
                      color: active ? "var(--brand)" : "var(--muted)",
                      background: active
                        ? "color-mix(in srgb, var(--brand) 9%, transparent)"
                        : "transparent",
                      textDecoration: "none",
                      transition: "background 120ms ease, color 120ms ease",
                      borderLeft: active ? "2.5px solid var(--brand)" : "2.5px solid transparent",
                      marginBottom: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background =
                          "color-mix(in srgb, var(--text) 5%, transparent)";
                        (e.currentTarget as HTMLElement).style.color = "var(--text)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.color = "var(--muted)";
                      }
                    }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      style={{ flexShrink: 0, opacity: active ? 1 : 0.55 }}
                    >
                      <path
                        d={item.icon}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
