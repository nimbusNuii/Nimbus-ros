import { promises as fs } from "node:fs";
import path from "node:path";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import PdfPrinter from "pdfmake/src/printer";

type ReceiptPdfPayload = {
  order: {
    orderNumber: string;
    createdAt: Date | string;
    paymentMethod: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    items: Array<{
      name: string;
      qty: number;
      lineTotal: number;
      unitCost?: number;
    }>;
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
  };
};

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

const FONT_PATHS = {
  normal: path.join(FONT_DIR, "Sarabun-Regular.ttf"),
  bold: path.join(FONT_DIR, "Sarabun-Bold.ttf"),
  italics: path.join(FONT_DIR, "Sarabun-Italic.ttf"),
  bolditalics: path.join(FONT_DIR, "Sarabun-BoldItalic.ttf")
};

const ROBOTO_FONT_DIR = path.join(process.cwd(), "node_modules", "pdfmake", "fonts", "Roboto");

function formatDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function formatAmount(value: number, currency = "THB") {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(value);
}

function nonEmptyLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toDataUri(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function resolveLogoDataUri(logoUrl?: string | null) {
  const value = logoUrl?.trim();
  if (!value) return null;

  if (value.startsWith("data:image/")) {
    return value;
  }

  if (!/^https?:\/\//i.test(value)) {
    return null;
  }

  try {
    const response = await fetch(value, { cache: "no-store" });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    const mime = contentType.split(";")[0].toLowerCase();
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mime)) return null;

    const buffer = new Uint8Array(await response.arrayBuffer());
    return toDataUri(buffer, mime || "image/png");
  } catch {
    return null;
  }
}

async function resolveFontDescriptors(): Promise<Record<string, Record<string, string>>> {
  const hasThaiFont = await fs
    .access(FONT_PATHS.normal)
    .then(() => true)
    .catch(() => false);

  if (hasThaiFont) {
    return {
      Sarabun: FONT_PATHS
    };
  }

  return {
    Roboto: {
      normal: path.join(ROBOTO_FONT_DIR, "Roboto-Regular.ttf"),
      bold: path.join(ROBOTO_FONT_DIR, "Roboto-Medium.ttf"),
      italics: path.join(ROBOTO_FONT_DIR, "Roboto-Italic.ttf"),
      bolditalics: path.join(ROBOTO_FONT_DIR, "Roboto-MediumItalic.ttf")
    }
  };
}

function buildContent(payload: ReceiptPdfPayload, logoDataUri: string | null) {
  const currency = payload.store.currency || "THB";
  const content: Content[] = [];

  if (logoDataUri) {
    content.push({
      image: logoDataUri,
      fit: [120, 60],
      alignment: "center",
      margin: [0, 0, 0, 8]
    });
  }

  const headerLines = nonEmptyLines(payload.template.headerText);
  if (headerLines.length > 0) {
    content.push({
      text: headerLines.join("\n"),
      style: "header",
      alignment: "center",
      margin: [0, 0, 0, 8]
    });
  }

  if (payload.template.showStoreInfo) {
    const storeLines = [
      payload.store.businessName,
      payload.store.branchName ? `สาขา: ${payload.store.branchName}` : "",
      payload.store.address || "",
      payload.store.phone ? `โทร ${payload.store.phone}` : "",
      payload.template.showVatNumber && payload.store.vatNumber ? `เลขภาษี ${payload.store.vatNumber}` : ""
    ].filter(Boolean);

    content.push({
      text: storeLines.join("\n"),
      style: "meta",
      margin: [0, 0, 0, 8]
    });
  }

  content.push({
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 2000, y2: 0, lineWidth: 0.5 }],
    margin: [0, 2, 0, 6]
  });

  content.push({
    columns: [
      { text: "เลขที่ออเดอร์", style: "label" },
      { text: payload.order.orderNumber, style: "value", alignment: "right" }
    ]
  });
  content.push({
    columns: [
      { text: "วันที่เวลา", style: "label" },
      { text: formatDateTime(payload.order.createdAt), style: "value", alignment: "right" }
    ]
  });
  content.push({
    columns: [
      { text: "ชำระเงิน", style: "label" },
      { text: payload.order.paymentMethod, style: "value", alignment: "right" }
    ],
    margin: [0, 0, 0, 6]
  });

  content.push({
    table: {
      widths: ["*", "auto"],
      body: [
        [
          { text: "รายการ", style: "tableHeader" },
          { text: "รวม", style: "tableHeader", alignment: "right" }
        ],
        ...payload.order.items.map((item) => [
          { text: `${item.name} x${item.qty}`, style: "tableCell" },
          { text: formatAmount(item.lineTotal, currency), style: "tableCell", alignment: "right" }
        ])
      ]
    },
    layout: {
      hLineWidth: (index: number, node: { table: { body: unknown[] } }) => {
        const rowCount = node.table.body.length;
        if (index === 0 || index === 1 || index === rowCount) return 0.5;
        return 0.25;
      },
      vLineWidth: () => 0,
      hLineColor: () => "#b3aca0",
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 3,
      paddingBottom: () => 3
    },
    margin: [0, 0, 0, 8]
  } as Content);

  const summaryRows: Array<[string, string]> = [
    ["ยอดรวม", formatAmount(payload.order.subtotal, currency)],
    ["ส่วนลด", formatAmount(payload.order.discount, currency)],
    ["ภาษี", formatAmount(payload.order.tax, currency)],
    ["รวมสุทธิ", formatAmount(payload.order.total, currency)]
  ];

  if (payload.template.showCostBreakdown) {
    const estimatedCost = payload.order.items.reduce((sum, item) => {
      const unitCost = item.unitCost ?? 0;
      return sum + unitCost * item.qty;
    }, 0);
    summaryRows.push(["ประมาณค่าของ", formatAmount(estimatedCost, currency)]);
  }

  summaryRows.forEach(([label, value], index) => {
    content.push({
      columns: [
        { text: label, style: index === 3 ? "totalLabel" : "label" },
        { text: value, style: index === 3 ? "totalValue" : "value", alignment: "right" }
      ]
    });
  });

  content.push({
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 2000, y2: 0, lineWidth: 0.5 }],
    margin: [0, 6, 0, 8]
  });

  const footerLines = nonEmptyLines(payload.template.footerText);
  if (footerLines.length > 0) {
    content.push({
      text: footerLines.join("\n"),
      style: "footer",
      alignment: "center"
    });
  }

  return content;
}

function estimatePageHeight(payload: ReceiptPdfPayload) {
  const linesFromHeader = nonEmptyLines(payload.template.headerText).length;
  const linesFromFooter = nonEmptyLines(payload.template.footerText).length;
  const storeLines = payload.template.showStoreInfo ? 5 : 0;
  const fixedLines = 14;
  const itemLines = payload.order.items.length * 1.4;
  const summaryLines = payload.template.showCostBreakdown ? 5 : 4;
  const totalLines = linesFromHeader + linesFromFooter + storeLines + fixedLines + itemLines + summaryLines;
  return Math.max(260, Math.ceil(totalLines * 15 + 70));
}

export async function buildReceiptPdfWithPdfmake(payload: ReceiptPdfPayload) {
  const pageWidthPt = payload.template.paperWidth === 58 ? 164 : 228;
  const pageHeightPt = estimatePageHeight(payload);
  const fonts = await resolveFontDescriptors();
  const fontFamily = "Sarabun" in fonts ? "Sarabun" : "Roboto";
  const printer = new PdfPrinter(fonts);
  const logoDataUri = await resolveLogoDataUri(payload.store.receiptLogoUrl);

  const docDefinition: TDocumentDefinitions = {
    pageSize: {
      width: pageWidthPt,
      height: pageHeightPt
    },
    pageMargins: [12, 12, 12, 12],
    defaultStyle: {
      font: fontFamily,
      fontSize: payload.template.paperWidth === 58 ? 9 : 10
    },
    styles: {
      header: { bold: true, fontSize: payload.template.paperWidth === 58 ? 10 : 11 },
      footer: { fontSize: 9, color: "#4f4f4f" },
      meta: { fontSize: 8.5, color: "#4f4f4f" },
      label: { fontSize: 9, color: "#333333" },
      value: { fontSize: 9, color: "#111111" },
      totalLabel: { fontSize: 9.5, bold: true, color: "#111111" },
      totalValue: { fontSize: 9.5, bold: true, color: "#111111" },
      tableHeader: { bold: true, fontSize: 9, color: "#222222" },
      tableCell: { fontSize: 8.8, color: "#111111" }
    },
    content: buildContent(payload, logoDataUri)
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    pdfDoc.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    pdfDoc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    pdfDoc.on("error", (error: Error) => {
      reject(error);
    });

    pdfDoc.end();
  });
}
