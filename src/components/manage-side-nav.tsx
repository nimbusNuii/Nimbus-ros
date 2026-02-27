"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MenuGroup = {
  title: string;
  items: Array<{
    href: string;
    label: string;
  }>;
};

type ManageSideNavProps = {
  onNavigate?: () => void;
};

const menuGroups: MenuGroup[] = [
  {
    title: "ภาพรวม",
    items: [{ href: "/manage", label: "หน้าจัดการ" }]
  },
  {
    title: "สินค้า",
    items: [
      { href: "/manage/products", label: "สินค้า" },
      { href: "/manage/categories", label: "หมวดหมู่สินค้า" },
      { href: "/manage/menu-options", label: "ตัวเลือกเมนู" },
      { href: "/manage/inventory", label: "ประวัติสต็อก" }
    ]
  },
  {
    title: "ขายและลูกค้า",
    items: [
      { href: "/manage/customers", label: "ลูกค้า" },
      { href: "/manage/billing-batch", label: "ลงบิลย้อนหลัง" },
      { href: "/manage/receipt-template", label: "Template ใบเสร็จ" },
      { href: "/manage/print-jobs", label: "คิวพิมพ์" }
    ]
  },
  {
    title: "ระบบ",
    items: [
      { href: "/manage/expenses", label: "ค่าใช้จ่าย" },
      { href: "/manage/users", label: "ผู้ใช้งาน" },
      { href: "/manage/audit", label: "Audit Log" }
    ]
  }
];

export function ManageSideNav({ onNavigate }: ManageSideNavProps) {
  const pathname = usePathname();

  return (
    <aside className="card xl:sticky xl:top-6 xl:max-h-[calc(100dvh-96px)] xl:overflow-auto">
      <div className="space-y-3">
        {menuGroups.map((group) => (
          <section key={group.title}>
            <p className="mb-2 mt-0 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{group.title}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onNavigate?.()}
                    className={`block rounded-lg border px-3 py-2 text-sm transition-colors ${
                      active
                        ? "border-[color-mix(in_srgb,var(--brand)_45%,white)] bg-[color-mix(in_srgb,var(--brand)_12%,white)] text-[var(--text)]"
                        : "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--text)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
