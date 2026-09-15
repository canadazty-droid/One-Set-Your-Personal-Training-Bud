const tempoCopy={
  zh:{control:"控制回程",pause:"稳定停顿",effort:"主动发力",brace:"建立张力",breathe:"自然呼吸",release:"可控结束",posture:"保持姿势",steps:"稳定步幅",turn:"平稳转向",inhale:"吸气准备",exhale:"呼气进入",return:"控制返回"},
  en:{control:"CONTROL",pause:"PAUSE",effort:"EFFORT",brace:"BRACE",breathe:"BREATHE",release:"RELEASE",posture:"POSTURE",steps:"STEADY STEPS",turn:"CONTROLLED TURN",inhale:"INHALE",exhale:"EXHALE",return:"RETURN"},
};

export function buildTempoGuide(tempo,language="en"){
  const copy=tempoCopy[language]||tempoCopy.en;
  const normalized=String(tempo||"").trim().toUpperCase();
  if(normalized==="HOLD")return [{label:copy.brace,value:"01"},{label:copy.breathe,value:"02"},{label:copy.release,value:"03"}];
  if(normalized==="WALK")return [{label:copy.posture,value:"01"},{label:copy.steps,value:"02"},{label:copy.turn,value:"03"}];
  if(normalized==="BREATH")return [{label:copy.inhale,value:"01"},{label:copy.exhale,value:"02"},{label:copy.return,value:"03"}];
  const seconds=normalized.split(/[–-]/).map(value=>Number.parseInt(value,10));
  if(seconds.length===3&&seconds.every(Number.isFinite))return [
    {label:copy.control,value:`${seconds[0]}s`},
    {label:copy.pause,value:`${seconds[1]}s`},
    {label:copy.effort,value:`${seconds[2]}s`},
  ];
  return [{label:copy.control,value:"—"},{label:copy.pause,value:"—"},{label:copy.effort,value:"—"}];
}

export function starterLoadRule(exercise,language="en"){
  const bodyweight=exercise?.gear==="bodyweight";
  const beginner=exercise?.level==="beginner";
  if(language==="zh"){
    if(bodyweight)return "先选择能全程控制的动作幅度；结束时应还能规范完成约 3 次。";
    if(beginner)return "第一组从保守重量开始；达到目标次数后仍应保留约 3–4 次余力。";
    return "使用能稳定完成目标次数并保留约 2–3 次余力的重量。";
  }
  if(bodyweight)return "Begin with a range you can fully control and finish with about 3 clean reps available.";
  if(beginner)return "Start the first set conservatively and keep about 3–4 clean reps available.";
  return "Choose a load that leaves about 2–3 clean reps available at the target rep count.";
}
