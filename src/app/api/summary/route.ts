import { NextResponse } from "next/server";
import { calculateSummary } from "@/lib/summary";
import { requireApiRole } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = requireApiRole(request, ["MANAGER", "ADMIN"]);
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const summary = await calculateSummary(from, to);
  return NextResponse.json(summary);
}
