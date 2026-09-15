"use client";

import {useEffect,useState} from "react";
import {AppIcon} from "./ui-icons";
import {getExerciseTutorial} from "./exercise-tutorials";
import {getUserProfile,saveUserProfile} from "../lib/storage/userStore";

export default function StartScreen({onEnter}:{onEnter:()=>void}) {
  const [language,setLanguage]=useState<"zh"|"en">("zh");
  const [entering,setEntering]=useState(false);
  const [videoFailed,setVideoFailed]=useState(false);
  const tutorial=getExerciseTutorial("Dumbbell_Goblet_Squat");
  useEffect(()=>{const reset=()=>setEntering(false);window.addEventListener("pageshow",reset);return()=>window.removeEventListener("pageshow",reset)},[]);
  useEffect(()=>{const saved=getUserProfile<{language?:string}>();if(saved?.language==="en")setLanguage("en")},[]);
  const zh=language==="zh";
  const chooseLanguage=(next:"zh"|"en")=>{setLanguage(next);saveUserProfile({...getUserProfile<Record<string,unknown>>(),language:next})};
  const enter=()=>{if(entering)return;setEntering(true);onEnter()};
  return <main className="start-screen welcome-product" lang={zh?"zh-CN":"en"}>
    <header className="start-header">
      <span className="start-brand">练一下 <span>· ONE SET</span></span>
      <div className="start-language" role="group" aria-label={zh?"界面语言":"Language"}>
        <button aria-pressed={zh} onClick={()=>chooseLanguage("zh")}>中</button>
        <button aria-pressed={!zh} onClick={()=>chooseLanguage("en")}>EN</button>
      </div>
    </header>
    <section className="start-content" aria-labelledby="start-title">
      <div className="start-intro">
        <p className="start-eyebrow"><AppIcon name="starter"/>{zh?"为第一次开始，也为每一次回来":"FOR YOUR FIRST SET. AND YOUR NEXT."}</p>
        <h1 id="start-title">{zh?<>今天，<br/>从<span>一组</span>开始。</>:<>Start small.<br/>Make it<span> one set.</span></>}</h1>
        <p className="start-description">{zh?"不知道练什么？选好器械和时间，剩下的一步步来。":"Not sure what to train? Choose your equipment and time. We’ll guide you from there."}</p>
    <div className="welcome-entry">
      <div><strong>{zh?"选好器械和时间，就能生成训练":"Choose your equipment and time"}</strong><p id="welcome-next-step">{zh?"进入后直接选择，不需要注册或填写问卷。":"Choose directly. No sign-up or questionnaire."}</p></div>
      <button className="start-primary" disabled={entering} aria-busy={entering} aria-describedby="welcome-next-step" onClick={enter}>{entering?(zh?"正在进入…":"Opening…"):(zh?"进入训练首页":"Go to workout setup")}<AppIcon name="arrow-right"/></button>
    </div>
        <ol className="welcome-journey" aria-label={zh?"训练流程":"Workout flow"}>
          <li><span>01</span><strong>{zh?"选好训练":"Build"}</strong></li>
          <li><span>02</span><strong>{zh?"跟着练习":"Follow"}</strong></li>
          <li><span>03</span><strong>{zh?"记录进步":"Record"}</strong></li>
        </ol>
        <p className="welcome-reassurance"><AppIcon name="check"/>{zh?"不用先懂健身，也不必一次做得完美。":"You don’t need experience. You don’t need a perfect first workout."}</p>
      </div>
    </section>
      {tutorial&&<details className="welcome-video-details"><summary>{zh?"想先看看动作教学？（可选）":"Preview a movement tutorial (optional)"}<AppIcon name="video"/></summary><figure className="welcome-demo">
        <div className="welcome-demo-heading"><span>{zh?"先认识跟练体验":"A LOOK AT GUIDED TRAINING"}</span><AppIcon name="video"/></div>
        <div className="welcome-demo-media">{videoFailed?<div className="welcome-video-error" role="status"><AppIcon name="video"/><p>{zh?"视频暂时无法播放，你仍可进入训练。":"Video unavailable. You can still start your workout."}</p><button onClick={()=>setVideoFailed(false)}>{zh?"重新加载视频":"Retry video"}</button></div>:<video controls playsInline preload="none" poster={tutorial.poster} width="1080" height="1920" src={tutorial.src} aria-label={zh?"哑铃高脚杯深蹲教学片段":"Dumbbell goblet squat demonstration"} onError={()=>setVideoFailed(true)}/>}</div>
        <figcaption><div><strong>{zh?"哑铃高脚杯深蹲":"Dumbbell goblet squat"}</strong><span>{zh?"教学片段 · 不是为你生成的训练":"Demo only · Your workout is built next"}</span></div><a href={tutorial.sourceUrl} target="_blank" rel="noreferrer">Your Move ↗</a></figcaption>
      </figure></details>}
      <details className="start-guide welcome-details">
        <summary>{zh?"第一次用？了解怎么完成一次训练":"First time? See how a workout works"}<AppIcon name="plus"/></summary>
        <ol>
          <li><span className="start-step-icon"><AppIcon name="workout"/></span><div><span className="start-number">01</span><h3>{zh?"选好器械，生成训练":"Choose equipment. Build a workout."}</h3><p>{zh?"没有器械也能练。选时间、说需求，或直接用推荐。":"No equipment is fine. Set your time, describe your needs, or use today’s pick."}</p></div></li>
          <li><span className="start-step-icon"><AppIcon name="play"/></span><div><span className="start-number">02</span><h3>{zh?"先看教学，再做一组":"Learn the movement. Do one set."}</h3><p>{zh?"页面会告诉你做几次、休息多久。不会做或太难，随时打开帮助。":"See how many reps to do and when to rest. Open help whenever you need it."}</p></div></li>
          <li><span className="start-step-icon"><AppIcon name="check"/></span><div><span className="start-number">03</span><h3>{zh?"记下感受，下次更合适":"Log how it felt. Adapt next time."}</h3><p>{zh?"记录难度、精力和酸痛，下一次训练会参考你的反馈。":"Record difficulty, energy and soreness. Your feedback informs your next workout."}</p></div></li>
        </ol>
      </details>
    <footer className="start-footer"><AppIcon name="info"/><p>{zh?"无需注册 · 记录保存在当前设备；清除浏览器数据可能丢失记录。":"No sign-up needed. Records stay on this device; clearing browser data may erase them."}</p></footer>

  </main>;
}
