"use client";

import { usePathname } from "next/navigation";
import { MainNav } from "@/components/main-nav";

/** Paths that should render full-screen without MainNav or main padding */
const FULL_SCREEN_PATHS = ["/create-order", "/kitchen", "/pos"];

export function NavWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = FULL_SCREEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isFullScreen) {
    return <>{children}</>;
  }

  return (
    <>
      <MainNav />
      <main>{children}</main>
    </>
  );
}
