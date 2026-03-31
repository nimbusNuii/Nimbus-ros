import Link from "next/link";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ModuleCard = {
  title: string;
  desc: string;
  href: string;
  icon: React.ReactNode;
  accent: string;
};

const modules: ModuleCard[] = [
  {
    title: "รับออเดอร์",
    desc: "หน้าจอ POS เต็มรูปแบบสำหรับรับและบันทึกออเดอร์",
    href: "/create-order",
    accent: "#e24a3b",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
        <path d="M7 8h10M7 12h6" />
      </svg>
    )
  },
  {
    title: "ใบเสร็จย้อนหลัง",
    desc: "ค้นหาและพิมพ์ซ้ำใบเสร็จจากประวัติการชำระ",
    href: "/receipts",
    accent: "#7c3aed",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    )
  },
  {
    title: "หน้าจอครัว",
    desc: "ดูคิวออเดอร์แบบเรียลไทม์ อัปเดตสถานะการเตรียมอาหาร",
    href: "/kitchen",
    accent: "#d97706",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l19-9-9 19-2-8-8-2z" />
      </svg>
    )
  },
  {
    title: "สรุปยอดขาย",
    desc: "รายงานยอดขาย ต้นทุน กำไร และแนวโน้ม",
    href: "/summary",
    accent: "#059669",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )
  },
  {
    title: "จัดการระบบ",
    desc: "สินค้า หมวดหมู่ ลูกค้า ค่าใช้จ่าย และการตั้งค่า",
    href: "/manage",
    accent: "#2563eb",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93l-1.41 1.41M5.34 5.34L3.93 3.93M4.93 19.07l1.41-1.41M18.66 18.66l1.41 1.41M12 3v2M12 19v2M3 12H1M23 12h-2" />
      </svg>
    )
  }
];

export default async function HomePage() {
  await requirePageRole(["CASHIER", "KITCHEN", "MANAGER", "ADMIN"]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          Dashboard
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          เลือกโมดูลที่ต้องการใช้งาน
        </p>
      </div>

      {/* Module Cards */}
      <div className="grid grid-2" style={{ gap: "16px" }}>
        {modules.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="card group relative overflow-hidden"
            style={{ display: "block", textDecoration: "none" }}
          >
            {/* Accent strip */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
              style={{ background: mod.accent }}
            />

            <div className="flex items-start gap-4 pl-2">
              {/* Icon */}
              <div
                className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${mod.accent} 10%, var(--bg))`,
                  color: mod.accent
                }}
              >
                {mod.icon}
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <h2
                  className="mt-0 mb-1 text-base font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  {mod.title}
                </h2>
                <p
                  className="mb-0 text-sm leading-relaxed"
                  style={{ color: "var(--muted)" }}
                >
                  {mod.desc}
                </p>
              </div>

              {/* Arrow */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-1 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
                style={{ color: "var(--muted-light, var(--muted))", opacity: 0.5 }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

