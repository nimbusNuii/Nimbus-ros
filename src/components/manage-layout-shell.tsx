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
    <div className="space-y-3 xl:grid xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-4 xl:space-y-0">
      <div className="hidden xl:block">
        <ManageSideNav />
      </div>

      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <ManageBreadcrumbs className="mb-0 flex-1" />
          <button
            type="button"
            className="secondary shrink-0 xl:hidden"
            onClick={() => setOpenMobileNav(true)}
          >
            เมนูจัดการ
          </button>
        </div>
        {children}
      </div>

      {openMobileNav ? (
        <div
          className="modal-overlay xl:hidden"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpenMobileNav(false);
          }}
        >
          <div className="modal-panel" style={{ width: "min(420px, 100%)" }}>
            <div className="modal-header">
              <h3 className="m-0 text-lg font-semibold">เมนูจัดการ</h3>
              <button type="button" className="secondary" onClick={() => setOpenMobileNav(false)}>
                ปิด
              </button>
            </div>
            <ManageSideNav onNavigate={() => setOpenMobileNav(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
