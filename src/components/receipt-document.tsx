import { applyReceiptTemplate } from "@/lib/receipt";
import { formatCurrency, formatDateTime } from "@/lib/format";

export type ReceiptOrderLine = {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  unitCost?: number;
  lineTotal: number;
};

export type ReceiptDocumentProps = {
  order: {
    orderNumber: string;
    createdAt: string | Date;
    paymentMethod: string;
    customerType?: "WALK_IN" | "REGULAR";
    customerName?: string | null;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    items: ReceiptOrderLine[];
  };
  store: {
    businessName: string;
    branchName?: string | null;
    address?: string | null;
    phone?: string | null;
    vatNumber?: string | null;
    receiptLogoUrl?: string | null;
    currency?: string | null;
  };
  template: {
    headerText: string;
    footerText: string;
    showStoreInfo: boolean;
    showVatNumber: boolean;
    showCostBreakdown: boolean;
    paperWidth: number;
    customCss?: string | null;
  };
};

export function ReceiptDocument({ order, store, template }: ReceiptDocumentProps) {
  const currency = store.currency || "THB";
  const context = {
    businessName: store.businessName,
    branchName: store.branchName,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    total: order.total,
    subtotal: order.subtotal,
    discount: order.discount,
    tax: order.tax
  };

  const estimatedCost = order.items.reduce(
    (sum, item) => sum + (item.unitCost ? item.unitCost * item.qty : 0),
    0
  );

  return (
    <div
      className="receipt-document rounded-xl border border-[var(--line)] bg-white p-4 text-[var(--text)] shadow-md"
      style={{
        width: template.paperWidth === 58 ? 260 : 340,
        margin: "0 auto"
      }}
    >
      <style>{template.customCss || ""}</style>
      {store.receiptLogoUrl ? (
        <div className="mb-3 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={store.receiptLogoUrl}
            alt="Receipt logo"
            className="max-h-16 w-auto object-contain"
          />
        </div>
      ) : null}

      <div className="mb-2 text-center whitespace-pre-line text-sm font-medium">
        {applyReceiptTemplate(template.headerText, context)}
      </div>

      {template.showStoreInfo ? (
        <div className="mb-2 text-[12px] text-[var(--muted)]">
          <div>{store.businessName}</div>
          {store.branchName ? <div>สาขา: {store.branchName}</div> : null}
          {store.address ? <div>{store.address}</div> : null}
          {store.phone ? <div>โทร {store.phone}</div> : null}
          {template.showVatNumber && store.vatNumber ? <div>เลขภาษี {store.vatNumber}</div> : null}
        </div>
      ) : null}

      <div className="mb-2 border-y border-dashed border-neutral-500 py-2 text-[13px]">
        <div>เลขที่: {order.orderNumber}</div>
        <div>เวลา: {formatDateTime(order.createdAt)}</div>
        <div>ลูกค้า: {order.customerName || (order.customerType === "REGULAR" ? "ลูกค้าประจำ" : "ลูกค้าขาจร")}</div>
        <div>ชำระ: {order.paymentMethod}</div>
      </div>

      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="text-left">รายการ</th>
            <th className="text-right">รวม</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.name} x{item.qty}
              </td>
              <td className="text-right">{formatCurrency(item.lineTotal, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-2 w-full text-[13px]">
        <tbody>
          <tr>
            <td>ยอดรวม</td>
            <td className="text-right">{formatCurrency(order.subtotal, currency)}</td>
          </tr>
          <tr>
            <td>ส่วนลด</td>
            <td className="text-right">{formatCurrency(order.discount, currency)}</td>
          </tr>
          <tr>
            <td>ภาษี</td>
            <td className="text-right">{formatCurrency(order.tax, currency)}</td>
          </tr>
          <tr>
            <td>
              <strong>สุทธิ</strong>
            </td>
            <td className="text-right">
              <strong>{formatCurrency(order.total, currency)}</strong>
            </td>
          </tr>
          {template.showCostBreakdown ? (
            <tr>
              <td>ประมาณค่าของ</td>
              <td className="text-right">{formatCurrency(estimatedCost, currency)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="mt-3 text-center text-[13px] whitespace-pre-line">
        {applyReceiptTemplate(template.footerText, context)}
      </div>
    </div>
  );
}
