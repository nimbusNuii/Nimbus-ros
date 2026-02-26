"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  APP_THEME_PRESETS,
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
  { href: "/pos", label: "POS", roles: ["CASHIER", "MANAGER", "ADMIN"] },
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
  const [theme, setTheme] = useState<AppThemeKey>(DEFAULT_APP_THEME);
  const selectedTheme = APP_THEME_PRESETS.find((item) => item.key === theme) ?? APP_THEME_PRESETS[0];

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
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const loadTheme = async () => {
      let defaultTheme = DEFAULT_APP_THEME;

      try {
        const response = await fetch("/api/brand-theme", { cache: "no-store" });
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

  function onThemeChange(nextTheme: AppThemeKey) {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, nextTheme);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/auth/login";
  }

  const visibleLinks = user ? navItems.filter((item) => item.roles.includes(user.role)) : [];

  return (
    <nav className="nav px-4 py-3">
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between rounded-xl border border-white/10 bg-[#0f1b2f] px-4 py-3 shadow-[0_10px_35px_rgba(3,10,23,0.35)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-[#111f36]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 10C6.5 7 9.5 7 13 10" stroke="#7e8cff" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M7 15C10.5 12 13.5 12 17 15" stroke="#6de2f7" strokeWidth="2.2" strokeLinecap="round" />
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
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-[#0b1322] text-white"
                        : "text-slate-300 hover:bg-[#15233a] hover:text-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })
            ) : (
              <Link href="/auth/login" className="rounded-lg bg-[#0b1322] px-3 py-2 text-sm font-medium text-white">
                Login
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <select
              id="systemTheme"
              value={theme}
              onChange={(event) => onThemeChange(event.target.value as AppThemeKey)}
              className="h-9 rounded-lg border border-white/10 bg-[#111f36] px-3 text-xs text-slate-200"
              title={selectedTheme.description}
            >
              {APP_THEME_PRESETS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-[#111f36] text-slate-200"
            title={selectedTheme.description}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 20.5C13.3 20.5 14.4 19.4 14.4 18.1H9.6C9.6 19.4 10.7 20.5 12 20.5Z"
                fill="currentColor"
              />
              <path
                d="M18 14.7L16.8 12.8V10.1C16.8 7.46 14.64 5.3 12 5.3C9.36 5.3 7.2 7.46 7.2 10.1V12.8L6 14.7V15.5H18V14.7Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {user ? (
            <>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#7e8cff] to-[#56d6ef] text-sm font-semibold text-[#0e1a2d]">
                {initials(user.fullName)}
              </div>
              <button
                className="h-9 rounded-lg border border-white/10 bg-[#111f36] px-3 text-sm text-slate-100 hover:bg-[#1a2b46]"
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
