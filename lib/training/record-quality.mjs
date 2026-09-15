// Quarantine explicitly identified QA fixtures at read time. Never delete history
// or infer that an ordinary note mentioning a test is synthetic.
export function isTestWorkout(log) {
  if (log?.recordKind === "test" || log?.payload?.recordKind === "test") return true;
  const note = String(log?.notes || log?.payload?.notes || "").trim();
  return /^(Guided production QA\s*[—-]\s*not a real workout|UI acceptance test v263|production test 0904)$/i.test(note);
}

export function trainingRecords(logs = []) {
  return logs.filter(log => !isTestWorkout(log)).sort((a,b) =>
    new Date(b.workoutDate || b.date).getTime() - new Date(a.workoutDate || a.date).getTime());
}
