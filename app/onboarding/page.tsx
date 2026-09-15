"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateVersionBTrainingPlan } from "../../lib/training/plan-generator.mjs";
import { saveFourWeekPlan,saveReadinessProfile } from "../../lib/storage/planStore";
import { saveUserProfile } from "../../lib/storage/userStore";

type Language = "zh" | "en";
const initial = { name: "", goal: "", training_experience: "", weekly_training_days: "3", session_length_minutes: "45", available_equipment: "gym", preferred_focus: "flexible", injuries_or_limitations: "", current_energy_level: "7", current_soreness_level: "3" };
const requiredFields = ["name", "goal", "training_experience", "weekly_training_days", "session_length_minutes", "available_equipment"] as const;

export default function OnboardingPage() {
  const [language,setLanguage]=useState<Language>("zh");const[form,setForm]=useState(initial);const[error,setError]=useState("");const[saving,setSaving]=useState(false);const router=useRouter();const zh=language==="zh";
  const field=(name:keyof typeof form,value:string)=>setForm(current=>({...current,[name]:value}));
  async function submit(event:React.FormEvent){
    event.preventDefault();const missing=requiredFields.filter(key=>!form[key].trim());
    if(missing.length){setError(zh?"请先完成所有必填项目。":"Complete every required field first.");document.getElementById(missing[0])?.focus();return}
    setSaving(true);setError("");
    const equipment=form.available_equipment==="dumbbells"?"dumbbell":form.available_equipment==="mixed"?"gym":form.available_equipment;
    const trainingGoal=form.goal==="fat_loss"?"fatloss":form.goal==="muscle_gain"?"muscle":form.goal==="strength"?"strength":"general";
    const focusMap:Record<string,string>={full_body:"full",upper_lower:"upper",push_pull_legs:"pushpull",flexible:"full"};
    const recovery=Number(form.current_energy_level)<=4||Number(form.current_soreness_level)>=8?"low":Number(form.current_energy_level)>=8&&Number(form.current_soreness_level)<=4?"high":"normal";
    const engineProfile={name:form.name,gender:"unspecified",age:30,height_cm:170,weight_kg:70,goal:form.goal,training_experience:form.training_experience,weekly_training_days:Number(form.weekly_training_days),session_length_minutes:Number(form.session_length_minutes),available_equipment:equipment,injuries_or_limitations:form.injuries_or_limitations||"none",preferred_training_style:form.preferred_focus,current_energy_level:Number(form.current_energy_level),current_soreness_level:Number(form.current_soreness_level)};
    const fourWeekPlan=generateVersionBTrainingPlan(engineProfile);
    saveFourWeekPlan(fourWeekPlan);
    saveReadinessProfile({energy:Number(form.current_energy_level),soreness:Number(form.current_soreness_level),preferredFocus:form.preferred_focus,updatedAt:new Date().toISOString()});
    saveUserProfile({language,profileName:form.name,trainingGoal,weeklyGoal:Number(form.weekly_training_days),equipment,level:form.training_experience,noviceMode:form.training_experience==="beginner",duration:Number(form.session_length_minutes),focus:focusMap[form.preferred_focus]||"full",builderMode:"advanced",advancedProfile:{experience:form.training_experience==="beginner"?"new":form.training_experience==="intermediate"?"regular":"advanced",weeklyDays:Number(form.weekly_training_days),recovery,painAreas:[],heightCm:"",weightKg:"",notes:form.injuries_or_limitations}});
    const response=await fetch("/api/profile",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:form.name,trainingGoal,level:form.training_experience,weeklyDays:Number(form.weekly_training_days),session_length_minutes:Number(form.session_length_minutes),equipment,injuries_or_limitations:form.injuries_or_limitations||"none",preferred_training_style:form.preferred_focus,advancedProfile:{experience:form.training_experience==="beginner"?"new":form.training_experience==="intermediate"?"regular":"advanced",weeklyDays:Number(form.weekly_training_days),recovery,painAreas:[],heightCm:"",weightKg:""}})}).catch(()=>null);
    if(response?.ok){await fetch("/api/plans/generate",{method:"POST"}).catch(()=>null);router.push("/dashboard");return}
    router.push("/?onboarded=1");
  }
  const copy={goal:[{v:"fat_loss",zh:"减脂",en:"Fat loss"},{v:"muscle_gain",zh:"增肌",en:"Muscle gain"},{v:"strength",zh:"力量",en:"Strength"},{v:"recomposition",zh:"塑形",en:"Recomposition"},{v:"general_fitness",zh:"综合体能",en:"General fitness"}],focus:[{v:"flexible",zh:"灵活安排",en:"Flexible"},{v:"full_body",zh:"全身",en:"Full body"},{v:"upper_lower",zh:"上下肢",en:"Upper / lower"},{v:"push_pull_legs",zh:"推拉腿",en:"Push / pull / legs"}]} as const;
  return <main className="os-page onboarding-page version-b-onboarding"><header className="onboarding-brand"><a href="/">练一下 <span>ONE SET</span></a><div><button className={language==="zh"?"active":""} onClick={()=>setLanguage("zh")}>中文</button><button className={language==="en"?"active":""} onClick={()=>setLanguage("en")}>EN</button></div></header><section className="os-intro"><small>ONE SET · 2 MIN SETUP</small><h1>{zh?"告诉我们最重要的几件事。":"Tell us only what matters."}</h1><p>{zh?"生成四周训练计划；不登录也可以保存到当前设备。":"Build a four-week plan. No sign-in required—your device can save it."}</p></section><form className="os-form onboarding-core-form" onSubmit={submit} noValidate>
    <label>{zh?"你的称呼":"Your name"}<input id="name" value={form.name} maxLength={80} onChange={e=>field("name",e.target.value)} required autoComplete="name"/></label>
    <label>{zh?"主要目标":"Primary goal"}<select id="goal" value={form.goal} onChange={e=>field("goal",e.target.value)} required><option value="">{zh?"请选择":"Select"}</option>{copy.goal.map(item=><option value={item.v} key={item.v}>{zh?item.zh:item.en}</option>)}</select></label>
    <label>{zh?"训练经验":"Experience"}<select id="training_experience" value={form.training_experience} onChange={e=>field("training_experience",e.target.value)} required><option value="">{zh?"请选择":"Select"}</option><option value="beginner">{zh?"新手":"Beginner"}</option><option value="intermediate">{zh?"有经验":"Intermediate"}</option><option value="advanced">{zh?"高阶":"Advanced"}</option></select></label>
    <label>{zh?"每周训练":"Days per week"}<select id="weekly_training_days" value={form.weekly_training_days} onChange={e=>field("weekly_training_days",e.target.value)}>{[2,3,4,5,6].map(value=><option key={value} value={value}>{value} {zh?"天":"days"}</option>)}</select></label>
    <label>{zh?"每次时长":"Session length"}<select id="session_length_minutes" value={form.session_length_minutes} onChange={e=>field("session_length_minutes",e.target.value)}>{[20,30,45,60].map(value=><option key={value} value={value}>{value} {zh?"分钟":"min"}</option>)}</select></label>
    <label>{zh?"可用器械":"Equipment"}<select id="available_equipment" value={form.available_equipment} onChange={e=>field("available_equipment",e.target.value)}><option value="bodyweight">{zh?"徒手":"Bodyweight"}</option><option value="dumbbells">{zh?"哑铃":"Dumbbells"}</option><option value="gym">{zh?"健身房":"Gym"}</option><option value="mixed">{zh?"混合":"Mixed"}</option></select></label>
    <label className="wide">{zh?"偏好训练方式（可选）":"Preferred split (optional)"}<select value={form.preferred_focus} onChange={e=>field("preferred_focus",e.target.value)}>{copy.focus.map(item=><option value={item.v} key={item.v}>{zh?item.zh:item.en}</option>)}</select></label>
    <fieldset className="wide readiness-fields"><legend>{zh?"今天的状态":"How you feel today"}</legend><label><span>{zh?"精力":"Energy"}<b>{form.current_energy_level}/10</b></span><input type="range" min="1" max="10" value={form.current_energy_level} onChange={e=>field("current_energy_level",e.target.value)}/></label><label><span>{zh?"酸痛":"Soreness"}<b>{form.current_soreness_level}/10</b></span><input type="range" min="1" max="10" value={form.current_soreness_level} onChange={e=>field("current_soreness_level",e.target.value)}/></label></fieldset>
    <label className="wide">{zh?"伤病或限制（可跳过）":"Injuries or limitations (optional)"}<textarea maxLength={500} value={form.injuries_or_limitations} onChange={e=>field("injuries_or_limitations",e.target.value)} placeholder={zh?"例如：膝盖不适；没有可留空":"e.g. knee discomfort; leave blank if none"}/></label>
    {error&&<p className="os-error wide" role="alert">{error}</p>}<button className="os-primary wide" disabled={saving} aria-busy={saving}>{saving?(zh?"正在生成四周计划…":"Building your four-week plan…"):(zh?"生成我的四周计划":"Build my four-week plan")} →</button><p className="onboarding-privacy wide">{zh?"训练资料默认保存在当前设备；登录后可同步到个人账户。":"Training data stays on this device by default and can sync after sign-in."}</p>
  </form></main>;
}
