"use client";

import {useEffect,useRef,useState} from "react";
import {getPricingVariant,trackProductEvent} from "./product-events.mjs";
import {grantProAccess,hasProAccess} from "./pro-access.mjs";

type Language="zh"|"en";
type Plan="monthly"|"annual";
type Source="form"|"posture";
type Variant="control"|"coach_anchor";

export default function MembershipOffer({language,source="posture",onAccessGranted}:{language:Language;source?:Source;onAccessGranted?:()=>void}){
  const zh=language==="zh";
  const[plan,setPlan]=useState<Plan>("annual");
  const[status,setStatus]=useState<"idle"|"saving"|"reserved"|"error">("idle");
  const[variant,setVariant]=useState<Variant>("control");
  const[anonymous,setAnonymous]=useState(false);
  const[email,setEmail]=useState("");
  const tracked=useRef(false);

  useEffect(()=>{
    const assigned=getPricingVariant();setVariant(assigned);
    if(hasProAccess()){setStatus("reserved");onAccessGranted?.()}
    if(!tracked.current){trackProductEvent("paywall_viewed",{source,variant:assigned});tracked.current=true}
    let cancelled=false;
    fetch("/api/membership-interest",{cache:"no-store"}).then(response=>response.ok?response.json():null).then(data=>{
      if(cancelled||!data)return;
      setAnonymous(data.authenticated===false);
      if(data.interest){setPlan(data.interest.selectedPlan==="monthly"?"monthly":"annual");setStatus("reserved");grantProAccess();onAccessGranted?.()}
    }).catch(()=>{});
    return()=>{cancelled=true};
  },[source]);

  const choose=(next:Plan)=>{setPlan(next);if(status==="reserved")setStatus("idle");trackProductEvent("pricing_plan_selected",{source:"pricing",variant,plan:next,scanType:source})};
  const reserve=async()=>{
    if(anonymous&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())){setStatus("error");return}
    setStatus("saving");
    try{
      const response=await fetch("/api/membership-interest",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({selectedPlan:plan,...(anonymous?{email:email.trim()}: {})})});
      if(!response.ok)throw new Error();
      setStatus("reserved");grantProAccess();onAccessGranted?.();
      trackProductEvent("founding_price_reserved",{source:"pricing",variant,plan,scanType:source,visitor:anonymous?"anonymous":"signed_in"});
      trackProductEvent("pro_access_granted",{source,plan,mode:"founding_beta"});
    }catch{setStatus("error")}
  };
  const anchored=variant==="coach_anchor";
  const alternate=plan==="annual"?"monthly":"annual";

  return <section id={`membership-${source}`} className={`membership-offer compact-offer experiment-${variant}`}>
    <header><div><small>练一下 · ONE SET PRO · FOUNDING BETA</small><h3>{anchored?(zh?"先体验完整教练报告，再决定是否订阅":"See your full coach report first. Decide on membership later."):(zh?"解锁完整报告与针对性训练":"Unlock the full report and corrective plan")}</h3><p>{zh?"完整指标 · 针对性训练 · 每周复扫进度":"All metrics · corrective workouts · weekly progress"}</p></div><i>PRO</i></header>
    {anchored&&<div className="offer-anchor-inline"><span>{zh?"私教":"PT SESSION"} <b>$50–150</b></span><i>VS</i><span>ONE SET <b>$49.99/{zh?"年":"YR"}</b></span></div>}
    {anonymous&&<label className={`offer-email ${status==="error"?"invalid":""}`}><span>{zh?"输入邮箱立即解锁":"EMAIL TO UNLOCK NOW"}</span><input id={`offer-email-${source}`} type="email" value={email} onChange={event=>{setEmail(event.target.value);if(status==="error")setStatus("idle")}} placeholder={zh?"你的邮箱":"you@example.com"} autoComplete="email"/><b>↗</b></label>}
    <div className="offer-beta-steps" aria-label={zh?"创始测试流程":"Founding beta flow"}><span><b>01</b>{zh?"现在解锁完整报告":"Unlock full report now"}</span><span><b>02</b>{zh?"完成你的纠正训练":"Complete your corrective session"}</span><span><b>03</b>{zh?"付费前再次确认":"Confirm separately before billing"}</span></div>
    <div className="offer-choice-row"><div className="offer-plan-summary"><small>{plan==="annual"?(zh?"创始价格偏好 · 年付":"FOUNDING PRICE PREFERENCE · ANNUAL"):(zh?"创始价格偏好 · 月付":"FOUNDING PRICE PREFERENCE · MONTHLY")}</small><strong>{plan==="annual"?"$49.99":"$7.99"}<span>/{plan==="annual"?(zh?"年":"year"):(zh?"月":"month")}</span></strong><em>{plan==="annual"?(zh?"约 $4.17/月":"About $4.17/month"):(zh?"按月选择":"Monthly option")}</em></div><button className="offer-plan-switch" onClick={()=>choose(alternate)}>{plan==="annual"?(zh?"改选月付 · $7.99/月":"Prefer monthly · $7.99/mo"):(zh?"改选年付 · 节省更多":"Choose annual · save more")}</button></div>
    <button className={`reserve-offer ${status}`} disabled={status==="saving"||status==="reserved"} onClick={reserve}>{status==="saving"?(zh?"正在解锁…":"Unlocking…"):status==="reserved"?(zh?"✓ 完整报告已解锁":"✓ Full report unlocked"):(anonymous?(zh?"加入创始测试并解锁":"Join founding beta & unlock"):(zh?"保留创始价格并解锁":"Reserve founding price & unlock"))}<b>{status==="idle"?"→":""}</b></button>
    <p className={status==="error"?"offer-error":""}>{status==="error"?(anonymous?(zh?"请输入有效邮箱。":"Enter a valid email address."):(zh?"暂时无法保存，请稍后重试。":"Could not save this yet. Try again later.")):(zh?"今天不会收费。现在解锁本次报告；任何正式扣费前，我们都会再次征得你的确认。":"No charge today. Unlock this report now; any billing requires a separate confirmation first.")}</p>
  </section>;
}
