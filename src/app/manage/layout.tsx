import { ManageBreadcrumbs } from "@/components/manage-breadcrumbs";
import { ManageSideNav } from "@/components/manage-side-nav";

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <ManageSideNav />
      <div className="min-w-0">
        <ManageBreadcrumbs />
        {children}
      </div>
    </div>
  );
}
