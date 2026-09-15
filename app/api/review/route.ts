import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { getFormUser } from "../../../lib/form/auth";
import { createOrGetWeeklyReview } from "../../../lib/form/fitness-os";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const weekEnd = new URL(request.url).searchParams.get("weekEnd") || undefined;
    const review = await createOrGetWeeklyReview(getDb(), user.email, weekEnd);
    return NextResponse.json({ review });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Review generation failed" }, { status: 400 });
  }
}
