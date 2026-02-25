import type { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditContext = {
  userId?: string | null;
  username?: string | null;
  role?: UserRole | null;
};

export async function writeAuditLog(
  params: {
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
    actor?: AuditContext | null;
  },
  tx?: Prisma.TransactionClient | PrismaClient
) {
  const client = tx ?? prisma;

  await client.auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      actorUserId: params.actor?.userId ?? null,
      actorUsername: params.actor?.username ?? null,
      actorRole: params.actor?.role ?? null,
      metadata: params.metadata
    }
  });
}
