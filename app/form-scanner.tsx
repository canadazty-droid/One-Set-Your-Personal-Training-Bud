"use client";

import {useEffect,useRef,useState} from "react";
import {analyzeSquatFrames} from "./form-analysis.mjs";
import {queueScanRecord,readScanRecords,syncPendingScans} from "./scan-sync.mjs";
import {shareOrDownloadCard} from "./share-card.mjs";
import MembershipOffer from "./membership-offer";
import ProReportGate from "./pro-report-gate";
import {hasProAccess} from "./pro-access.mjs";
import {trackProductEvent} from "./product-events.mjs";
import {PROOF_CONNECTIONS,PROOF_JOINTS,selectDeepestSquatFrame} from "./pose-proof.mjs";
import {recordCorrectionRescan} from "./correction-cycle.mjs";
import {AppIcon} from "./ui-icons";

type Language="zh"|"en";
type PoseLandmark={x:number;y:number;z?:number;visibility?:number};
type PoseFrame={time:number;landmarks:PoseLandmark[]};
type FormMetric={key:string;score:number;label:string;detail:string;status:"good"|"watch"|"fix";confidenceLevel:"high"|"medium"|"low"};
type FormAnalysis={overall:number;confidence:number;repCount:number;metrics:FormMetric[];suggestions:string[];nextSet:string;deepestKneeAngle:number};
type VisionModule={FilesetResolver:{forVisionTasks:(path:string)=>Promise<unknown>};PoseLandmarker:{createFromOptions:(vision:unknown,options:unknown)=>Promise<{detectForVideo:(video:HTMLVideoElement,time:number)=>{landmarks?:PoseFrame["landmarks"][]};close:()=>void}>}};

export default function FormScanner({language,close,openWorkout}:{language:Language;close:()=>void;openWorkout:(metricKeys:string[])=>void}){
  const inputRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const[url,setUrl]=useState("");
  const[fileName,setFileName]=useState("");
  const[status,setStatus]=useState<"idle"|"ready"|"analyzing"|"result"|"error">("idle");
  const[progress,setProgress]=useState(0);
  const[result,setResult]=useState<FormAnalysis|null>(null);
  const[error,setError]=useState("");
  const[shareState,setShareState]=useState<"idle"|"sharing"|"shared"|"downloaded"|"error">("idle");
  const[scoreChange,setScoreChange]=useState<number|null>(null);
  const[proof,setProof]=useState<{url:string;time:number}|null>(null);
  const[proUnlocked,setProUnlocked]=useState(false);
  const openTracked=useRef(false);
  const autoAnalyzeStarted=useRef(false);
  const zh=language==="zh";
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url)},[url]);
  useEffect(()=>{if(!openTracked.current){trackProductEvent("scan_opened",{source:"form"});openTracked.current=true}},[]);
  useEffect(()=>setProUnlocked(hasProAccess()),[]);

  const choose=(file?:File)=>{
    if(!file)return;
    if(url)URL.revokeObjectURL(url);
    autoAnalyzeStarted.current=false;setUrl(URL.createObjectURL(file));setFileName(file.name);setResult(null);setProof(null);setError("");setProgress(0);setStatus("ready");
  };
  const seek=(video:HTMLVideoElement,time:number)=>new Promise<void>((resolve,reject)=>{
    if(Math.abs(video.currentTime-time)<.025){resolve();return}
    const timer=window.setTimeout(()=>reject(new Error("seek timeout")),4000);
    video.onseeked=()=>{window.clearTimeout(timer);resolve()};
    video.onerror=()=>{window.clearTimeout(timer);reject(new Error("video error"))};
    video.currentTime=time;
  });
  const createProof=async(video:HTMLVideoElement,frame:PoseFrame)=>{
    await seek(video,frame.time);
    if(!video.videoWidth||!video.videoHeight)return null;
    const scale=Math.min(1,900/video.videoWidth),canvas=document.createElement("canvas");canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    const context=canvas.getContext("2d");if(!context)return null;context.drawImage(video,0,0,canvas.width,canvas.height);context.fillStyle="rgba(4,8,10,.18)";context.fillRect(0,0,canvas.width,canvas.height);
    const point=(index:number)=>({x:frame.landmarks[index].x*canvas.width,y:frame.landmarks[index].y*canvas.height});
    context.lineCap="round";context.lineJoin="round";context.lineWidth=Math.max(7,canvas.width*.011);context.strokeStyle="rgba(5,10,8,.7)";
    for(const[start,end]of PROOF_CONNECTIONS){const a=point(start),b=point(end);context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke()}
    context.lineWidth=Math.max(3,canvas.width*.0045);context.strokeStyle="#d6ff2f";
    for(const[start,end]of PROOF_CONNECTIONS){const a=point(start),b=point(end);context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke()}
    for(const index of PROOF_JOINTS){const p=point(index);context.beginPath();context.arc(p.x,p.y,Math.max(5,canvas.width*.007),0,Math.PI*2);context.fillStyle="#d6ff2f";context.fill();context.lineWidth=3;context.strokeStyle="#101510";context.stroke()}
    return canvas.toDataURL("image/jpeg",.86);
  };
  const analyze=async()=>{
    const video=videoRef.current;if(!video)return;
    const analysisStarted=performance.now();
    trackProductEvent("scan_started",{source:"form",durationSeconds:Number.isFinite(video.duration)?Math.round(video.duration):0});
    setStatus("analyzing");setError("");setProgress(3);
    let landmarker:null|{detectForVideo:(video:HTMLVideoElement,time:number)=>{landmarks?:PoseFrame["landmarks"][]};close:()=>void}=null;
    try{
      if(!Number.isFinite(video.duration)||video.duration<2)throw new Error(zh?"视频至少需要 2 秒。":"Use a video at least two seconds long.");
      const modulePath="/mediapipe/vision_bundle.mjs";
      const visionModule=await import(/* webpackIgnore: true */ /* @vite-ignore */ modulePath) as VisionModule;
      const vision=await visionModule.FilesetResolver.forVisionTasks("/mediapipe/wasm");
      landmarker=await visionModule.PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:"/mediapipe/pose_landmarker_lite.task"},runningMode:"VIDEO",numPoses:1,minPoseDetectionConfidence:.45,minPosePresenceConfidence:.45,minTrackingConfidence:.45});
      const duration=Math.min(video.duration,12);
      const frameCount=Math.min(48,Math.max(18,Math.floor(duration*5)));
      const frames:PoseFrame[]=[];
      for(let index=0;index<frameCount;index++){
        const time=.05+(duration-.1)*(index/Math.max(1,frameCount-1));
        await seek(video,time);
        const detection=landmarker.detectForVideo(video,Math.round(time*1000));
        if(detection.landmarks?.[0])frames.push({time,landmarks:detection.landmarks[0]});
        setProgress(Math.round(8+(index+1)/frameCount*84));
      }
      const analysis=analyzeSquatFrames(frames,language) as FormAnalysis;
      const deepest=selectDeepestSquatFrame(frames) as PoseFrame|null;
      if(deepest){setProgress(96);const proofUrl=await createProof(video,deepest);if(proofUrl)setProof({url:proofUrl,time:deepest.time})}
      setResult(analysis);
      trackProductEvent("scan_completed",{source:"form",score:analysis.overall,confidence:analysis.confidence,repCount:analysis.repCount,analysisMs:Math.round(performance.now()-analysisStarted),sampledFrames:frames.length,requestedFrames:frameCount});
      try{const previous=readScanRecords().find((record:{type?:string})=>record.type==="form");setScoreChange(previous?analysis.overall-previous.score:null);const id=crypto.randomUUID(),date=new Date().toISOString();queueScanRecord({id,date,type:"form",score:analysis.overall,confidence:analysis.confidence,repCount:analysis.repCount,metrics:analysis.metrics.map(metric=>({key:metric.key,score:metric.score,assessed:true}))});const cycle=recordCorrectionRescan({source:"form",score:analysis.overall,scanId:id,scannedAt:date});if(cycle?.status==="completed"&&cycle.completedAt===date)trackProductEvent("correction_cycle_rescanned",{source:"form",baselineScore:cycle.baselineScore,latestScore:analysis.overall,improvement:analysis.overall-cycle.baselineScore,workoutsCompleted:cycle.workoutsCompleted});void syncPendingScans();}catch{/* private browsing or storage unavailable */}
      setProgress(100);setStatus("result");
    }catch(cause){trackProductEvent("scan_failed",{source:"form",stage:"analysis",analysisMs:Math.round(performance.now()-analysisStarted)});setError(cause instanceof Error?cause.message:(zh?"暂时无法分析这个视频，请重新拍摄。":"We could not analyze this video. Please record it again."));setStatus("error");}
    finally{landmarker?.close();}
  };
  const share=async()=>{
    if(!result)return;
    setShareState("sharing");try{const outcome=await shareOrDownloadCard({type:"form",score:result.overall,confidence:result.confidence,change:scoreChange,language,metrics:result.metrics.map(metric=>({key:metric.key,label:metric.label,score:metric.score,assessed:true}))});setShareState(outcome);trackProductEvent("share_card_created",{source:"form",outcome});}catch{setShareState("error")}
  };
  const reset=()=>{setResult(null);setProof(null);setError("");setProgress(0);setStatus("idle");setUrl("");setFileName("");setShareState("idle");setScoreChange(null)};
  const correctionKeys=result?[...result.metrics].sort((a,b)=>a.score-b.score).map(metric=>metric.key):[];
  const requestPro=(feature:string)=>{trackProductEvent("pro_feature_tapped",{source:"form",feature});document.getElementById("membership-form")?.scrollIntoView({behavior:"smooth",block:"center"});(document.getElementById("offer-email-form") as HTMLInputElement|null)?.focus({preventScroll:true})};
  const openCorrectiveWorkout=()=>{if(!proUnlocked){requestPro("corrective_workout");return}openWorkout(correctionKeys)};
  const verdict=result?(result.overall>=84?(zh?"动作整体稳定，可以继续保持。":"Your movement is stable. Keep this pattern."):result.overall>=68?(zh?"基础不错，先修正一个关键点。":"Solid base. Fix one priority first."):(zh?"先降低难度，重新建立动作控制。":"Regress the movement and rebuild control.")):"";
  return <div className="scanner-overlay"><section className="scanner-sheet">
    <header><div><small>练一下 · ONE SET · MOVEMENT SCAN</small><h2>{zh?"深蹲动作扫描":"Squat form scan"}</h2><p>{zh?"评分动作表现，不评价外貌，也不作伤病诊断。":"Scores movement performance—not appearance or injury risk."}</p></div><button onClick={close} aria-label={zh?"关闭":"Close"}>×</button></header>
    {status!=="result"&&<div className="scanner-capture">
      <div className={`scanner-preview ${url?"has-video":""}`}>{url?<video ref={videoRef} src={url} controls playsInline preload="metadata" onLoadedMetadata={()=>{if(status!=="ready"||autoAnalyzeStarted.current)return;autoAnalyzeStarted.current=true;void analyze()}} onError={()=>{setError(zh?"视频无法读取，请重新录制或选择。":"This video could not be read. Record or choose another clip.");setStatus("error")}}/>:<div><i><AppIcon name="video"/></i><strong>{zh?"拍摄 3–5 次深蹲":"Record 3–5 squats"}</strong><span>{zh?"建议正面约 45°，全身持续入镜，5–12 秒":"Use a 45° front view, full body visible, 5–12 sec"}</span></div>}</div>
      <input ref={inputRef} hidden type="file" accept="video/*" capture="environment" onChange={event=>choose(event.target.files?.[0])}/>
      {status==="idle"&&<button className="scanner-primary" onClick={()=>inputRef.current?.click()}><span>{zh?"录制或上传 · 自动分析":"Record or upload · auto analyze"}</span><b><AppIcon name="arrow-right"/></b></button>}
      {status==="ready"&&<div className="scanner-auto-start"><i/><div><strong>{zh?"视频已准备，正在自动开始…":"Video ready. Starting automatically…"}</strong><small>{fileName} · {zh?"只在此设备处理":"processed only on this device"}</small></div></div>}
      {status==="analyzing"&&<div className="scanner-loading"><div><i style={{width:`${progress}%`}}/></div><strong>{zh?"正在追踪肩、髋、膝与脚踝…":"Tracking shoulders, hips, knees, and ankles…"}</strong><span>{progress}% · {zh?"无需上传视频":"No video upload"}</span></div>}
      {status==="error"&&<div className="scanner-error"><strong>{zh?"需要重新拍摄":"Try another recording"}</strong><p>{error}</p><button onClick={reset}>{zh?"重新开始":"Start over"}</button></div>}
      <div className="scanner-privacy"><i><AppIcon name="check"/></i><p><strong>{zh?"本机分析":"On-device analysis"}</strong><span>{zh?"姿态模型在浏览器中运行，视频不会上传到服务器。":"The pose model runs in your browser; the video is not sent to our server."}</span></p></div>
    </div>}
    {status==="result"&&result&&<div className="scan-report">
      <div className="report-score"><div><small>SQUAT SCORE</small><strong>{result.overall}<span>/100</span></strong><p>{zh?`识别到 ${result.repCount} 次动作 · 置信度 ${result.confidence}%`:`${result.repCount} rep${result.repCount===1?"":"s"} observed · ${result.confidence}% confidence`}</p></div><div className={`score-ring score-${result.overall>=82?"high":result.overall>=65?"mid":"low"}`} style={{"--score":`${result.overall*3.6}deg`} as React.CSSProperties}><b>{result.overall}</b></div></div>
      <section className="instant-verdict"><small>{zh?"直接结论":"YOUR RESULT"}</small><h3>{verdict}</h3><p><b>#1</b><span><em>{zh?"第一优先级":"TOP PRIORITY"}</em>{result.suggestions[0]}</span></p><div><span><small>{zh?"下一组这样做":"NEXT SET"}</small><strong>{result.nextSet}</strong></span><button className={!proUnlocked?"locked":""} onClick={openCorrectiveWorkout}>{proUnlocked?(zh?"按这个建议训练":"Train this fix"):(zh?"解锁纠正训练":"Unlock corrective plan")}<b>{proUnlocked?"→":zh?"锁":"🔒"}</b></button></div></section>
      {proof&&<figure className="pose-proof-card"><img src={proof.url} alt={zh?"在最深深蹲画面中识别的关节":"Joints detected at the deepest squat frame"}/><figcaption><div><small>{zh?"已分析动作帧":"ANALYZED FRAME"} · {proof.time.toFixed(1)}s</small><strong>{zh?"评分依据：最深动作帧":"Why this score: deepest rep frame"}</strong><span>{zh?"肩、髋、膝与脚踝 8 个关键点均已识别":"8 key shoulder, hip, knee, and ankle joints detected"}</span></div><b><i/> {zh?"本机生成":"ON-DEVICE"}</b></figcaption></figure>}
      {proUnlocked?<details className="report-details"><summary>{zh?"查看详细评分与全部建议":"View detailed scores and all fixes"}<span>{result.metrics.length} {zh?"项":"metrics"}</span></summary><div className="report-metrics">{result.metrics.map(metric=><article key={metric.key}><i className={metric.status}>{metric.status==="good"?"✓":metric.status==="watch"?"△":"!"}</i><div><strong>{metric.label}</strong><small>{metric.detail}</small><em className={`confidence-${metric.confidenceLevel}`}>{metric.confidenceLevel==="high"?(zh?"高可信度":"HIGH CONFIDENCE"):metric.confidenceLevel==="medium"?(zh?"中等可信度":"MEDIUM CONFIDENCE"):(zh?"低可信度":"LOW CONFIDENCE")}</em></div><b>{metric.score}</b></article>)}</div>
      <section className="report-fixes"><small>{zh?"下一组先改这 3 点":"3 THINGS TO FIX"}</small>{result.suggestions.map((suggestion,index)=><p key={suggestion}><b>{index+1}</b><span>{suggestion}</span></p>)}</section>
      <section className="next-set"><i><AppIcon name="arrow-right"/></i><div><small>{zh?"下一组建议":"YOUR NEXT SET"}</small><strong>{result.nextSet}</strong></div></section>
      </details>:<ProReportGate language={language} source="form" unlock={()=>requestPro("full_report")}/>}<p className="scan-caveat">{zh?"仅基于本视频中可观察的关节轨迹；镜头角度、衣物与遮挡会影响结果。本结果不是医疗或伤病诊断。":"Based only on joint paths visible in this clip. Camera angle, clothing, and occlusion affect results. This is not medical or injury diagnosis."}</p>
      <div className="report-actions"><button className="share-card-button" disabled={shareState==="sharing"} onClick={share}>{shareState==="sharing"?(zh?"正在生成…":"Creating card…"):shareState==="shared"?(zh?"✓ 已分享":"✓ Shared"):shareState==="downloaded"?(zh?"✓ 评分卡已下载":"✓ Card downloaded"):shareState==="error"?(zh?"重试分享":"Try sharing again"):(zh?"生成分享评分卡":"Create share card")}</button><button className={!proUnlocked?"locked":""} onClick={openCorrectiveWorkout}>{proUnlocked?(zh?"生成纠正训练":"Build corrective workout"):(zh?"解锁纠正训练":"Unlock corrective workout")}<b>{proUnlocked?"→":zh?"锁":"🔒"}</b></button></div><button className="scan-again" onClick={reset}>{zh?"重新扫描":"Scan again"}</button>
      <MembershipOffer language={language} source="form" onAccessGranted={()=>setProUnlocked(true)}/>
    </div>}
  </section></div>;
}
