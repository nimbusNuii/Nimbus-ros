"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const labelBySegment: Record<string, string> = {
  manage: "จัดการ",
  products: "สินค้า",
  customers: "ลูกค้า",
  expenses: "ค่าใช้จ่าย",
  users: "ผู้ใช้งาน",
  inventory: "ประวัติสต็อก",
  audit: "Audit Log",
  "print-jobs": "คิวพิมพ์",
  "receipt-template": "Template ใบเสร็จ"
};

export function ManageBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const index = segments.indexOf("manage");
  if (index < 0) return null;

  const crumbs = segments.slice(index).map((segment, crumbIndex, array) => {
    const href = `/${array.slice(0, crumbIndex + 1).join("/")}`;
    const label = labelBySegment[segment] || segment;
    const isLast = crumbIndex === array.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-2">
            {crumb.isLast ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,white)] px-3 py-1 text-[var(--text)]">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="rounded-full border border-[var(--line)] px-3 py-1 hover:bg-[var(--surface-strong)]">
                {crumb.label}
              </Link>
            )}
            {!crumb.isLast ? <span>/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
