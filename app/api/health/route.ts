import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// Lightweight health check: verifies the DB connection and confirms the
// Anthropic API key is present (does NOT call Anthropic).
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {
    database: { ok: false },
    anthropicApiKey: { ok: false },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (err) {
    checks.database = {
      ok: false,
      detail: err instanceof Error ? err.message : "unknown DB error",
    };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key.length > 0) {
    checks.anthropicApiKey = { ok: true };
  } else {
    checks.anthropicApiKey = {
      ok: false,
      detail: "ANTHROPIC_API_KEY is not set.",
    };
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok, checks, timestamp: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
