import Link from "next/link";
import { requirePageRole } from "@/lib/auth";

const modules = [
  {
    title: "หน้าร้าน (POS)",
    desc: "เปิดบิล คิดเงิน และออกใบเสร็จ",
    href: "/pos"
  },
  {
    title: "หน้าคนในครัว",
    desc: "ดูคิวออเดอร์แบบเรียลไทม์และอัปเดตสถานะ",
    href: "/kitchen"
  },
  {
    title: "หน้าสรุป",
    desc: "สรุปยอดขาย ต้นทุน และกำไรสุทธิ",
    href: "/summary"
  },
  {
    title: "หน้าจัดการ",
    desc: "สินค้า ค่าใช้จ่าย และ template ใบเสร็จ",
    href: "/manage"
  }
];

export default async function HomePage() {
  await requirePageRole(["CASHIER", "KITCHEN", "MANAGER", "ADMIN"]);

  return (
    <div>
      <h1 className="page-title">ระบบ POS สำหรับร้านอาหาร/คาเฟ่</h1>
      <p className="page-subtitle">
        รองรับหน้าร้าน หน้าครัว หน้าสรุป หน้าจัดการ และแก้ไข template ใบเสร็จได้
      </p>

      <section className="grid grid-2">
        {modules.map((module) => (
          <Link key={module.href} href={module.href} className="card">
            <h2 style={{ marginTop: 0 }}>{module.title}</h2>
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>{module.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
