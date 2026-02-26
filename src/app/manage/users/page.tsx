import { requirePageRole } from "@/lib/auth";
import { UserManager } from "@/components/user-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ManageUsersPage() {
  const session = await requirePageRole(["MANAGER", "ADMIN"]);

  const users = await prisma.appUser.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }]
  });

  return (
    <div>
      <UserManager
        initialUsers={users.map((user) => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive
        }))}
        isAdmin={session.role === "ADMIN"}
      />
    </div>
  );
}
