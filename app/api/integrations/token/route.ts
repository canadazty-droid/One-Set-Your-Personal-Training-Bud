import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { formApiTokens } from "../../../../db/schema";
import { hashFormToken } from "../../../../lib/form/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const rows = await getDb().select({ hint: formApiTokens.tokenHint, createdAt: formApiTokens.createdAt, lastUsedAt: formApiTokens.lastUsedAt })
    .from(formApiTokens)
    .where(and(eq(formApiTokens.userEmail, user.email.toLowerCase()), isNull(formApiTokens.revokedAt)))
    .orderBy(desc(formApiTokens.createdAt)).limit(1);
  return NextResponse.json({ connection: rows[0] ? { connected: true, hint: rows[0].hint, createdAt: new Date(rows[0].createdAt).toISOString(), lastUsedAt: rows[0].lastUsedAt ? new Date(rows[0].lastUsedAt).toISOString() : null } : { connected: false } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const db = getDb();
  const email = user.email.toLowerCase();
  const token = `form_live_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = await hashFormToken(token);
  const now = Date.now();
  await db.update(formApiTokens).set({ revokedAt: now }).where(and(eq(formApiTokens.userEmail, email), isNull(formApiTokens.revokedAt)));
  await db.insert(formApiTokens).values({ id: crypto.randomUUID(), userEmail: email, tokenHash, tokenHint: token.slice(-6), createdAt: now });
  return NextResponse.json({ token, hint: token.slice(-6), apiUrl: new URL(request.url).origin, message: "Copy this token now. It will not be shown again." }, { status: 201 });
}

export async function DELETE() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  await getDb().update(formApiTokens).set({ revokedAt: Date.now() }).where(and(eq(formApiTokens.userEmail, user.email.toLowerCase()), isNull(formApiTokens.revokedAt)));
  return NextResponse.json({ revoked: true });
}
