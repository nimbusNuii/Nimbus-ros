"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME,
  isAppThemeKey,
  type AppThemeKey
} from "@/lib/app-theme-presets";

type UserRole = "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN";

type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", roles: ["CASHIER", "KITCHEN", "MANAGER", "ADMIN"] },
  { href: "/create-order", label: "Create Order", roles: ["CASHIER", "MANAGER", "ADMIN"] },
  { href: "/receipts", label: "Receipts", roles: ["CASHIER", "MANAGER", "ADMIN"] },
  { href: "/kitchen", label: "Kitchen", roles: ["KITCHEN", "MANAGER", "ADMIN"] },
  { href: "/summary", label: "Summary", roles: ["MANAGER", "ADMIN"] },
  { href: "/manage", label: "Manage", roles: ["MANAGER", "ADMIN"] }
];

function initials(name: string) {
  const value = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() || "")
    .join("");
  return value || "U";
}

export function MainNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<null | { fullName: string; role: UserRole }>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [, setTheme] = useState<AppThemeKey>(DEFAULT_APP_THEME);

  function applyTheme(themeKey: AppThemeKey) {
    document.documentElement.setAttribute("data-theme", themeKey);
  }

  function applyBrandColors(brandPrimary: string, brandAccent: string) {
    document.documentElement.style.setProperty("--brand-primary", brandPrimary);
    document.documentElement.style.setProperty("--brand-accent", brandAccent);
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled) {
          const payload = data.user as { fullName?: string; role?: UserRole } | null;
          if (payload?.fullName && payload?.role) {
            setUser({
              fullName: payload.fullName,
              role: payload.role
            });
          } else {
            setUser(null);
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoaded(true);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTheme = async () => {
      let defaultTheme = DEFAULT_APP_THEME;

      try {
        const response = await fetch("/api/brand-theme", { cache: "force-cache" });
        const payload = (await response.json()) as {
          appThemeKey?: string;
          brandPrimary?: string;
          brandAccent?: string;
        };

        if (!cancelled) {
          if (payload.brandPrimary && payload.brandAccent) {
            applyBrandColors(payload.brandPrimary, payload.brandAccent);
          }
          if (payload.appThemeKey && isAppThemeKey(payload.appThemeKey)) {
            defaultTheme = payload.appThemeKey;
          }
        }
      } catch {
        // keep fallback theme when API is not available
      }

      if (cancelled) return;

      const storedTheme = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
      const selected = storedTheme && isAppThemeKey(storedTheme) ? storedTheme : defaultTheme;
      setTheme(selected);
      applyTheme(selected);
    };

    void loadTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/auth/login";
  }

  const visibleLinks = user ? navItems.filter((item) => item.roles.includes(user.role)) : [];
  const hideNav = pathname === "/create-order" || pathname.startsWith("/create-order/");

  if (hideNav) {
    return null;
  }

  return (
    <nav className="nav px-4 py-2">
      <div className="topnav-shell mx-auto flex w-full max-w-[1500px] items-center justify-between px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="topnav-chip grid h-9 w-9 place-items-center rounded-xl">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 10C6.5 7 9.5 7 13 10"
                stroke="var(--topnav-logo-a)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d="M7 15C10.5 12 13.5 12 17 15"
                stroke="var(--topnav-logo-b)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
            {authLoaded && user ? (
              visibleLinks.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`topnav-link rounded-xl px-3 py-2 text-sm font-medium transition ${
                      active ? "topnav-link-active" : ""
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })
            ) : (
              <Link
                href="/auth/login"
                className="topnav-link topnav-link-active rounded-xl px-3 py-2 text-sm font-medium"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="topnav-avatar grid h-9 w-9 place-items-center rounded-full text-sm font-semibold">
                {initials(user.fullName)}
              </div>
              <button
                className="topnav-logout h-9 rounded-xl px-3 text-sm"
                type="button"
                onClick={logout}
              >
                Logout
              </button>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
