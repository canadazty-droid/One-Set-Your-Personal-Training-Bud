import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { userIdentities, users, userSessions } from "../../../../db/schema";
import { hashFormToken } from "../../../../lib/form/auth";

export const dynamic = "force-dynamic";

type CodeSessionResponse = { openid?: string; unionid?: string; errcode?: number; errmsg?: string };

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `oneset_mp_${Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("")}`;
}

export async function POST(request: Request) {
  let body: { code?: string; devUser?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  let openid = "";
  let unionid: string | undefined;
  if (process.env.WECHAT_APPID && process.env.WECHAT_APP_SECRET && body.code) {
    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
    url.searchParams.set("appid", process.env.WECHAT_APPID);
    url.searchParams.set("secret", process.env.WECHAT_APP_SECRET);
    url.searchParams.set("js_code", body.code);
    url.searchParams.set("grant_type", "authorization_code");
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    const result = await response.json() as CodeSessionResponse;
    if (!response.ok || !result.openid) return NextResponse.json({ error: result.errmsg || "WeChat login failed" }, { status: 401 });
    openid = result.openid;
    unionid = result.unionid;
  } else if ((process.env.FORM_DEV_AUTH === "1" || process.env.NODE_ENV === "development") && body.devUser) {
    openid = `dev_${body.devUser.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64)}`;
  } else {
    return NextResponse.json({ error: "WeChat login is not configured" }, { status: 503 });
  }

  const db = getDb();
  const identity = await db.select().from(userIdentities).where(and(eq(userIdentities.provider, "wechat"), eq(userIdentities.providerUserId, openid))).limit(1);
  const now = Date.now();
  let userId = identity[0]?.userId;
  let email = "";
  if (!userId) {
    userId = crypto.randomUUID();
    email = `wechat_${userId}@identity.oneset.app`;
    await db.insert(users).values({ id: userId, email, displayName: "ONE SET 用户", createdAt: now, updatedAt: now });
    await db.insert(userIdentities).values({ id: crypto.randomUUID(), userId, provider: "wechat", providerUserId: openid, providerUnionId: unionid || null, createdAt: now, updatedAt: now });
  } else {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    email = user[0]?.email || `wechat_${userId}@identity.oneset.app`;
  }

  const token = randomToken();
  await db.insert(userSessions).values({ id: crypto.randomUUID(), userId, tokenHash: await hashFormToken(token), createdAt: now, expiresAt: now + 30 * 24 * 60 * 60 * 1000, lastUsedAt: now });
  return NextResponse.json({ token, user: { id: userId, displayName: "ONE SET 用户" }, expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString() });
}
