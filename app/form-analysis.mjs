const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const angle=(a,b,c)=>{
  const first=Math.atan2(a.y-b.y,a.x-b.x);
  const second=Math.atan2(c.y-b.y,c.x-b.x);
  let degrees=Math.abs((first-second)*180/Math.PI);
  if(degrees>180)degrees=360-degrees;
  return degrees;
};
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const visible=(landmark,minimum=.42)=>Boolean(landmark)&&Number(landmark.visibility??1)>=minimum;

const copy={
  zh:{
    depth:["深蹲深度","髋部下降幅度"],tracking:["膝盖轨迹","膝盖与脚尖方向"],symmetry:["左右对称","双侧膝角差异"],torso:["躯干稳定","肩线与骨盆控制"],tempo:["动作节奏","下蹲与起身一致性"],
    fixes:{depth:"下一组使用较轻重量或徒手，保持脚跟着地，在能稳定控制的范围内逐步加深。",tracking:"让膝盖顺着第二、三脚趾方向移动；必要时缩小幅度并放慢下蹲。",symmetry:"先降低重量，平均分配双脚压力；从正前方再拍一组确认左右轨迹。",torso:"下蹲前轻收核心，胸口与骨盆一起移动，避免一侧肩膀先下沉。",tempo:"用约 3 秒下蹲、短暂停顿、稳定起身；每次重复保持相近速度。"},
    next:{low:"下一组先改为徒手或明显减重，只做 5 次可控重复，然后重新拍摄。",mid:"下一组保持当前重量，优先应用排名第一的提示，完成 6–8 次后再扫描。",high:"下一组保持相同重量再验证一次；如果评分仍稳定，可小幅加重。"}
  },
  en:{
    depth:["Squat depth","Observable hip descent"],tracking:["Knee tracking","Knees relative to toes"],symmetry:["Left/right symmetry","Difference between knee angles"],torso:["Torso stability","Shoulder and pelvis control"],tempo:["Rep tempo","Consistency down and up"],
    fixes:{depth:"Use bodyweight or a lighter load next set. Keep your heels grounded and deepen only through a range you can control.",tracking:"Guide each knee toward the second and third toe. Reduce range and slow the descent if needed.",symmetry:"Reduce load and share pressure evenly through both feet. Film the next set from the front to confirm the pattern.",torso:"Brace gently before descending and move the chest and pelvis together without dropping one shoulder first.",tempo:"Use about a three-second descent, a brief pause, and a steady ascent. Keep each rep at a similar speed."},
    next:{low:"Switch to bodyweight or reduce the load clearly, perform five controlled reps, then scan again.",mid:"Keep the same load, apply the top cue, and scan again after 6–8 controlled reps.",high:"Repeat once at the same load to confirm the score. If it stays stable, increase the load slightly."}
  }
};

export function analyzeSquatFrames(frames,language="en"){
  const local=copy[language]||copy.en;
  const usable=frames.filter(frame=>{
    const points=frame.landmarks||[];
    return [11,12,23,24,25,26,27,28,31,32].every(index=>visible(points[index]));
  });
  if(usable.length<8)throw new Error(language==="zh"?"没有持续识别到全身。请退后一步，让肩、髋、膝、脚踝和双脚完整入镜。":"Your full body was not visible long enough. Step back so shoulders, hips, knees, ankles, and feet stay in frame.");

  const samples=usable.map(frame=>{
    const p=frame.landmarks;
    const leftKnee=angle(p[23],p[25],p[27]);
    const rightKnee=angle(p[24],p[26],p[28]);
    const kneeAngle=(leftKnee+rightKnee)/2;
    const hipY=(p[23].y+p[24].y)/2;
    const kneeY=(p[25].y+p[26].y)/2;
    const shoulderWidth=Math.max(.035,Math.abs(p[11].x-p[12].x));
    const hipWidth=Math.max(.035,Math.abs(p[23].x-p[24].x));
    const leftTrack=Math.abs(p[25].x-p[31].x)/Math.max(shoulderWidth,hipWidth);
    const rightTrack=Math.abs(p[26].x-p[32].x)/Math.max(shoulderWidth,hipWidth);
    return {time:frame.time,leftKnee,rightKnee,kneeAngle,hipY,kneeY,track:(leftTrack+rightTrack)/2,shoulderTilt:Math.abs(p[11].y-p[12].y)/shoulderWidth,hipTilt:Math.abs(p[23].y-p[24].y)/hipWidth,confidence:average([11,12,23,24,25,26,27,28,31,32].map(index=>p[index].visibility??1))};
  });
  const deepest=samples.reduce((best,current)=>current.kneeAngle<best.kneeAngle?current:best,samples[0]);
  const depthRelative=(deepest.kneeY-deepest.hipY)/.16;
  const depthScore=Math.round(clamp(65-depthRelative*28+(135-deepest.kneeAngle)*.42,45,98));
  const symmetryScore=Math.round(clamp(100-Math.abs(deepest.leftKnee-deepest.rightKnee)*2.25,45,98));
  const trackingScore=Math.round(clamp(100-deepest.track*78,45,98));
  const torsoScore=Math.round(clamp(100-(deepest.shoulderTilt*62+deepest.hipTilt*38),45,98));

  const repTimes=[];
  let below=false;
  let descentStart=samples[0].time;
  for(const sample of samples){
    if(!below&&sample.kneeAngle<138){below=true;descentStart=sample.time;}
    if(below&&sample.kneeAngle>155){if(sample.time-descentStart>.45)repTimes.push(sample.time-descentStart);below=false;}
  }
  const repCount=Math.max(repTimes.length,deepest.kneeAngle<145?1:0);
  const tempoVariation=repTimes.length>1?Math.sqrt(average(repTimes.map(value=>(value-average(repTimes))**2)))/Math.max(.1,average(repTimes)):0.22;
  const tempoScore=Math.round(clamp(96-tempoVariation*90,55,96));
  const confidence=Math.round(clamp(average(samples.map(sample=>sample.confidence))*100,50,99));
  const values={depth:depthScore,tracking:trackingScore,symmetry:symmetryScore,torso:torsoScore,tempo:tempoScore};
  const overall=Math.round(clamp(depthScore*.25+trackingScore*.25+symmetryScore*.2+torsoScore*.2+tempoScore*.1,45,98));
  const ordered=Object.entries(values).sort((a,b)=>a[1]-b[1]);
  const metrics=Object.entries(values).map(([key,score])=>({key,score,label:local[key][0],detail:local[key][1],status:score>=84?"good":score>=70?"watch":"fix",confidenceLevel:confidence>=86&&(key==="depth"||key==="tempo")?"high":confidence>=68?"medium":"low"}));
  const suggestions=ordered.slice(0,3).map(([key])=>local.fixes[key]);
  return {overall,confidence,repCount,metrics,suggestions,nextSet:overall<65?local.next.low:overall<82?local.next.mid:local.next.high,deepestKneeAngle:Math.round(deepest.kneeAngle)};
}
