import { ManageBreadcrumbs } from "@/components/manage-breadcrumbs";

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ManageBreadcrumbs />
      {children}
    </div>
  );
}
