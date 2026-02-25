import { applyReceiptTemplate } from "@/lib/receipt";

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

function formatAmount(value: number, currency = "THB") {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function sanitizeText(value: string) {
  return value
    .replaceAll("\r", "")
    .replace(/[^\x20-\x7E]/g, "?")
    .trim();
}

function escapePdfText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrapText(value: string, maxChars: number) {
  const text = sanitizeText(value);
  if (!text) return [""];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!word) continue;

    if (!current) {
      if (word.length <= maxChars) {
        current = word;
      } else {
        for (let index = 0; index < word.length; index += maxChars) {
          lines.push(word.slice(index, index + maxChars));
        }
      }
      continue;
    }

    const candidate = `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    lines.push(current);
    if (word.length <= maxChars) {
      current = word;
    } else {
      for (let index = 0; index < word.length; index += maxChars) {
        const chunk = word.slice(index, index + maxChars);
        if (chunk.length === maxChars) {
          lines.push(chunk);
        } else {
          current = chunk;
        }
      }
      if (word.length % maxChars === 0) {
        current = "";
      }
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function fitRight(label: string, value: string, width: number) {
  const cleanLabel = sanitizeText(label);
  const cleanValue = sanitizeText(value);
  const space = Math.max(1, width - cleanLabel.length - cleanValue.length);
  return `${cleanLabel}${" ".repeat(space)}${cleanValue}`;
}

function buildReceiptLines(payload: ReceiptPdfPayload, lineWidth: number) {
  const lines: string[] = [];
  const currency = payload.store.currency || "THB";
  const context = {
    businessName: payload.store.businessName,
    branchName: payload.store.branchName || null,
    orderNumber: payload.order.orderNumber,
    createdAt: payload.order.createdAt,
    total: payload.order.total,
    subtotal: payload.order.subtotal,
    discount: payload.order.discount,
    tax: payload.order.tax
  };

  for (const row of applyReceiptTemplate(payload.template.headerText, context).split("\n")) {
    lines.push(...wrapText(row, lineWidth));
  }

  if (payload.template.showStoreInfo) {
    lines.push("");
    lines.push(...wrapText(payload.store.businessName, lineWidth));
    if (payload.store.branchName) lines.push(...wrapText(`Branch: ${payload.store.branchName}`, lineWidth));
    if (payload.store.address) lines.push(...wrapText(payload.store.address, lineWidth));
    if (payload.store.phone) lines.push(...wrapText(`Tel: ${payload.store.phone}`, lineWidth));
    if (payload.template.showVatNumber && payload.store.vatNumber) {
      lines.push(...wrapText(`Tax ID: ${payload.store.vatNumber}`, lineWidth));
    }
  }

  lines.push("-".repeat(lineWidth));
  lines.push(...wrapText(`Order: ${payload.order.orderNumber}`, lineWidth));
  lines.push(...wrapText(`Date: ${formatDateTime(payload.order.createdAt)}`, lineWidth));
  lines.push(...wrapText(`Payment: ${payload.order.paymentMethod}`, lineWidth));
  lines.push("-".repeat(lineWidth));

  for (const item of payload.order.items) {
    lines.push(...wrapText(`${item.name} x${item.qty}`, lineWidth));
    lines.push(fitRight("", formatAmount(item.lineTotal, currency), lineWidth));
  }

  lines.push("-".repeat(lineWidth));
  lines.push(fitRight("Subtotal", formatAmount(payload.order.subtotal, currency), lineWidth));
  lines.push(fitRight("Discount", formatAmount(payload.order.discount, currency), lineWidth));
  lines.push(fitRight("Tax", formatAmount(payload.order.tax, currency), lineWidth));
  lines.push(fitRight("Total", formatAmount(payload.order.total, currency), lineWidth));

  if (payload.template.showCostBreakdown) {
    const estimatedCost = payload.order.items.reduce((sum, item) => {
      const itemCost = item.unitCost ? item.unitCost * item.qty : 0;
      return sum + itemCost;
    }, 0);
    lines.push(fitRight("Estimated Cost", formatAmount(estimatedCost, currency), lineWidth));
  }

  lines.push("-".repeat(lineWidth));
  for (const row of applyReceiptTemplate(payload.template.footerText, context).split("\n")) {
    lines.push(...wrapText(row, lineWidth));
  }

  return lines;
}

export function buildReceiptPdf(payload: ReceiptPdfPayload) {
  const pageWidthMm = payload.template.paperWidth === 58 ? 58 : 80;
  const pageWidthPt = (pageWidthMm / 25.4) * 72;
  const fontSize = 9;
  const lineHeight = 12;
  const marginX = 16;
  const marginY = 18;
  const maxChars = Math.max(24, Math.floor((pageWidthPt - marginX * 2) / (fontSize * 0.52)));
  const lines = buildReceiptLines(payload, maxChars);
  const pageHeightPt = Math.max(220, marginY * 2 + lines.length * lineHeight + 20);
  const startY = pageHeightPt - marginY - fontSize;

  const streamRows = ["BT", `/F1 ${fontSize} Tf`, `${lineHeight} TL`, `1 0 0 1 ${marginX.toFixed(2)} ${startY.toFixed(2)} Tm`];
  for (const [index, rawLine] of lines.entries()) {
    if (index > 0) streamRows.push("T*");
    streamRows.push(`(${escapePdfText(rawLine)}) Tj`);
  }
  streamRows.push("ET");

  const stream = `${streamRows.join("\n")}\n`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj`,
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream\nendobj`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const [index, object] of objects.entries()) {
    offsets[index + 1] = Buffer.byteLength(pdf, "utf8");
    pdf += `${object}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
