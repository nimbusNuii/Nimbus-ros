import type { Metadata } from "next";
import { Sarabun, Inter } from "next/font/google";
import "./globals.css";
import { NavWrapper } from "@/components/nav-wrapper";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sarabun",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | POS System",
    default: "POS System"
  },
  description: "ระบบ POS สำหรับร้านอาหาร — จัดการออเดอร์ สต็อก และรายงานยอดขาย"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${sarabun.variable} ${inter.variable}`}>
      <body>
        <NavWrapper>{children}</NavWrapper>
      </body>
    </html>
  );
}
