"use client";
import {useState} from "react";

// Original-publisher embeds only; these are not licensed downloads.
const sources:Record<string,{id:string;author:string;source:string}>={
  "Wall_Push-Up":{id:"G_c3QztMZNQ",author:"BESS / NHS",source:"https://www.cht.nhs.uk/services/clinical-services/physiotherapy-outpatients/shoulder/subacromial-pain"},
  Bird_Dog:{id:"ZdAHe9_HeEw",author:"NASM",source:"https://www.nasm.org/resource-center/exercise-library/bird-dog"},
};
export function hasExternalTutorial(id:string){return Boolean(sources[id])}
export default function ExternalTutorial({id,zh}:{id:string;zh:boolean}){
  const[open,setOpen]=useState(false);
  const source=sources[id];
  if(!source)return null;
  return <section className="external-tutorial">
    <button type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>{open?(zh?"收起视频":"Close video"):(zh?"播放真人教学（英语）":"Play coach tutorial (English)")}</button>
    {open&&<iframe title={zh?"真人动作教学":"Exercise video tutorial"} src={`https://www.youtube-nocookie.com/embed/${source.id}`} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{width:"100%",aspectRatio:"16 / 9",border:0}}/>}
    <p>{zh?"由原作者提供，需要联网；不加载时可打开原站。动作次数按本 App 的计划执行。":"Hosted by the publisher; internet required. If unavailable, open the source. Follow this app’s prescribed reps."}</p>
    <a href={source.source} target="_blank" rel="noreferrer">{zh?"打开原站教学":"Open original tutorial"} · {source.author} ↗</a>
  </section>;
}
