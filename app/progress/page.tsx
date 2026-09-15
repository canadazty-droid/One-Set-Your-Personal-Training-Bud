"use client";

import { useEffect, useState } from "react";
import { OneSetApp } from "../page";

export default function ProgressPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <main className="progress-route-loading"><section><small>ONE SET · PROGRESS</small><strong>正在载入训练记录…</strong></section></main>;
  return <OneSetApp initialTab="progress"/>;
}
