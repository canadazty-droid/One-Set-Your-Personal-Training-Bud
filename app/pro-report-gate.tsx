"use client";

type Language="zh"|"en";
type Source="form"|"posture";

export default function ProReportGate({language,source,unlock}:{language:Language;source:Source;unlock:()=>void}){
  const zh=language==="zh";
  const benefits=source==="form"
    ? [{zh:"5 项动作指标与可信度",en:"5 movement metrics + confidence"},{zh:"全部 3 个纠正重点",en:"All 3 specific form fixes"},{zh:"一键生成纠正训练",en:"One-tap corrective workout"}]
    : [{zh:"全部可观察体态指标",en:"All observable posture metrics"},{zh:"完整训练重点与建议",en:"Full training priorities"},{zh:"纠正训练与复扫进度",en:"Corrective workout + rescan progress"}];
  return <section className="pro-report-gate"><header><span>PRO</span><div><small>练一下 · ONE SET PRO</small><h3>{zh?"你的直接结果已免费解锁":"Your direct result is free"}</h3><p>{zh?"升级后查看完整报告，并把这次评分变成可执行的训练。":"Unlock the full report and turn this score into a training plan."}</p></div></header><div>{benefits.map((item,index)=><p key={item.en}><b>{index+1}</b><span>{zh?item.zh:item.en}</span><i>{zh?"锁定":"LOCKED"}</i></p>)}</div><button onClick={unlock}><span>{zh?"解锁完整报告与训练":"Unlock full report + workout"}</span><b>→</b></button><small>{zh?"评分、直接结论和第一优先级始终免费。创始测试期间加入后立即解锁。":"Score, direct result, and top priority stay free. Founding beta access unlocks immediately."}</small></section>;
}
