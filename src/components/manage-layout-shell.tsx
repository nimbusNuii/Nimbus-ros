"use client";

import { useState } from "react";
import { ManageBreadcrumbs } from "@/components/manage-breadcrumbs";
import { ManageSideNav } from "@/components/manage-side-nav";

type ManageLayoutShellProps = {
  children: React.ReactNode;
};

export function ManageLayoutShell({ children }: ManageLayoutShellProps) {
  const [openMobileNav, setOpenMobileNav] = useState(false);

  return (
    <div className="space-y-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 lg:space-y-0">
      {/* Sidebar — desktop only */}
      <div className="hidden lg:block">
        <ManageSideNav />
      </div>

      {/* Main content */}
      <div className="min-w-0">
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 18 }}>
          <ManageBreadcrumbs className="mb-0 flex-1" />
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setOpenMobileNav(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              height: 36, padding: "0 14px", borderRadius: 9,
              border: "1px solid var(--line)", background: "#fff",
              fontSize: "0.82rem", fontWeight: 600, color: "var(--text)",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            เมนู
          </button>
        </div>
        {children}
      </div>

      {/* Mobile drawer */}
      {openMobileNav && (
        <>
          <style>{`
            @keyframes _drawerFade { from { opacity: 0 } to { opacity: 1 } }
            @keyframes _drawerSlide { from { transform: translateX(-100%) } to { transform: translateX(0) } }
          `}</style>
          <div
            className="lg:hidden"
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              background: "rgba(0,0,0,0.45)",
              display: "flex", alignItems: "stretch",
              animation: "_drawerFade 180ms ease both",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setOpenMobileNav(false); }}
          >
            {/* Slide-in panel from left */}
            <div style={{
              width: "min(300px, 85vw)", background: "#fff",
              display: "flex", flexDirection: "column", overflowY: "auto",
              boxShadow: "6px 0 28px rgba(0,0,0,0.14)",
              animation: "_drawerSlide 240ms cubic-bezier(0.32, 0.72, 0, 1) both",
            }}>
              {/* Drawer header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 14px 12px", borderBottom: "1px solid var(--line)",
                background: "var(--bg)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: "var(--brand)", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 6h16M4 12h16M4 18h10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}>เมนูจัดการ</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenMobileNav(false)}
                  aria-label="ปิด"
                  style={{
                    width: 32, height: 32, padding: 0, flexShrink: 0,
                    borderRadius: 8, border: "1px solid var(--line)",
                    background: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "none", color: "var(--text)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" stroke="#1a1614" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {/* Nav */}
              <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
                <ManageSideNav onNavigate={() => setOpenMobileNav(false)} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

