import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import type { AdvancedTrainingProfile, Equipment, Level, TrainingGoal, UserProfile } from "./types";

type Db = DrizzleD1Database<typeof schema>;
type ProfileInput = Omit<Partial<UserProfile>, "advancedProfile"> & { advancedProfile?: unknown };

const goals = new Set<TrainingGoal>(["strength", "muscle", "fatloss", "general"]);
const equipmentSet = new Set<Equipment>(["gym", "dumbbell", "bodyweight"]);
const levels = new Set<Level>(["beginner", "intermediate", "advanced"]);
const experiences = new Set<AdvancedTrainingProfile["experience"]>(["new", "some", "regular", "advanced"]);
const recoveries = new Set<AdvancedTrainingProfile["recovery"]>(["low", "normal", "high"]);
const painAreas = new Set<AdvancedTrainingProfile["painAreas"][number]>(["knees", "shoulders", "back", "hips"]);
const defaultAdvancedProfile: AdvancedTrainingProfile = { experience: "new", weeklyDays: 3, recovery: "normal", painAreas: [], heightCm: "", weightKg: "" };

function cleanBodyMetric(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^\d{1,3}(\.\d{1,2})?$/.test(trimmed) ? trimmed : "";
}

export function parseAdvancedProfile(value: unknown): AdvancedTrainingProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...defaultAdvancedProfile };
  const profile = value as Record<string, unknown>;
  const rawPainAreas = Array.isArray(profile.painAreas) ? profile.painAreas : [];
  return {
    experience: typeof profile.experience === "string" && experiences.has(profile.experience as AdvancedTrainingProfile["experience"]) ? profile.experience as AdvancedTrainingProfile["experience"] : defaultAdvancedProfile.experience,
    weeklyDays: typeof profile.weeklyDays === "number" && Number.isFinite(profile.weeklyDays) ? Math.min(7, Math.max(1, Math.round(profile.weeklyDays))) : defaultAdvancedProfile.weeklyDays,
    recovery: typeof profile.recovery === "string" && recoveries.has(profile.recovery as AdvancedTrainingProfile["recovery"]) ? profile.recovery as AdvancedTrainingProfile["recovery"] : defaultAdvancedProfile.recovery,
    painAreas: [...new Set(rawPainAreas.filter((area): area is AdvancedTrainingProfile["painAreas"][number] => typeof area === "string" && painAreas.has(area as AdvancedTrainingProfile["painAreas"][number])))],
    heightCm: cleanBodyMetric(profile.heightCm),
    weightKg: cleanBodyMetric(profile.weightKg),
  };
}

export async function getProfile(db: Db, userEmail: string): Promise<UserProfile> {
  const row = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userEmail, userEmail.toLowerCase())).limit(1);
  if (!row.length) {
    return {
      email: userEmail.toLowerCase(),
      displayName: null,
      trainingGoal: "muscle",
      weeklyDays: 4,
      equipment: "gym",
      level: "intermediate",
      weightUnit: "lb",
      notes: "",
      advancedProfile: { ...defaultAdvancedProfile },
      gender: "unspecified",
      age: null,
      heightCm: null,
      weightKg: null,
      sessionLengthMinutes: 45,
      injuriesOrLimitations: "none",
      preferredTrainingStyle: "balanced",
      updatedAt: new Date().toISOString(),
    };
  }
  const profile = row[0];
  return {
    email: profile.userEmail,
    displayName: profile.displayName,
    trainingGoal: goals.has(profile.trainingGoal as TrainingGoal) ? profile.trainingGoal as TrainingGoal : "muscle",
    weeklyDays: profile.weeklyDays,
    equipment: equipmentSet.has(profile.equipment as Equipment) ? profile.equipment as Equipment : "gym",
    level: levels.has(profile.level as Level) ? profile.level as Level : "intermediate",
    weightUnit: profile.weightUnit === "kg" ? "kg" : "lb",
    notes: profile.notes,
    advancedProfile: (() => { try { return parseAdvancedProfile(profile.advancedProfileJson); } catch { return { ...defaultAdvancedProfile }; } })(),
    gender: profile.gender,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    sessionLengthMinutes: profile.sessionLengthMinutes,
    injuriesOrLimitations: profile.injuriesOrLimitations,
    preferredTrainingStyle: profile.preferredTrainingStyle,
    updatedAt: new Date(profile.updatedAt).toISOString(),
  };
}

export async function upsertProfile(db: Db, userEmail: string, input: ProfileInput) {
  const email = userEmail.toLowerCase();
  const existing = await getProfile(db, email);
  const next: UserProfile = {
    ...existing,
    ...input,
    email,
    displayName: typeof input.displayName === "string" && input.displayName.trim() ? input.displayName.trim().slice(0, 80) : existing.displayName,
    notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 2000) : existing.notes,
    trainingGoal: input.trainingGoal && goals.has(input.trainingGoal) ? input.trainingGoal : existing.trainingGoal,
    equipment: input.equipment && equipmentSet.has(input.equipment) ? input.equipment : existing.equipment,
    level: input.level && levels.has(input.level) ? input.level : existing.level,
    weightUnit: input.weightUnit === "kg" ? "kg" : input.weightUnit === "lb" ? "lb" : existing.weightUnit,
    weeklyDays: typeof input.weeklyDays === "number" ? Math.min(7, Math.max(1, Math.round(input.weeklyDays))) : existing.weeklyDays,
    advancedProfile: input.advancedProfile === undefined ? existing.advancedProfile : parseAdvancedProfile(input.advancedProfile),
    gender: typeof input.gender === "string" && input.gender.trim() ? input.gender.trim().slice(0, 40) : existing.gender,
    age: typeof input.age === "number" ? Math.min(100, Math.max(13, Math.round(input.age))) : existing.age,
    heightCm: typeof input.heightCm === "number" ? Math.min(250, Math.max(100, input.heightCm)) : existing.heightCm,
    weightKg: typeof input.weightKg === "number" ? Math.min(350, Math.max(30, input.weightKg)) : existing.weightKg,
    sessionLengthMinutes: typeof input.sessionLengthMinutes === "number" ? Math.min(120, Math.max(20, Math.round(input.sessionLengthMinutes))) : existing.sessionLengthMinutes,
    injuriesOrLimitations: typeof input.injuriesOrLimitations === "string" ? input.injuriesOrLimitations.trim().slice(0, 500) : existing.injuriesOrLimitations,
    preferredTrainingStyle: typeof input.preferredTrainingStyle === "string" ? input.preferredTrainingStyle.trim().slice(0, 80) : existing.preferredTrainingStyle,
    updatedAt: new Date().toISOString(),
  };
  const updatedAt = Date.now();
  await db.insert(schema.userProfiles).values({
    userEmail: email,
    displayName: next.displayName,
    trainingGoal: next.trainingGoal,
    weeklyDays: next.weeklyDays,
    equipment: next.equipment,
    level: next.level,
    weightUnit: next.weightUnit,
    notes: next.notes.slice(0, 2000),
    advancedProfileJson: JSON.stringify(next.advancedProfile),
    gender: next.gender,
    age: next.age,
    heightCm: next.heightCm,
    weightKg: next.weightKg,
    sessionLengthMinutes: next.sessionLengthMinutes,
    injuriesOrLimitations: next.injuriesOrLimitations,
    preferredTrainingStyle: next.preferredTrainingStyle,
    createdAt: updatedAt,
    updatedAt,
  }).onConflictDoUpdate({
    target: schema.userProfiles.userEmail,
    set: {
      displayName: next.displayName,
      trainingGoal: next.trainingGoal,
      weeklyDays: next.weeklyDays,
      equipment: next.equipment,
      level: next.level,
      weightUnit: next.weightUnit,
      notes: next.notes.slice(0, 2000),
      advancedProfileJson: JSON.stringify(next.advancedProfile),
      gender: next.gender,
      age: next.age,
      heightCm: next.heightCm,
      weightKg: next.weightKg,
      sessionLengthMinutes: next.sessionLengthMinutes,
      injuriesOrLimitations: next.injuriesOrLimitations,
      preferredTrainingStyle: next.preferredTrainingStyle,
      updatedAt,
    },
  });
  return { ...next, updatedAt: new Date(updatedAt).toISOString() };
}

export function getTrainingGoals(profile: UserProfile) {
  return {
    primaryGoal: profile.trainingGoal,
    weeklyDays: profile.weeklyDays,
    equipment: profile.equipment,
    level: profile.level,
    weightUnit: profile.weightUnit,
    notes: profile.notes,
    advancedProfile: profile.advancedProfile,
  };
}
