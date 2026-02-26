import crypto from "node:crypto";
import type { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "pos_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const SESSION_SECRET =
  process.env.POS_SESSION_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "dev-pos-secret-change-me");

if (!SESSION_SECRET) {
  throw new Error("Missing POS_SESSION_SECRET in production");
}

export type SessionPayload = {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  exp: number;
};

export function hashPin(pin: string) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const data: SessionPayload = {
    ...payload,
    exp
  };

  const encoded = base64UrlEncode(JSON.stringify(data));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) return {} as Record<string, string>;

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, pair) => {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
}

export function parseSessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;

  try {
    const data = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (data.exp < now) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getServerSession() {
  const cookieStore = await cookies();
  return parseSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function getSessionFromRequest(request: Request) {
  const cookiesMap = parseCookieHeader(request.headers.get("cookie"));
  return parseSessionToken(cookiesMap[SESSION_COOKIE_NAME]);
}

export async function requirePageRole(roles: UserRole[]) {
  const session = await getServerSession();

  if (!session) {
    redirect("/auth/login");
  }

  if (!roles.includes(session.role)) {
    redirect("/auth/denied");
  }

  return session;
}

export function requireApiRole(request: Request, roles: UserRole[]) {
  const session = getSessionFromRequest(request);

  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  if (!roles.includes(session.role)) {
    return {
      session: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    };
  }

  return {
    session,
    response: null
  };
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export function roleRedirectPath(role: UserRole) {
  if (role === "KITCHEN") return "/kitchen";
  if (role === "MANAGER" || role === "ADMIN") return "/manage";
  return "/pos";
}
