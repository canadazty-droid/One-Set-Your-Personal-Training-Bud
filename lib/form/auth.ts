import { headers } from "next/headers";
import { getChatGPTUser, type ChatGPTUser } from "../../app/chatgpt-auth";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { formApiTokens, users, userSessions } from "../../db/schema";

export async function hashFormToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function getFormUser(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  if (user) return user;

  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");
  if (authorization?.startsWith("Bearer oneset_mp_")) {
    const tokenHash = await hashFormToken(authorization.slice(7));
    const db = getDb();
    const rows = await db.select({ sessionId: userSessions.id, userId: users.id, email: users.email, displayName: users.displayName })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(and(eq(userSessions.tokenHash, tokenHash), gt(userSessions.expiresAt, Date.now())))
      .limit(1);
    if (rows.length) {
      await db.update(userSessions).set({ lastUsedAt: Date.now() }).where(eq(userSessions.id, rows[0].sessionId));
      return { id: rows[0].userId, email: rows[0].email, displayName: rows[0].displayName || "ONE SET 用户", fullName: null };
    }
  }
  if (authorization?.startsWith("Bearer form_live_")) {
    const tokenHash = await hashFormToken(authorization.slice(7));
    const db = getDb();
    const rows = await db.select().from(formApiTokens)
      .where(and(eq(formApiTokens.tokenHash, tokenHash), isNull(formApiTokens.revokedAt)))
      .limit(1);
    if (rows.length) {
      await db.update(formApiTokens).set({ lastUsedAt: Date.now() }).where(eq(formApiTokens.id, rows[0].id));
      return { id: rows[0].id, email: rows[0].userEmail, displayName: rows[0].userEmail.split("@")[0], fullName: null };
    }
  }
  const devEmail = requestHeaders.get("x-form-dev-user");
  if (devEmail && devEmail.includes("@") && (process.env.FORM_DEV_AUTH === "1" || process.env.NODE_ENV === "development")) {
    return {
      id: devEmail.toLowerCase(),
      email: devEmail.toLowerCase(),
      displayName: devEmail.split("@")[0],
      fullName: null,
    };
  }
  return null;
}

export async function requireFormUser() {
  const user = await getFormUser();
  if (!user) throw new Error("Authentication required");
  return user;
}
