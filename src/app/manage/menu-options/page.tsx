import { MenuOptionManager } from "@/components/menu-option-manager";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManageMenuOptionsPage() {
  await requirePageRole(["MANAGER", "ADMIN"]);

  const options = await prisma.menuOption.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
  });

  return (
    <div>
      <MenuOptionManager
        initialOptions={options.map((item) => ({
          id: item.id,
          type: item.type,
          label: item.label,
          sortOrder: item.sortOrder,
          isActive: item.isActive
        }))}
      />
    </div>
  );
}
