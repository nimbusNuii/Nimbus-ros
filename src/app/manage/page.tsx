import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { StoreSettingsForm } from "@/components/store-settings-form";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const LOW_STOCK_THRESHOLD = 10;
  const menuGroups = [
    {
      title: "เมนูสินค้า",
      items: [
        { href: "/manage/products", label: "สินค้า", hint: "เมนูและราคา" },
        { href: "/manage/categories", label: "หมวดหมู่สินค้า", hint: "จัดกลุ่มสินค้า" },
        { href: "/manage/menu-options", label: "ตัวเลือกเมนู", hint: "เผ็ด/เพิ่มพิเศษ" },
        { href: "/manage/inventory", label: "ประวัติสต็อก", hint: "ดูตัด/ปรับสต็อก" }
      ]
    },
    {
      title: "เมนูขายและลูกค้า",
      items: [
        { href: "/manage/customers", label: "ลูกค้า", hint: "ลูกค้าประจำ/ขาจร" },
        { href: "/manage/billing-batch", label: "ลงบิลย้อนหลัง", hint: "เพิ่มบิลชำระแล้ว" },
        { href: "/manage/receipt-template", label: "Template ใบเสร็จ", hint: "แก้รูปแบบใบเสร็จ" },
        { href: "/manage/print-jobs", label: "คิวพิมพ์", hint: "ติดตามงานพิมพ์" }
      ]
    },
    {
      title: "เมนูระบบ",
      items: [
        { href: "/manage/expenses", label: "ค่าใช้จ่าย", hint: "ต้นทุน/ค่าไฟ/พนักงาน" },
        { href: "/manage/users", label: "ผู้ใช้งาน", hint: "สิทธิ์และ PIN" },
        { href: "/manage/audit", label: "Audit Log", hint: "ตรวจสอบประวัติระบบ" }
      ]
    }
  ];

  await requirePageRole(["MANAGER", "ADMIN"]);

  const [settings, lowStockProducts] = await Promise.all([
    prisma.storeSetting.findUnique({
      where: { id: 1 }
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
    <div className="space-y-4">
      <section className="card mb-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {menuGroups.map((group) => (
            <div key={group.title} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
              <p className="mb-2 mt-0 text-sm font-semibold text-[var(--text)]">{group.title}</p>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="secondary flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[var(--text)]">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-[var(--muted)] sm:hidden">{item.hint}</span>
                    </span>
                    <span className="hidden shrink-0 text-xs text-[var(--muted)] sm:inline">{item.hint}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="mt-0 text-xl font-semibold">แจ้งเตือนสต็อกต่ำ (≤ {LOW_STOCK_THRESHOLD})</h2>
        {lowStockProducts.length === 0 ? (
          <p className="mb-0 text-[var(--ok)]">สต็อกอยู่ในระดับปกติ</p>
        ) : (
          <>
            <div className="space-y-2 md:hidden">
              {lowStockProducts.map((product) => (
                <article key={product.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-strong)] p-3">
                  <p className="m-0 text-sm font-semibold">{product.name}</p>
                  <p className="m-0 mt-1 text-xs text-[var(--muted)]">หมวดหมู่: {product.category || "-"}</p>
                  <p className="m-0 mt-2 text-sm">
                    คงเหลือ: <span className="font-semibold text-red-600">{product.stockQty}</span>
                  </p>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="table min-w-[680px]">
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
            </div>
          </>
        )}
      </section>

      <StoreSettingsForm
        initialSettings={{
          businessName: settings?.businessName || "POS Shop",
          branchName: settings?.branchName || null,
          address: settings?.address || null,
          phone: settings?.phone || null,
          vatNumber: settings?.vatNumber || null,
          appThemeKey: settings?.appThemeKey || "sandstone",
          brandPrimary: settings?.brandPrimary || "#b24a2b",
          brandAccent: settings?.brandAccent || "#8f381f",
          receiptLogoUrl: settings?.receiptLogoUrl || null,
          vatEnabled: settings?.vatEnabled ?? true,
          taxRate: toNumber(settings?.taxRate ?? 7),
          currency: settings?.currency || "THB"
        }}
      />
    </div>
  );
}
