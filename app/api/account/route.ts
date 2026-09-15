import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import {
  betaFeedback,
  bodyWeightEntries,
  formApiTokens,
  membershipInterests,
  productEvents,
  scanRecords,
  userProfiles,
  weeklyReviews,
  workoutPlans,
  workouts,
  workoutSets,
} from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

/**
 * Account data is intentionally available only through an interactive ChatGPT
 * sign-in. A long-lived MCP token can read or write training data, but cannot
 * export or irreversibly erase an account.
 */
export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const db = getDb();
  const email = user.email.toLowerCase();
  const userWorkouts = await db.select().from(workouts).where(eq(workouts.userEmail, email));
  const workoutIds = userWorkouts.map(workout => workout.id);
  const [profile, plans, sets, scans, membership, feedback] = await Promise.all([
    db.select().from(userProfiles).where(eq(userProfiles.userEmail, email)),
    db.select().from(workoutPlans).where(eq(workoutPlans.userEmail, email)),
    workoutIds.length ? db.select().from(workoutSets).where(inArray(workoutSets.workoutId, workoutIds)) : Promise.resolve([]),
    db.select().from(scanRecords).where(eq(scanRecords.userId, user.id)),
    db.select().from(membershipInterests).where(eq(membershipInterests.userId, user.id)),
    db.select().from(betaFeedback).where(eq(betaFeedback.reporterId, user.id)),
  ]);
  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    account: { email, displayName: user.displayName },
    profile: profile[0] || null,
    workoutPlans: plans,
    workouts: userWorkouts,
    workoutSets: sets,
    scanRecords: scans,
    membershipInterest: membership[0] || null,
    betaFeedback: feedback,
    note: "Original photos and videos are processed on-device and are never included because Form does not upload them.",
  }, {
    headers: { "content-disposition": 'attachment; filename="form-account-data.json"' },
  });
}

export async function DELETE() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const db = getDb();
  const email = user.email.toLowerCase();
  const userWorkouts = await db.select({ id: workouts.id }).from(workouts).where(eq(workouts.userEmail, email));
  const workoutIds = userWorkouts.map(workout => workout.id);
  if (workoutIds.length) await db.delete(workoutSets).where(inArray(workoutSets.workoutId, workoutIds));
  await db.delete(workouts).where(eq(workouts.userEmail, email));
  await db.delete(weeklyReviews).where(eq(weeklyReviews.userEmail, email));
  await db.delete(bodyWeightEntries).where(eq(bodyWeightEntries.userEmail, email));
  await db.delete(workoutPlans).where(eq(workoutPlans.userEmail, email));
  await db.delete(userProfiles).where(eq(userProfiles.userEmail, email));
  await db.delete(formApiTokens).where(eq(formApiTokens.userEmail, email));
  await db.delete(scanRecords).where(eq(scanRecords.userId, user.id));
  await db.delete(membershipInterests).where(eq(membershipInterests.userId, user.id));
  await db.delete(betaFeedback).where(eq(betaFeedback.reporterId, user.id));
  await db.delete(productEvents).where(and(eq(productEvents.userId, user.id)));
  return NextResponse.json({ deleted: true });
}
