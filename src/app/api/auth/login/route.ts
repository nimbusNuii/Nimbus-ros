import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, hashPin, roleRedirectPath, setSessionCookie } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; pin?: string };
    const username = body.username?.trim().toLowerCase();
    const pin = body.pin?.trim();

    if (!username || !pin) {
      return NextResponse.json({ error: "username and pin required" }, { status: 400 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
    const limiter = checkRateLimit(`login:${ip}:${username}`, 60_000, 10);
    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts, please try again later" },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSec)
          }
        }
      );
    }

    const user = await prisma.appUser.findUnique({
      where: { username }
    });

    if (!user || !user.isActive || user.pinHash !== hashPin(pin)) {
      await writeAuditLog({
        action: "LOGIN_FAILED",
        entity: "Auth",
        actor: {
          username: username ?? null
        },
        metadata: {
          username
        }
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = createSessionToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      },
      redirectTo: roleRedirectPath(user.role)
    });

    setSessionCookie(response, token);

    await writeAuditLog({
      action: "LOGIN_SUCCESS",
      entity: "Auth",
      actor: {
        userId: user.id,
        username: user.username,
        role: user.role
      },
      metadata: {
        redirectTo: roleRedirectPath(user.role)
      }
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 400 });
  }
}
