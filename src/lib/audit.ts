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
  const data: Prisma.AuditLogCreateInput = {
    action: params.action,
    entity: params.entity,
    entityId: params.entityId ?? null,
    actorUsername: params.actor?.username ?? null,
    actorRole: params.actor?.role ?? null,
    metadata: params.metadata
  };
  const actorUserId = params.actor?.userId ?? null;

  if (actorUserId) {
    data.actor = {
      connect: {
        id: actorUserId
      }
    };
  }

  try {
    await client.auditLog.create({ data });
  } catch (error) {
    const isForeignKeyError =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2003";

    // After switching databases, stale sessions may reference old user IDs.
    // Retry without actor relation so business operations don't fail.
    if (actorUserId && isForeignKeyError) {
      await client.auditLog.create({
        data: {
          action: params.action,
          entity: params.entity,
          entityId: params.entityId ?? null,
          actorUserId: null,
          actorUsername: params.actor?.username ?? null,
          actorRole: params.actor?.role ?? null,
          metadata: params.metadata
        }
      });
      return;
    }

    throw error;
  }
}
