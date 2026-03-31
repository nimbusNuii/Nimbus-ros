import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toNumber, formatCurrency } from "@/lib/format";
import { StoreSettingsForm } from "@/components/store-settings-form";
import { ManageLowStockAlert } from "@/components/manage-low-stock-alert";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

function Ico({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function ManagePage() {
  const LOW_STOCK_THRESHOLD = 10;
  await requirePageRole(["MANAGER", "ADMIN"]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    settings,
    lowStockProducts,
    productCount,
    categoryCount,
    customerCount,
    userCount,
    menuOptionCount,
    pendingPrintCount,
    monthExpense,
  ] = await Promise.all([
    prisma.storeSetting.findUnique({ where: { id: 1 } }),
    prisma.product.findMany({
      where: { isActive: true, stockQty: { lte: LOW_STOCK_THRESHOLD } },
      orderBy: [{ stockQty: "asc" }, { name: "asc" }],
      take: 12,
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.productCategory.count(),
    prisma.customer.count(),
    prisma.appUser.count({ where: { isActive: true } }),
    prisma.menuOption.count(),
    prisma.printJob.count({ where: { status: "PENDING" } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { incurredOn: { gte: monthStart } } }),
  ]);

  const currency = settings?.currency || "THB";
  const storeName = settings?.businessName || "POS Shop";
  const expenseTotal = Number(monthExpense._sum.amount ?? 0);

  const STATS = [
    {
      label: "สินค้า",
      value: productCount,
      unit: "รายการ",
      icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
      href: "/manage/products",
      color: "#2563eb",
      bg: "#eff6ff",
    },
    {
      label: "หมวดหมู่",
      value: categoryCount,
      unit: "หมวด",
      icon: "M4 6h16M4 10h16M4 14h16M4 18h16",
      href: "/manage/categories",
      color: "#0891b2",
      bg: "#ecfeff",
    },
    {
      label: "ลูกค้า",
      value: customerCount,
      unit: "ราย",
      icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z",
      href: "/manage/customers",
      color: "#7c3aed",
      bg: "#f5f3ff",
    },
    {
      label: "ผู้ใช้งาน",
      value: userCount,
      unit: "คน",
      icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
      href: "/manage/users",
      color: "#475569",
      bg: "#f1f5f9",
    },
    {
      label: "ค่าใช้จ่ายเดือนนี้",
      value: formatCurrency(expenseTotal, currency),
      unit: null,
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      href: "/manage/expenses",
      color: "#b45309",
      bg: "#fffbeb",
    },
    {
      label: "คิวพิมพ์ค้างอยู่",
      value: pendingPrintCount,
      unit: "รายการ",
      icon: "M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z",
      href: "/manage/print-jobs",
      color: pendingPrintCount > 0 ? "#d97706" : "#475569",
      bg: pendingPrintCount > 0 ? "#fffbeb" : "#f1f5f9",
    },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Store header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.2 }}>{storeName}</h1>
          {settings?.branchName && (
            <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>สาขา {settings.branchName}</p>
          )}
        </div>
        <span style={{
          fontSize: "0.7rem", fontWeight: 600, color: "var(--muted)",
          background: "var(--bg)", border: "1px solid var(--line)",
          borderRadius: 20, padding: "3px 10px",
        }}>
          {new Date().toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
        </span>
      </div>

      {/* ── Stats grid ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {STATS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px 7px 8px",
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 10,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 7, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, flexShrink: 0 }}>
              <Ico d={s.icon} size={13} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--muted)", lineHeight: 1.1, whiteSpace: "nowrap" }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.2, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {s.value}{s.unit ? <span style={{ fontSize: "0.62rem", fontWeight: 400, color: "var(--muted)", marginLeft: 3 }}>{s.unit}</span> : null}
              </p>
            </div>
          </Link>
        ))}
        <ManageLowStockAlert threshold={LOW_STOCK_THRESHOLD} products={lowStockProducts.map((p) => ({ id: p.id, name: p.name, category: p.category, stockQty: p.stockQty }))} />
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: "var(--line)" }} />

      {/* ── Store settings form ── */}
      <div>
        <p style={{ margin: "0 0 14px", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>
          ตั้งค่าร้านค้า
        </p>
        <StoreSettingsForm
          initialSettings={{
            businessName: settings?.businessName || "POS Shop",
            branchName: settings?.branchName || null,
            address: settings?.address || null,
            phone: settings?.phone || null,
            vatNumber: settings?.vatNumber || null,
            brandPrimary: settings?.brandPrimary || "#b24a2b",
            brandAccent: settings?.brandAccent || "#8f381f",
            receiptLogoUrl: settings?.receiptLogoUrl || null,
            vatEnabled: settings?.vatEnabled ?? true,
            taxRate: toNumber(settings?.taxRate ?? 7),
            currency: settings?.currency || "THB",
          }}
        />
      </div>
    </div>
  );
}
