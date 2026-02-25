import type { Metadata } from "next";
import "./globals.css";
import { MainNav } from "@/components/main-nav";

export const metadata: Metadata = {
  title: "POS System",
  description: "Next.js + PostgreSQL POS with receipt templates"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <MainNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
