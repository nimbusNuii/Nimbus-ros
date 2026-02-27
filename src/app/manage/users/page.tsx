import { requirePageRole } from "@/lib/auth";
import { UserManager } from "@/components/user-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

function parsePage(value?: string) {
  const num = Number(value || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.trunc(num));
}

export default async function ManageUsersPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requirePageRole(["MANAGER", "ADMIN"]);
  const params = await searchParams;
  const requestedPage = parsePage(params.page);
  const totalItems = await prisma.appUser.count();
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const users = await prisma.appUser.findMany({
    orderBy: [{ role: "asc" }, { username: "asc" }],
    skip,
    take: PAGE_SIZE
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
        currentPage={page}
        pageSize={PAGE_SIZE}
        totalItems={totalItems}
      />
    </div>
  );
}
