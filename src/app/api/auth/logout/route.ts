import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const session = getSessionFromRequest(request);
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);

  if (session) {
    await writeAuditLog({
      action: "LOGOUT",
      entity: "Auth",
      actor: {
        userId: session.userId,
        username: session.username,
        role: session.role
      }
    });
  }

  return response;
}
