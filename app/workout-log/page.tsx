"use client";
import { useState } from "react";
import { OsNav } from "../os-nav";

export default function LogPage() {
  const [form, setForm] = useState({ exercise: "Goblet_Squat", sets: "3", reps: "10", weight: "", minutes: "45", difficulty: "6", energy: "7", soreness: "3", notes: "" });
  const [status, setStatus] = useState("idle"); const [error, setError] = useState("");
  const [completed, setCompleted] = useState(true);
  const field = (name: keyof typeof form, value: string) => setForm(current => ({ ...current, [name]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setStatus("saving"); setError(""); const sets = Number(form.sets); const reps = Number(form.reps);
    if (completed && (!form.exercise || !Number.isFinite(sets) || !Number.isFinite(reps))) { setError("Exercise, sets, and reps are required."); setStatus("idle"); return; }
    const performances = completed ? Array.from({ length: sets }, (_, index) => ({ exerciseId: form.exercise, setNumber: index + 1, weightKg: Number(form.weight || 0), reps })) : [];
    const response = await fetch("/api/workouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ completed, focus: "full", duration: Number(form.minutes), perceived_difficulty: Number(form.difficulty), energy_level: Number(form.energy), soreness_level: Number(form.soreness), notes: form.notes, performances }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || "Could not save this workout."); setStatus("idle"); return; }
    setStatus("saved");
  }
  return <><OsNav current="/log"/><main className="os-page"><section className="os-heading"><div><small>TRAIN → TAP → SAVED</small><h1>Log today’s work.</h1></div></section><form className="os-form os-log-form" onSubmit={submit}>
    <div className="os-completion-toggle wide"><button type="button" className={completed ? "active" : ""} onClick={() => setCompleted(true)}>Workout completed</button><button type="button" className={!completed ? "active missed" : ""} onClick={() => setCompleted(false)}>Planned workout missed</button></div>
    {completed && <><label className="wide">Exercise<select value={form.exercise} onChange={e => field("exercise", e.target.value)}><option value="Goblet_Squat">Goblet Squat</option><option value="Dumbbell_Bench_Press">Dumbbell Bench Press</option><option value="Seated_Cable_Rows">Seated Cable Row</option><option value="Dumbbell_Romanian_Deadlift">Dumbbell Romanian Deadlift</option><option value="Neutral-Grip_Lat_Pulldown">Neutral-Grip Lat Pulldown</option></select></label>
    <label>Sets<input type="number" min="1" max="20" value={form.sets} onChange={e => field("sets", e.target.value)} /></label><label>Reps per set<input type="number" min="1" max="500" value={form.reps} onChange={e => field("reps", e.target.value)} /></label>
    <label>Weight (kg)<input type="number" min="0" step="0.5" value={form.weight} onChange={e => field("weight", e.target.value)} /></label><label>Duration (min)<input type="number" min="1" max="300" value={form.minutes} onChange={e => field("minutes", e.target.value)} /></label></>}
    <label>Difficulty · {form.difficulty}/10<input type="range" min="1" max="10" value={form.difficulty} onChange={e => field("difficulty", e.target.value)} /></label><label>Energy · {form.energy}/10<input type="range" min="1" max="10" value={form.energy} onChange={e => field("energy", e.target.value)} /></label>
    <label className="wide">Soreness · {form.soreness}/10<input type="range" min="1" max="10" value={form.soreness} onChange={e => field("soreness", e.target.value)} /></label><label className="wide">Notes<textarea value={form.notes} onChange={e => field("notes", e.target.value)} placeholder="Anything that should affect next week?" /></label>
    {error && <p className="os-error wide">{error}</p>}<button className="os-primary wide" disabled={status === "saving" || status === "saved"}>{status === "saved" ? "Training log saved ✓" : status === "saving" ? "Saving…" : completed ? "Complete workout →" : "Save missed workout →"}</button>
  </form></main></>;
}
