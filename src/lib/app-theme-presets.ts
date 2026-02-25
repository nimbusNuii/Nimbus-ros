export type AppThemeKey =
  | "brand"
  | "sandstone"
  | "ocean-ink"
  | "matcha-paper"
  | "sunset-ledger"
  | "graphite-night";

export type AppThemePreset = {
  key: AppThemeKey;
  label: string;
  description: string;
};

export const APP_THEME_STORAGE_KEY = "pos_app_theme";
export const DEFAULT_APP_THEME: AppThemeKey = "sandstone";

export const APP_THEME_PRESETS: AppThemePreset[] = [
  {
    key: "brand",
    label: "Brand Theme",
    description: "ใช้สีแบรนด์จากหน้าจัดการร้าน และใช้ร่วมกับโลโก้ใบเสร็จ"
  },
  {
    key: "sandstone",
    label: "Sandstone",
    description: "โทนอบอุ่นแบบค่าเริ่มต้น อ่านง่ายทุกหน้า"
  },
  {
    key: "ocean-ink",
    label: "Ocean Ink",
    description: "ฟ้า-น้ำเงิน เน้นความคมชัดแบบดาต้าแดชบอร์ด"
  },
  {
    key: "matcha-paper",
    label: "Matcha Paper",
    description: "เขียวครีมสบายตา เหมาะใช้งานทั้งวัน"
  },
  {
    key: "sunset-ledger",
    label: "Sunset Ledger",
    description: "ส้มอิฐแบบเอกสารบัญชี ให้ความรู้สึกแอคทีฟ"
  },
  {
    key: "graphite-night",
    label: "Graphite Night",
    description: "เข้มชัดสำหรับหน้าจอสว่างจัด"
  }
];

export function isAppThemeKey(value: string): value is AppThemeKey {
  return APP_THEME_PRESETS.some((theme) => theme.key === value);
}
