import { requirePageRole } from "@/lib/auth";
import { UserManager } from "@/components/user-manager";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

function parsePage(value?: string) {
  const num = Number(value || "1");
  if (!Number.isFinite(num)) return 1;
  return Math.max(1, Math.trunc(num));
}

type UserSort = "role_username" | "username_asc" | "username_desc" | "created_desc" | "created_asc";

function parseSort(value?: string): UserSort {
  const allowed: UserSort[] = ["role_username", "username_asc", "username_desc", "created_desc", "created_asc"];
  if (value && allowed.includes(value as UserSort)) {
    return value as UserSort;
  }
  return "role_username";
}

function orderByFromSort(sort: UserSort): Prisma.AppUserOrderByWithRelationInput[] {
  if (sort === "username_asc") return [{ username: "asc" }];
  if (sort === "username_desc") return [{ username: "desc" }];
  if (sort === "created_desc") return [{ createdAt: "desc" }];
  if (sort === "created_asc") return [{ createdAt: "asc" }];
  return [{ role: "asc" }, { username: "asc" }];
}

export default async function ManageUsersPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
  const session = await requirePageRole(["MANAGER", "ADMIN"]);
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 120);
  const sort = parseSort(params.sort);
  const where: Prisma.AppUserWhereInput | undefined = q
    ? {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { fullName: { contains: q, mode: "insensitive" } }
        ]
      }
    : undefined;
  const orderBy = orderByFromSort(sort);
  const requestedPage = parsePage(params.page);
  const totalItems = await prisma.appUser.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const users = await prisma.appUser.findMany({
    where,
    orderBy,
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
        initialQuery={q}
        initialSort={sort}
      />
    </div>
  );
}
