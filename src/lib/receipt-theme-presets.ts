export type ReceiptThemeTemplate = {
  name: string;
  headerText: string;
  footerText: string;
  showStoreInfo: boolean;
  showVatNumber: boolean;
  showCostBreakdown: boolean;
  paperWidth: number;
  customCss: string;
};

export type ReceiptThemePreset = {
  key: string;
  label: string;
  description: string;
  tags: string[];
  template: ReceiptThemeTemplate;
};

export const RECEIPT_THEME_PRESETS: ReceiptThemePreset[] = [
  {
    key: "classic-thermal",
    label: "Classic Thermal",
    description: "ธีมเรียบ อ่านง่าย ใช้ได้กับร้านทั่วไปและเครื่องพิมพ์ 80mm",
    tags: ["80mm", "Balanced", "Default"],
    template: {
      name: "Classic Thermal",
      headerText: "{{businessName}}\nใบเสร็จรับเงิน",
      footerText: "ขอบคุณที่อุดหนุน\nแล้วพบกันใหม่",
      showStoreInfo: true,
      showVatNumber: true,
      showCostBreakdown: false,
      paperWidth: 80,
      customCss: `.receipt-document {\n  border-radius: 8px;\n}\n.receipt-document table {\n  font-size: 13px;\n}\n.receipt-document strong {\n  letter-spacing: 0.2px;\n}`
    }
  },
  {
    key: "modern-cafe",
    label: "Modern Cafe",
    description: "ธีมคาเฟ่โทนอบอุ่น เน้นแบรนด์และ spacing ที่หายใจได้",
    tags: ["80mm", "Branding", "Cafe"],
    template: {
      name: "Modern Cafe",
      headerText: "WELCOME TO {{businessName}}\nOrder {{orderNumber}}",
      footerText: "You made our day.\nTotal {{total}}",
      showStoreInfo: true,
      showVatNumber: false,
      showCostBreakdown: false,
      paperWidth: 80,
      customCss: `.receipt-document {\n  border-radius: 18px;\n  border-color: #d8b58f;\n  background: #fffaf3;\n}\n.receipt-document table {\n  font-size: 12px;\n}\n.receipt-document th {\n  text-transform: uppercase;\n  letter-spacing: 0.5px;\n  color: #8f5f32;\n}\n.receipt-document td {\n  padding-top: 2px;\n  padding-bottom: 2px;\n}`
    }
  },
  {
    key: "compact-fast",
    label: "Compact Fast",
    description: "กระชับ ประหยัดกระดาษ เหมาะร้านที่บิลออกถี่",
    tags: ["58mm", "Fast", "Minimal"],
    template: {
      name: "Compact Fast",
      headerText: "{{businessName}} | {{orderNumber}}",
      footerText: "ยอดสุทธิ {{total}}\nขอบคุณครับ",
      showStoreInfo: false,
      showVatNumber: false,
      showCostBreakdown: false,
      paperWidth: 58,
      customCss: `.receipt-document {\n  border-radius: 8px;\n  padding: 10px;\n}\n.receipt-document table {\n  font-size: 11px;\n}\n.receipt-document div,\n.receipt-document td,\n.receipt-document th {\n  line-height: 1.25;\n}`
    }
  },
  {
    key: "vat-formal",
    label: "VAT Formal",
    description: "เน้นข้อมูลภาษีและต้นทุน เหมาะร้านที่ต้องตรวจสอบย้อนหลัง",
    tags: ["80mm", "VAT", "Formal"],
    template: {
      name: "VAT Formal",
      headerText: "{{businessName}}\nTAX RECEIPT",
      footerText: "เลขที่ {{orderNumber}}\nวันที่ {{date}}\nขอบคุณที่ใช้บริการ",
      showStoreInfo: true,
      showVatNumber: true,
      showCostBreakdown: true,
      paperWidth: 80,
      customCss: `.receipt-document {\n  border-radius: 6px;\n  border-width: 2px;\n}\n.receipt-document table {\n  font-size: 12px;\n}\n.receipt-document th,\n.receipt-document td {\n  border-bottom: 1px solid #d4d4d4;\n}\n.receipt-document tr:last-child td {\n  border-bottom: none;\n}`
    }
  }
];

export function getReceiptThemePreset(key: string) {
  return RECEIPT_THEME_PRESETS.find((preset) => preset.key === key) ?? RECEIPT_THEME_PRESETS[0];
}
