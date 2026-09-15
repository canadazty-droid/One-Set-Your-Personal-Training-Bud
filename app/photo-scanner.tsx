"use client";

import {useEffect,useRef,useState} from "react";
import {analyzePosturePhotos} from "./posture-analysis.mjs";
import {queueScanRecord,readScanRecords,syncPendingScans} from "./scan-sync.mjs";
import {shareOrDownloadCard} from "./share-card.mjs";
import MembershipOffer from "./membership-offer";
import ProReportGate from "./pro-report-gate";
import {hasProAccess} from "./pro-access.mjs";
import {trackProductEvent} from "./product-events.mjs";
import {recordCorrectionRescan} from "./correction-cycle.mjs";
import {AppIcon} from "./ui-icons";

type Language="zh"|"en";
type View="front"|"side"|"back";
type Landmark={x:number;y:number;z?:number;visibility?:number};
type PostureMetric={key:string;score:number;label:string;detail:string;confidence:"high"|"medium"|"low";assessed:boolean};
type Analysis={overall:number;confidence:number;metrics:PostureMetric[];priorities:{key:string;title:string;text:string}[];next:string;photoCount:number};
type VisionModule={FilesetResolver:{forVisionTasks:(path:string)=>Promise<unknown>};PoseLandmarker:{createFromOptions:(vision:unknown,options:unknown)=>Promise<{detect:(image:HTMLImageElement)=>{landmarks?:Landmark[][]};close:()=>void}>}};

export default function PhotoScanner({language,close,openWorkout}:{language:Language;close:()=>void;openWorkout:(metricKeys:string[])=>void}){
  const zh=language==="zh";
  const[photos,setPhotos]=useState<Partial<Record<View,{file:File;url:string}>>>({});
  const[status,setStatus]=useState<"capture"|"analyzing"|"result"|"error">("capture");
  const[result,setResult]=useState<Analysis|null>(null);
  const[error,setError]=useState("");
  const[shareState,setShareState]=useState<"idle"|"sharing"|"shared"|"downloaded"|"error">("idle");
  const[scoreChange,setScoreChange]=useState<number|null>(null);
  const[proUnlocked,setProUnlocked]=useState(false);
  const inputRefs=useRef<Partial<Record<View,HTMLInputElement|null>>>({});
  const openTracked=useRef(false);
  const autoAnalyzeRequested=useRef(false);
  const photosRef=useRef(photos);photosRef.current=photos;
  useEffect(()=>()=>{Object.values(photosRef.current).forEach(item=>item&&URL.revokeObjectURL(item.url))},[]);
  useEffect(()=>{if(!openTracked.current){trackProductEvent("scan_opened",{source:"posture"});openTracked.current=true}},[]);
  useEffect(()=>setProUnlocked(hasProAccess()),[]);
  const choose=(view:View,file?:File)=>{if(!file||status==="analyzing")return;if(view==="front")autoAnalyzeRequested.current=true;setPhotos(current=>{const previous=current[view];if(previous)URL.revokeObjectURL(previous.url);return{...current,[view]:{file,url:URL.createObjectURL(file)}}});setError("");setStatus("capture")};
  const loadImage=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(zh?"照片无法读取，请重新选择。":"This photo could not be read. Choose another image."));image.src=url});
  const analyze=async()=>{
    if(!photos.front){setError(zh?"请先添加一张正面照片。":"Add a front photo first.");setStatus("error");return;}
    const analysisStarted=performance.now();
    trackProductEvent("scan_started",{source:"posture",photoCount:Object.keys(photos).length});
    setStatus("analyzing");setError("");let landmarker:null|{detect:(image:HTMLImageElement)=>{landmarks?:Landmark[][]};close:()=>void}=null;
    try{
      const modulePath="/mediapipe/vision_bundle.mjs";const module=await import(/* webpackIgnore: true */ /* @vite-ignore */ modulePath) as VisionModule;
      const vision=await module.FilesetResolver.forVisionTasks("/mediapipe/wasm");
      landmarker=await module.PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:"/mediapipe/pose_landmarker_lite.task"},runningMode:"IMAGE",numPoses:1,minPoseDetectionConfidence:.45,minPosePresenceConfidence:.45});
      const landmarks:Partial<Record<View,Landmark[]>>={};
      for(const view of ["front","side","back"] as View[]){const photo=photos[view];if(!photo)continue;const image=await loadImage(photo.url);const detection=landmarker.detect(image);if(detection.landmarks?.[0])landmarks[view]=detection.landmarks[0];}
      if(!landmarks.front)throw new Error(zh?"正面照片没有识别到完整人体，请退后并重新拍摄。":"A full person was not detected in the front photo. Step back and retake it.");
      const analysis=analyzePosturePhotos({front:landmarks.front,...(landmarks.side?{side:landmarks.side}:{}),...(landmarks.back?{back:landmarks.back}:{})},language) as Analysis;
      setResult(analysis);
      trackProductEvent("scan_completed",{source:"posture",score:analysis.overall,confidence:analysis.confidence,photoCount:analysis.photoCount,analysisMs:Math.round(performance.now()-analysisStarted)});
      try{const previous=readScanRecords().find((record:{type?:string})=>record.type==="posture");setScoreChange(previous?analysis.overall-previous.score:null);const id=crypto.randomUUID(),date=new Date().toISOString();queueScanRecord({id,date,type:"posture",score:analysis.overall,confidence:analysis.confidence,photoCount:analysis.photoCount,metrics:analysis.metrics.map(metric=>({key:metric.key,score:metric.score,assessed:metric.assessed}))});const cycle=recordCorrectionRescan({source:"posture",score:analysis.overall,scanId:id,scannedAt:date});if(cycle?.status==="completed"&&cycle.completedAt===date)trackProductEvent("correction_cycle_rescanned",{source:"posture",baselineScore:cycle.baselineScore,latestScore:analysis.overall,improvement:analysis.overall-cycle.baselineScore,workoutsCompleted:cycle.workoutsCompleted});void syncPendingScans();}catch{/* device storage unavailable */}
      setStatus("result");
    }catch(cause){trackProductEvent("scan_failed",{source:"posture",stage:"analysis",analysisMs:Math.round(performance.now()-analysisStarted)});setError(cause instanceof Error?cause.message:(zh?"暂时无法分析这些照片。":"These photos could not be analyzed."));setStatus("error");}finally{landmarker?.close()}
  };
  useEffect(()=>{if(!autoAnalyzeRequested.current||!photos.front||status!=="capture")return;autoAnalyzeRequested.current=false;void analyze()},[photos.front]);
  const share=async()=>{if(!result)return;setShareState("sharing");try{const outcome=await shareOrDownloadCard({type:"posture",score:result.overall,confidence:result.confidence,change:scoreChange,language,metrics:result.metrics.map(metric=>({key:metric.key,label:metric.label,score:metric.score,assessed:metric.assessed}))});setShareState(outcome);trackProductEvent("share_card_created",{source:"posture",outcome})}catch{setShareState("error")}};
  const reset=()=>{Object.values(photos).forEach(item=>item&&URL.revokeObjectURL(item.url));setPhotos({});autoAnalyzeRequested.current=false;setResult(null);setError("");setStatus("capture");setShareState("idle");setScoreChange(null)};
  const correctionKeys=result?[...result.metrics].filter(metric=>metric.assessed).sort((a,b)=>a.score-b.score).map(metric=>metric.key):[];
  const requestPro=(feature:string)=>{trackProductEvent("pro_feature_tapped",{source:"posture",feature});document.getElementById("membership-posture")?.scrollIntoView({behavior:"smooth",block:"center"});(document.getElementById("offer-email-posture") as HTMLInputElement|null)?.focus({preventScroll:true})};
  const openCorrectiveWorkout=()=>{if(!proUnlocked){requestPro("corrective_workout");return}openWorkout(correctionKeys)};
  const verdict=result?(result.overall>=84?(zh?"当前体态趋势整体稳定。":"Your current posture trend is stable."):result.overall>=68?(zh?"整体基础不错，先改善一个训练重点。":"Good baseline. Focus on one training priority."):(zh?"先从基础控制与稳定训练开始。":"Start with foundational control and stability.")):"";
  const slots:{view:View;labelZh:string;labelEn:string;required:boolean;guideZh:string;guideEn:string}[]=[
    {view:"front",labelZh:"正面",labelEn:"Front",required:true,guideZh:"拍摄后自动分析，头部和双脚完整入镜",guideEn:"Auto-analyzes after capture; keep head and feet visible"},
    {view:"side",labelZh:"侧面",labelEn:"Side",required:false,guideZh:"可选，用于增加头肩位置趋势",guideEn:"Optional, adds head-to-shoulder detail"},
    {view:"back",labelZh:"背面",labelEn:"Back",required:false,guideZh:"可选，用于增加趋势参考",guideEn:"Optional, adds another trend reference"}
  ];
  return <div className="scanner-overlay"><section className="scanner-sheet photo-scan-sheet"><header><div><small>练一下 · ONE SET · POSTURE TREND BETA</small><h2>{zh?"体态趋势扫描":"Posture trend scan"}</h2><p>{zh?"只记录照片中可观察的对齐趋势，不评价身材或估算身体成分。":"Observable alignment trends only—no appearance rating or body-composition estimate."}</p></div><button onClick={close}>×</button></header>
    {status!=="result"&&<div className="photo-capture"><section className="photo-guide"><i><AppIcon name="camera"/></i><div><strong>{zh?"拍摄标准决定结果可信度":"Consistent photos build trust"}</strong><span>{zh?"手机保持水平、镜头约在腰部高度、距离和光线尽量一致。穿正常运动服即可。":"Keep the phone level near waist height. Reuse the same distance and lighting. Normal workout clothes are fine."}</span></div></section><div className="photo-slot-grid">{slots.map(slot=>{const photo=photos[slot.view];return <button key={slot.view} className={`photo-slot ${photo?"filled":""}`} disabled={status==="analyzing"} onClick={()=>inputRefs.current[slot.view]?.click()}><input ref={node=>{inputRefs.current[slot.view]=node}} hidden type="file" accept="image/*" capture="environment" onChange={event=>choose(slot.view,event.target.files?.[0])}/>{photo?<img src={photo.url} alt={zh?slot.labelZh:slot.labelEn}/>:<i><AppIcon name="plus"/></i>}<div><small>{slot.required?(zh?"必需":"REQUIRED"):(zh?"可选":"OPTIONAL")}</small><strong>{zh?slot.labelZh:slot.labelEn}</strong><span>{zh?slot.guideZh:slot.guideEn}</span></div>{photo&&<b><AppIcon name="check"/></b>}</button>})}</div>
      {status==="analyzing"?<div className="photo-analyzing"><i/><strong>{zh?"正在建立可观察体态基准…":"Building your observable posture baseline…"}</strong><span>{zh?"照片留在此设备上处理":"Photos stay on this device"}</span></div>:<button className="scanner-primary" onClick={()=>inputRefs.current.front?.click()}><span>{zh?"拍摄正面 · 自动分析":"Take front photo · auto analyze"}</span><b><AppIcon name="arrow-right"/></b></button>}
      {status==="error"&&<div className="scanner-error"><strong>{zh?"需要调整照片":"Photo adjustment needed"}</strong><p>{error}</p><button onClick={()=>setStatus("capture")}>{zh?"返回修改":"Back to photos"}</button></div>}
      <p className="posture-disclaimer">{zh?"本功能不是体态诊断、伤病筛查或医疗建议。单张照片会受镜头角度、衣物、站位和光线影响；我们关注的是相同条件下的长期趋势。":"This is not posture diagnosis, injury screening, or medical advice. Camera angle, clothing, stance, and lighting affect a photo; the useful signal is the trend under repeated conditions."}</p></div>}
    {status==="result"&&result&&<div className="scan-report posture-report">
      <div className="report-score"><div><small>POSTURE TREND SCORE</small><strong>{result.overall}<span>/100</span></strong><p>{zh?`${result.photoCount} 张照片 · 结果可信度 ${result.confidence}%`:`${result.photoCount} photos · ${result.confidence}% result confidence`}</p></div><div className="score-ring" style={{"--score":`${result.overall*3.6}deg`} as React.CSSProperties}><b>{result.overall}</b></div></div>
      <section className="instant-verdict"><small>{zh?"直接结论":"YOUR RESULT"}</small><h3>{verdict}</h3><p><b>#1</b><span><em>{zh?"第一训练重点":"TOP TRAINING FOCUS"}</em><strong>{result.priorities[0]?.title}</strong>{result.priorities[0]?.text}</span></p><div><span><small>{zh?"下一次复扫":"NEXT RESCAN"}</small><strong>{result.next}</strong></span><button className={!proUnlocked?"locked":""} onClick={openCorrectiveWorkout}>{proUnlocked?(zh?"生成针对训练":"Build my workout"):(zh?"解锁针对训练":"Unlock my workout")}<b>{proUnlocked?"→":zh?"锁":"🔒"}</b></button></div></section>
      {proUnlocked?<details className="report-details"><summary>{zh?"查看详细趋势与全部建议":"View detailed trends and all priorities"}<span>{result.metrics.filter(metric=>metric.assessed).length} {zh?"项":"metrics"}</span></summary><div className="report-metrics">{result.metrics.map(metric=><article className={!metric.assessed?"unavailable":""} key={metric.key}><i className={metric.assessed?(metric.score>=84?"good":metric.score>=70?"watch":"fix"):"fix"}>{metric.assessed?(metric.score>=84?"✓":metric.score>=70?"△":"!"):"–"}</i><div><strong>{metric.label}</strong><small>{metric.assessed?metric.detail:(zh?"当前照片无法判断":"Unable to assess")}</small><em className={`confidence-${metric.confidence}`}>{metric.confidence.toUpperCase()}</em></div><b>{metric.assessed?metric.score:"--"}</b></article>)}</div><section className="report-fixes"><small>{zh?"全部训练与复拍建议":"ALL PRIORITIES"}</small>{result.priorities.map((priority,index)=><p key={priority.key}><b>{index+1}</b><span><strong>{priority.title}</strong>{priority.text}</span></p>)}</section></details>:<ProReportGate language={language} source="posture" unlock={()=>requestPro("full_report")}/>}<p className="scan-caveat">{zh?"该分数用于相同拍摄条件下的个人趋势对比，不是医学结论，也不代表身体好坏。":"This score is a personal trend baseline under similar photo conditions. It is not a medical conclusion or a rating of your body."}</p><div className="report-actions"><button className="share-card-button" disabled={shareState==="sharing"} onClick={share}>{shareState==="sharing"?(zh?"正在生成…":"Creating card…"):shareState==="shared"?(zh?"✓ 已分享":"✓ Shared"):shareState==="downloaded"?(zh?"✓ 已下载":"✓ Downloaded"):(zh?"分享评分卡":"Share score card")}</button><button onClick={reset}>{zh?"重新拍摄":"Retake photos"}</button></div><MembershipOffer language={language} source="posture" onAccessGranted={()=>setProUnlocked(true)}/>
    </div>}
  </section></div>;
}
