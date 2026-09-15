import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { getFormUser } from "../../../lib/form/auth";
import { getPersonalRecords } from "../../../lib/form/workouts";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getFormUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const records = await getPersonalRecords(getDb(), user.email);
  return NextResponse.json({ records });
}
