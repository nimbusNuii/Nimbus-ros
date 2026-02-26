import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { StoreSettingsForm } from "@/components/store-settings-form";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const LOW_STOCK_THRESHOLD = 10;

  await requirePageRole(["MANAGER", "ADMIN"]);

  const [settings, lowStockProducts] = await Promise.all([
    prisma.storeSetting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        businessName: "POS Shop",
        vatEnabled: true,
        taxRate: 7,
        currency: "THB"
      }
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        stockQty: {
          lte: LOW_STOCK_THRESHOLD
        }
      },
      orderBy: [{ stockQty: "asc" }, { name: "asc" }],
      take: 12
    })
  ]);

  return (
    <div>
      <h1 className="page-title">หน้าจัดการ</h1>
      <p className="page-subtitle">จัดการข้อมูลร้าน สินค้า ค่าใช้จ่าย และ template ใบเสร็จ</p>

      <section className="grid grid-3 mb-4">
        <Link href="/manage/products" className="card">
          <h3 className="mt-0">สินค้า</h3>
          <p className="mb-0 text-[var(--muted)]">เพิ่มเมนู ตั้งราคาขาย และต้นทุนต่อหน่วย</p>
        </Link>
        <Link href="/manage/categories" className="card">
          <h3 className="mt-0">หมวดหมู่สินค้า</h3>
          <p className="mb-0 text-[var(--muted)]">สร้างหมวดหมู่แบบแยก และนำไปเลือกในหน้าเพิ่มสินค้า</p>
        </Link>
        <Link href="/manage/menu-options" className="card">
          <h3 className="mt-0">ตัวเลือกเมนู</h3>
          <p className="mb-0 text-[var(--muted)]">จัดการระดับเผ็ด เพิ่มพิเศษ และรายการไม่ใส่</p>
        </Link>
        <Link href="/manage/customers" className="card">
          <h3 className="mt-0">ลูกค้า</h3>
          <p className="mb-0 text-[var(--muted)]">จัดการรายชื่อลูกค้า และใช้เป็น dropdown ในหน้าขาย</p>
        </Link>
        <Link href="/manage/expenses" className="card">
          <h3 className="mt-0">ค่าใช้จ่าย</h3>
          <p className="mb-0 text-[var(--muted)]">บันทึกค่าของ ค่าพนักงาน ค่าไฟ และค่าใช้จ่ายอื่น</p>
        </Link>
        <Link href="/manage/receipt-template" className="card">
          <h3 className="mt-0">Template ใบเสร็จ</h3>
          <p className="mb-0 text-[var(--muted)]">ปรับหัวท้ายใบเสร็จ ความกว้างกระดาษ และสไตล์</p>
        </Link>
        <Link href="/manage/billing-batch" className="card">
          <h3 className="mt-0">ลงบิลย้อนหลัง/ล่วงหน้า</h3>
          <p className="mb-0 text-[var(--muted)]">เพิ่มทีละบิล เลือกวันเวลา ลูกค้า และสินค้าแบบ Modal</p>
        </Link>
        <Link href="/manage/print-jobs" className="card">
          <h3 className="mt-0">คิวพิมพ์</h3>
          <p className="mb-0 text-[var(--muted)]">ติดตามงานพิมพ์ใบเสร็จที่รอส่งเครื่องพิมพ์</p>
        </Link>
        <Link href="/manage/users" className="card">
          <h3 className="mt-0">ผู้ใช้งาน</h3>
          <p className="mb-0 text-[var(--muted)]">กำหนดสิทธิ์และจัดการ PIN ของผู้ใช้ระบบ</p>
        </Link>
        <Link href="/manage/inventory" className="card">
          <h3 className="mt-0">ประวัติสต็อก</h3>
          <p className="mb-0 text-[var(--muted)]">ตรวจสอบรายการตัด/ปรับ/เติมสต็อกย้อนหลัง</p>
        </Link>
        <Link href="/manage/audit" className="card">
          <h3 className="mt-0">Audit Log</h3>
          <p className="mb-0 text-[var(--muted)]">ดูประวัติการแก้ไขข้อมูลและการใช้งานของผู้ใช้</p>
        </Link>
      </section>

      <section className="card mb-4">
        <h2 className="mt-0">แจ้งเตือนสต็อกต่ำ (≤ {LOW_STOCK_THRESHOLD})</h2>
        {lowStockProducts.length === 0 ? (
          <p className="mb-0 text-[var(--ok)]">สต็อกอยู่ในระดับปกติ</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>สินค้า</th>
                <th>หมวดหมู่</th>
                <th>คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {lowStockProducts.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.category || "-"}</td>
                  <td className="font-semibold text-red-600">{product.stockQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <StoreSettingsForm
        initialSettings={{
          businessName: settings.businessName,
          branchName: settings.branchName,
          address: settings.address,
          phone: settings.phone,
          vatNumber: settings.vatNumber,
          appThemeKey: settings.appThemeKey,
          brandPrimary: settings.brandPrimary,
          brandAccent: settings.brandAccent,
          receiptLogoUrl: settings.receiptLogoUrl,
          vatEnabled: settings.vatEnabled,
          taxRate: toNumber(settings.taxRate),
          currency: settings.currency
        }}
      />
    </div>
  );
}
