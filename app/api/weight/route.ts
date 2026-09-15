import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { getFormUser } from "../../../lib/form/auth";
import { getBodyWeightTrend, recordBodyWeight } from "../../../lib/form/weight";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const days = Number(new URL(request.url).searchParams.get("days")) || 90;
  return NextResponse.json(await getBodyWeightTrend(getDb(), user.email, days));
}

export async function POST(request: Request) {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const entry = await recordBodyWeight(getDb(), user.email, body.weight_kg ?? body.weightKg, typeof body.date === "string" ? body.date : undefined);
    const trend = await getBodyWeightTrend(getDb(), user.email);
    return NextResponse.json({ entry, trend }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record weight" }, { status: 400 });
  }
}
