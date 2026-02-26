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
      <h1 className="page-title">จัดการตัวเลือกเมนู</h1>
      <p className="page-subtitle">เพิ่ม/ลดตัวเลือกปรับแต่ง เช่น ระดับเผ็ด เพิ่มพิเศษ และไม่ใส่วัตถุดิบ</p>
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
