import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, apiKeys } from "@agora/db";
import { eq, and, isNull } from "drizzle-orm";
import crypto from "crypto";

function generateApiKey(): string {
  return "ak_" + crypto.randomBytes(24).toString("hex");
}

export async function GET() {
  const session = await auth();
  if (!(session as any)?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const keys = await db
    .select({
      key: apiKeys.key,
      name: apiKeys.name,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      requestCount: apiKeys.requestCount,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, (session as any).userId));
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!(session as any)?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const key = generateApiKey();
  await db.insert(apiKeys).values({
    key,
    userId: (session as any).userId,
    name: name.trim(),
    tier: (session as any).tier ?? "free",
  });
  return NextResponse.json({ key, name: name.trim() });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!(session as any)?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { key } = await req.json();
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.key, key), eq(apiKeys.userId, (session as any).userId), isNull(apiKeys.revokedAt)));
  return NextResponse.json({ success: true });
}
