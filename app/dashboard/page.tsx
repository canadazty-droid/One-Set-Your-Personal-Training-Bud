"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { OsNav } from "../os-nav";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null); const [error, setError] = useState("");
  const [weightInput, setWeightInput] = useState(""); const [weightStatus, setWeightStatus] = useState("idle");
  const load = () => Promise.all([
    fetch("/api/profile").then(r => r.ok ? r.json() : Promise.reject(r)),
    fetch("/api/plans/today").then(r => r.ok ? r.json() : Promise.reject(r)),
    fetch("/api/workouts").then(r => r.ok ? r.json() : Promise.reject(r)),
    fetch("/api/weight?days=90").then(r => r.ok ? r.json() : Promise.reject(r)),
  ]).then(([profile, today, logs, weight]) => setData({ profile, today, logs, weight })).catch(() => setError("Sign in to view your saved training dashboard."));
  useEffect(() => { void load(); }, []);
  const recent = data?.logs?.workouts?.filter((item: any) => Date.now() - Date.parse(item.date) <= 7 * 86400000) || [];
  const goal = data?.profile?.goals?.primaryGoal?.replaceAll("_", " ") || "—";
  async function saveWeight(event: React.FormEvent) {
    event.preventDefault(); setWeightStatus("saving");
    const response = await fetch("/api/weight", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weight_kg: Number(weightInput) }) });
    if (!response.ok) { setWeightStatus("error"); return; }
    const result = await response.json(); setData((current: any) => ({ ...current, weight: result.trend })); setWeightInput(""); setWeightStatus("saved");
  }
  return <><OsNav current="/dashboard"/><main className="os-page"><section className="os-heading"><div><small>YOUR TRAINING WEEK</small><h1>Today, made obvious.</h1></div><Link href="/workout-log" className="os-primary">Log a workout</Link></section>{error ? <section className="os-empty"><h2>Your training data is private.</h2><p>{error}</p><Link href="/onboarding">Start onboarding →</Link></section> : !data ? <p className="os-loading">Loading your week…</p> : <div className="os-dashboard">
    <article className="os-feature"><small>TODAY</small><h2>{data.today.today?.dayName || "Recovery day"}</h2><p>{data.today.today ? `${data.today.today.exercises.length} movements · ${data.today.today.planName}` : "No active session yet. Build your first four-week plan."}</p>{data.today.today ? <Link href="/training-plan">Open today’s workout →</Link> : <button onClick={() => fetch("/api/plans/generate", { method: "POST" }).then(() => location.reload())}>Generate my plan →</button>}</article>
    <article className="os-stat"><small>GOAL</small><strong>{goal}</strong><span>{data.profile.goals.weeklyDays} training days / week</span></article>
    <article className="os-stat"><small>LAST 7 DAYS</small><strong>{recent.length}/{data.profile.goals.weeklyDays}</strong><span>sessions completed</span></article>
    <article className="os-list"><small>THIS WEEK</small>{data.today.activePlan?.schedule?.days?.map((day: any) => <p key={day.dayLabel}><b>{day.dayLabel}</b><span>{day.name}</span><em>{day.exercises.length} moves</em></p>) || <p>No active plan.</p>}</article>
    <article className="os-weight"><small>BODY WEIGHT TREND</small><div><strong>{data.weight.latest ? `${data.weight.latest.weightKg} kg` : "No entries"}</strong><span>{data.weight.changeKg === null ? "Add another entry to see change" : `${data.weight.changeKg > 0 ? "+" : ""}${data.weight.changeKg} kg since last entry`}</span></div><form onSubmit={saveWeight}><input aria-label="Current body weight in kilograms" type="number" min="30" max="350" step="0.1" placeholder="kg" value={weightInput} onChange={event => { setWeightInput(event.target.value); setWeightStatus("idle"); }}/><button disabled={!weightInput || weightStatus === "saving"}>{weightStatus === "saving" ? "Saving…" : "Add today"}</button></form>{weightStatus === "error" && <em role="alert">Enter a weight from 30–350 kg.</em>}</article>
    <article className="os-next"><small>NEXT STEP</small><h3>{recent.length >= data.profile.goals.weeklyDays ? "Review the week before adding more." : data.today.today ? "Complete today’s session, then log how it felt." : "Create a plan from your profile."}</h3><Link href={recent.length >= data.profile.goals.weeklyDays ? "/review" : data.today.today ? "/workout-log" : "/onboarding"}>Continue →</Link></article>
  </div>}</main></>;
}
