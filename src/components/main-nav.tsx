"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type UserRole = "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN";

type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
  icon: React.ReactNode;
};

/* ───────── inline SVG icons (18 × 18, stroke style) ───────── */
const IconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconReceipt = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconKitchen = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="6" y1="1" x2="6" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="10" y1="1" x2="10" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="14" y1="1" x2="14" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="2" y1="20" x2="22" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const navItems: NavItem[] = [
  { href: "/", label: "หน้าหลัก", roles: ["CASHIER", "KITCHEN", "MANAGER", "ADMIN"], icon: <IconHome /> },
  { href: "/create-order", label: "รับออเดอร์", roles: ["CASHIER", "MANAGER", "ADMIN"], icon: <IconCart /> },
  { href: "/receipts", label: "ใบเสร็จ", roles: ["CASHIER", "MANAGER", "ADMIN"], icon: <IconReceipt /> },
  { href: "/kitchen", label: "ครัว", roles: ["KITCHEN", "MANAGER", "ADMIN"], icon: <IconKitchen /> },
  { href: "/summary", label: "สรุป", roles: ["MANAGER", "ADMIN"], icon: <IconChart /> },
  { href: "/manage", label: "จัดการ", roles: ["MANAGER", "ADMIN"], icon: <IconSettings /> },
];

const roleLabelMap: Record<UserRole, string> = {
  CASHIER: "แคชเชียร์",
  KITCHEN: "ครัว",
  MANAGER: "ผู้จัดการ",
  ADMIN: "แอดมิน",
};

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((item) => item[0]?.toUpperCase() || "")
      .join("") || "U"
  );
}

export function MainNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<null | { fullName: string; role: UserRole }>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

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
            setUser({ fullName: payload.fullName, role: payload.role });
          } else {
            setUser(null);
          }
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthLoaded(true);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadBrandColors = async () => {
      try {
        const response = await fetch("/api/brand-theme", { cache: "force-cache" });
        const payload = (await response.json()) as { brandPrimary?: string; brandAccent?: string };
        if (!cancelled && payload.brandPrimary && payload.brandAccent) {
          applyBrandColors(payload.brandPrimary, payload.brandAccent);
        }
      } catch {
        // keep default colors
      }
    };
    void loadBrandColors();
    return () => { cancelled = true; };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/auth/login";
  }

  const visibleLinks = user ? navItems.filter((item) => item.roles.includes(user.role)) : [];
  const hideNav = pathname === "/create-order" || pathname.startsWith("/create-order/");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  const prevPath = useState(pathname)[0];
  if (prevPath !== pathname && mobileOpen) setMobileOpen(false);

  if (hideNav) return null;

  return (
    <>
      {/* Scoped focus-ring + drawer animation styles */}
      <style>{`
        .mainnav-link:focus-visible {
          outline: 2px solid var(--brand);
          outline-offset: -2px;
          border-radius: 6px;
        }
        .mainnav-logout:focus-visible {
          outline: 2px solid var(--brand);
          outline-offset: 2px;
          border-radius: 9px;
        }
        @keyframes _navFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes _navSlide { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>

      <nav
        aria-label="การนำทางหลัก"
        style={{
          background: "var(--topnav-shell-bg)",
          borderBottom: "1px solid var(--topnav-shell-border)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1500,
            margin: "0 auto",
            padding: "0 16px",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "space-between",
            height: 56,
          }}
          className="md:h-16 md:px-5"
        >
          {/* ── Left: Logo + nav links (desktop) ── */}
          <div style={{ display: "flex", alignItems: "stretch" }}>

            {/* Logo */}
            <Link
              href="/"
              aria-label="POS — กลับหน้าหลัก"
              className="mainnav-link"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                paddingRight: 16,
                marginRight: 4,
                textDecoration: "none",
                flexShrink: 0,
                borderRight: "1px solid var(--topnav-shell-border)",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "var(--brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(212,43,43,0.28)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9C7 6 11 6 15 9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M7 14C11 11 15 11 19 14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M11 19C13 17.5 15 17.5 17 19" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7" />
                </svg>
              </div>
              <span
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#1a1614",
                  letterSpacing: "-0.02em",
                  userSelect: "none",
                }}
              >
                POS
              </span>
            </Link>

            {/* Nav links — desktop only (md+) */}
            <div
              role="list"
              className="hidden md:flex"
              style={{
                alignItems: "stretch",
                paddingLeft: 8,
                gap: 2,
              }}
            >
              {authLoaded && user ? (
                visibleLinks.map((link) => {
                  const active =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="listitem"
                      aria-current={active ? "page" : undefined}
                      className="mainnav-link"
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "0 13px",
                        fontSize: "0.875rem",
                        fontWeight: active ? 600 : 400,
                        whiteSpace: "nowrap",
                        color: active ? "var(--topnav-link-active-text)" : "var(--topnav-link-text)",
                        textDecoration: "none",
                        background: active ? "var(--topnav-link-active-bg)" : "transparent",
                        borderRadius: active ? "6px 6px 0 0" : 6,
                        borderBottom: active ? "2.5px solid var(--brand)" : "2.5px solid transparent",
                        transition: "color 150ms ease, background 150ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          const el = e.currentTarget as HTMLElement;
                          el.style.background = "var(--topnav-link-hover-bg)";
                          el.style.color = "var(--topnav-link-hover-text)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          const el = e.currentTarget as HTMLElement;
                          el.style.background = "transparent";
                          el.style.color = "var(--topnav-link-text)";
                        }
                      }}
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  );
                })
              ) : authLoaded ? (
                <Link
                  href="/auth/login"
                  className="mainnav-link"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0 14px",
                    fontSize: "0.875rem",
                    fontWeight: 400,
                    color: "var(--topnav-link-text)",
                    textDecoration: "none",
                  }}
                >
                  เข้าสู่ระบบ
                </Link>
              ) : null}
            </div>
          </div>

          {/* ── Right ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

            {/* Desktop: full user chip + logout */}
            {user && (
              <div className="hidden md:flex" style={{ alignItems: "center", gap: 10 }}>
                {/* User chip */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "5px 12px 5px 5px",
                    borderRadius: 40,
                    background: "var(--topnav-chip-bg)",
                    border: "1px solid var(--topnav-chip-border)",
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--topnav-avatar-from), var(--topnav-avatar-to))",
                      color: "var(--topnav-avatar-text)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      flexShrink: 0,
                      userSelect: "none",
                    }}
                  >
                    {initials(user.fullName)}
                  </div>
                  <div style={{ lineHeight: 1.25 }}>
                    <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#1a1614", whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.fullName}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {roleLabelMap[user.role]}
                    </p>
                  </div>
                </div>
                {/* Logout */}
                <button
                  type="button"
                  onClick={logout}
                  aria-label="ออกจากระบบ"
                  title="ออกจากระบบ"
                  className="mainnav-logout"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "transparent",
                    border: "1px solid var(--topnav-logout-border)",
                    color: "#9a9490",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all 150ms ease",
                    boxShadow: "none",
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "#fff0f0";
                    el.style.borderColor = "rgba(212,43,43,0.3)";
                    el.style.color = "var(--brand)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "transparent";
                    el.style.borderColor = "var(--topnav-logout-border)";
                    el.style.color = "#9a9490";
                  }}
                >
                  <IconLogout />
                </button>
              </div>
            )}

            {/* Mobile: avatar circle (compact) + hamburger */}
            <div className="flex md:hidden" style={{ alignItems: "center", gap: 6 }}>
              {user && (
                <div
                  aria-hidden="true"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--topnav-avatar-from), var(--topnav-avatar-to))",
                    color: "var(--topnav-avatar-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    flexShrink: 0,
                    userSelect: "none",
                  }}
                >
                  {initials(user.fullName)}
                </div>
              )}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="เปิดเมนู"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "1px solid var(--topnav-shell-border)",
                  cursor: "pointer",
                  padding: 0,
                  boxShadow: "none",
                  color: "var(--text)",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div
          className="md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="เมนูนำทาง"
          onClick={(e) => { if (e.target === e.currentTarget) setMobileOpen(false); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            justifyContent: "flex-end",
            animation: "_navFade 160ms ease both",
          }}
        >
          {/* Slide-in panel from right */}
          <div
            style={{
              width: "min(320px, 88vw)",
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              boxShadow: "-6px 0 28px rgba(0,0,0,0.14)",
              animation: "_navSlide 240ms cubic-bezier(0.32,0.72,0,1) both",
            }}
          >
            {/* Drawer header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 16px 14px",
              borderBottom: "1px solid var(--line)",
              background: "var(--bg)",
              flexShrink: 0,
            }}>
              {user ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--topnav-avatar-from), var(--topnav-avatar-to))",
                    color: "var(--topnav-avatar-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {initials(user.fullName)}
                  </div>
                  <div style={{ lineHeight: 1.3 }}>
                    <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}>{user.fullName}</p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>{roleLabelMap[user.role]}</p>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}>เมนู</p>
              )}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="ปิดเมนู"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  boxShadow: "none",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#1a1614" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>

            {/* Nav links list */}
            <nav style={{ flex: 1, padding: "10px 8px" }}>
              {authLoaded && user ? (
                visibleLinks.map((link) => {
                  const active =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? "page" : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 10,
                        fontSize: "0.9rem",
                        fontWeight: active ? 700 : 400,
                        color: active ? "var(--brand)" : "var(--text)",
                        background: active ? "var(--brand-light)" : "transparent",
                        textDecoration: "none",
                        marginBottom: 2,
                        borderLeft: active ? "3px solid var(--brand)" : "3px solid transparent",
                      }}
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  );
                })
              ) : authLoaded ? (
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  style={{ display: "flex", alignItems: "center", padding: "12px 14px", fontSize: "0.9rem", color: "var(--text)", textDecoration: "none", borderRadius: 10 }}
                >
                  เข้าสู่ระบบ
                </Link>
              ) : null}
            </nav>

            {/* Logout at bottom */}
            {user && (
              <div style={{ padding: "10px 8px 20px", borderTop: "1px solid var(--line)", flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={logout}
                  style={{
                    width: "100%",
                    height: 44,
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    background: "#fff",
                    color: "#dc2626",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: "none",
                    padding: 0,
                  }}
                >
                  <IconLogout />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
