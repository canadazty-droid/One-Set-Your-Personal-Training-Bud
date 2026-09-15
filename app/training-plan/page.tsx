"use client";
import { useEffect, useState } from "react";
import { OsNav } from "../os-nav";

export default function PlanPage() {
  const [plan, setPlan] = useState<any>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/plans").then(r => r.json()).then(data => setPlan(data.activePlan)).finally(() => setLoading(false)); }, []);
  const cycle = plan?.cycle; return <><OsNav current="/plan"/><main className="os-page"><section className="os-heading"><div><small>RULE-BASED PROGRAM</small><h1>Your four-week plan.</h1></div>{plan && <span className="os-version">VERSION {plan.planVersion}</span>}</section>{loading ? <p className="os-loading">Loading plan…</p> : !cycle?.weeks ? <section className="os-empty"><h2>No four-week plan yet.</h2><button onClick={() => fetch("/api/plans/generate", { method: "POST" }).then(() => location.reload())}>Generate plan →</button></section> : <div className="os-weeks">{cycle.weeks.map((week: any) => <section key={week.week_number} className="os-week"><header><span>0{week.week_number}</span><div><small>WEEK {week.week_number}</small><h2>{week.emphasis}</h2></div></header>{week.days.map((day: any) => <details key={day.day_number} open={week.week_number === 1}><summary><b>{day.day_label}</b><span>{day.focus_area}</span><em>{day.exercises.length} exercises</em></summary><div>{day.exercises.map((exercise: any) => <p key={exercise.name}><strong>{exercise.name}</strong><span>{exercise.sets} × {exercise.reps}</span><small>{exercise.rest_seconds}s rest</small></p>)}</div></details>)}</section>)}</div>}</main></>;
}
