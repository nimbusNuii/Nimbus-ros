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
      style={{
        width: template.paperWidth === 58 ? 260 : 340,
        margin: "0 auto",
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 16
      }}
    >
      <style>{template.customCss || ""}</style>
      <div style={{ textAlign: "center", marginBottom: 10, whiteSpace: "pre-line" }}>
        {applyReceiptTemplate(template.headerText, context)}
      </div>

      {template.showStoreInfo ? (
        <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
          <div>{store.businessName}</div>
          {store.branchName ? <div>สาขา: {store.branchName}</div> : null}
          {store.address ? <div>{store.address}</div> : null}
          {store.phone ? <div>โทร {store.phone}</div> : null}
          {template.showVatNumber && store.vatNumber ? <div>เลขภาษี {store.vatNumber}</div> : null}
        </div>
      ) : null}

      <div style={{ borderTop: "1px dashed #333", borderBottom: "1px dashed #333", padding: "8px 0", marginBottom: 8 }}>
        <div>เลขที่: {order.orderNumber}</div>
        <div>เวลา: {formatDateTime(order.createdAt)}</div>
        <div>ชำระ: {order.paymentMethod}</div>
      </div>

      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>รายการ</th>
            <th style={{ textAlign: "right" }}>รวม</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.name} x{item.qty}
              </td>
              <td style={{ textAlign: "right" }}>{formatCurrency(item.lineTotal, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: "100%", marginTop: 8, fontSize: 13 }}>
        <tbody>
          <tr>
            <td>ยอดรวม</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(order.subtotal, currency)}</td>
          </tr>
          <tr>
            <td>ส่วนลด</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(order.discount, currency)}</td>
          </tr>
          <tr>
            <td>ภาษี</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(order.tax, currency)}</td>
          </tr>
          <tr>
            <td>
              <strong>สุทธิ</strong>
            </td>
            <td style={{ textAlign: "right" }}>
              <strong>{formatCurrency(order.total, currency)}</strong>
            </td>
          </tr>
          {template.showCostBreakdown ? (
            <tr>
              <td>ประมาณค่าของ</td>
              <td style={{ textAlign: "right" }}>{formatCurrency(estimatedCost, currency)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div style={{ marginTop: 10, textAlign: "center", whiteSpace: "pre-line", fontSize: 13 }}>
        {applyReceiptTemplate(template.footerText, context)}
      </div>
    </div>
  );
}
