import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TransactionRunOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

const DEFAULT_TRANSACTION_OPTIONS: TransactionRunOptions = {
  maxWait: 10_000,
  timeout: 30_000
};

export function runTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionRunOptions
) {
  return prisma.$transaction(fn, {
    ...DEFAULT_TRANSACTION_OPTIONS,
    ...(options || {})
  });
}
