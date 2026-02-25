import { PrintJobStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_STATUS: PrintJobStatus[] = ["PENDING", "PRINTED", "FAILED"];

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await context.params;
  let actor:
    | {
        userId?: string;
        username?: string;
        role?: "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN";
      }
    | null = null;

  const configuredPrinterToken = process.env.PRINTER_AGENT_TOKEN;
  const printerToken = request.headers.get("x-printer-token");
  const isPrinterAgent = Boolean(configuredPrinterToken) && printerToken === configuredPrinterToken;

  if (!isPrinterAgent) {
    const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
    if (auth.response) return auth.response;
    actor = {
      userId: auth.session?.userId,
      username: auth.session?.username,
      role: auth.session?.role
    };
  }

  try {
    const body = (await request.json()) as {
      status?: PrintJobStatus;
      errorMessage?: string;
    };

    if (!body.status || !VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated = await prisma.printJob.update({
      where: { id },
      data: {
        status: body.status,
        errorMessage: body.errorMessage?.trim() || null
      }
    });

    await writeAuditLog({
      action: "PRINT_JOB_STATUS_UPDATED",
      entity: "PrintJob",
      entityId: updated.id,
      actor: actor ?? { username: "printer-agent" },
      metadata: {
        status: updated.status,
        errorMessage: updated.errorMessage
      }
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Cannot update print job" }, { status: 400 });
  }
}
