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

const links = [
  { href: "/", label: "ภาพรวม" },
  { href: "/pos", label: "หน้าร้าน" },
  { href: "/receipts", label: "ใบเสร็จย้อนหลัง" },
  { href: "/kitchen", label: "หน้าครัว" },
  { href: "/summary", label: "หน้าสรุป" },
  { href: "/manage", label: "หน้าจัดการ" },
  { href: "/auth/login", label: "ล็อกอิน" }
];

export function MainNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<null | { fullName: string; role: string }>(null);
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
          setUser(data.user ?? null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
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

  return (
    <nav className="nav">
      <div className="nav-inner justify-between">
        <div className="flex flex-wrap gap-2">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link key={link.href} href={link.href} className={`nav-link ${active ? "active" : ""}`}>
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px]">
            <label htmlFor="systemTheme" className="mb-1 block text-sm">
              ธีมระบบ
            </label>
            <select
              id="systemTheme"
              value={theme}
              onChange={(event) => onThemeChange(event.target.value as AppThemeKey)}
            >
              {APP_THEME_PRESETS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="mx-1 mt-1 text-xs text-[var(--muted)]">
              {selectedTheme.description}
            </p>
          </div>
          {user ? (
            <>
              <span className="pill">
                {user.fullName} ({user.role})
              </span>
              <button className="secondary" type="button" onClick={logout}>
                ออกจากระบบ
              </button>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
