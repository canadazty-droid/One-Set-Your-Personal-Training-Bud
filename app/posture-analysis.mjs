const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const visible=(point,minimum=.5)=>Boolean(point)&&Number(point.visibility??1)>=minimum;
const confidenceFor=(points,indexes)=>average(indexes.map(index=>points[index]?.visibility??0));

const copy={
  zh:{
    metrics:{shoulders:["肩线水平趋势","比较肩部关键点的可观察高度差"],hips:["骨盆水平趋势","比较髋部关键点的可观察高度差"],torso:["躯干居中趋势","肩部中心与髋部中心的相对位置"],stance:["站姿左右趋势","比较双侧可观察的腿部线段"],head:["头肩位置趋势","侧面照片中耳部与肩部的相对位置"]},
    fixes:{shoulders:"先确认相机保持水平；若多次扫描都出现相同趋势，可在训练中加入墙滑与轻重量划船。",hips:"先确认双脚站位和相机高度一致；若趋势重复出现，可加入支撑分腿蹲与臀桥。",torso:"拍照时站在画面中央；若多次扫描仍相似，可加入 Pallof Press 等抗旋转训练。",stance:"确保双脚完整入镜并平均承重；若趋势持续，可从支撑式单腿动作开始练习控制。",head:"保持自然目视前方，避免为了拍照刻意抬头；训练前可加入轻柔的颈胸椎活动。"},
    next:"7 天后在相同距离、光线和站位下重新拍摄，比较趋势变化。"
  },
  en:{
    metrics:{shoulders:["Shoulder-level trend","Observable height difference between shoulder landmarks"],hips:["Pelvis-level trend","Observable height difference between hip landmarks"],torso:["Torso-centering trend","Relative position of shoulder and hip centers"],stance:["Left/right stance trend","Comparison of visible leg segments"],head:["Head-to-shoulder trend","Ear position relative to the shoulder in the side photo"]},
    fixes:{shoulders:"First confirm the camera is level. If the same trend repeats, add wall slides and light supported rows.",hips:"Confirm even foot position and camera height. If the trend repeats, add supported split squats and bridges.",torso:"Stand in the center of the frame. If repeated scans look similar, add anti-rotation work such as a Pallof press.",stance:"Keep both feet visible and share pressure evenly. If the trend persists, begin with supported single-leg control drills.",head:"Look naturally forward without posing. Add gentle neck and upper-back movement before training if useful."},
    next:"Retake the same photos in seven days using the same distance, lighting, and stance to compare trends."
  }
};

const metric=(key,score,confidence,local)=>({key,score:Math.round(clamp(score,45,98)),label:local.metrics[key][0],detail:local.metrics[key][1],confidence:confidence>=.88?"high":confidence>=.68?"medium":"low",assessed:confidence>=.5});
const unavailableMetric=(key,local,language)=>({key,score:0,label:local.metrics[key][0],detail:language==="zh"?"添加侧面照片后可评估头肩位置趋势。":"Add a side photo to assess this trend.",confidence:"low",assessed:false});

export function analyzePosturePhotos(photos,language="en"){
  const local=copy[language]||copy.en;
  const front=photos.front;
  const side=photos.side;
  const back=photos.back;
  if(!front)throw new Error(language==="zh"?"需要一张正面照片才能建立快速趋势基准。":"A front photo is required to create a quick trend baseline.");
  const required=[7,8,11,12,23,24,25,26,27,28];
  if(required.filter(index=>visible(front[index],.35)).length<8)throw new Error(language==="zh"?"正面照片没有持续识别到完整身体。请让头、肩、髋、膝、脚踝和双脚完整入镜。":"The front photo does not show enough of the body. Keep the head, shoulders, hips, knees, ankles, and feet in frame.");
  if(side&&[7,8,11,12,23,24].filter(index=>visible(side[index],.3)).length<4)throw new Error(language==="zh"?"侧面照片看不清头、肩或髋部，请从更远处重新拍摄。":"The side photo does not clearly show the head, shoulders, or hips. Retake it from farther away.");

  const frontal=[front,...(back?[back]:[])];
  const shoulderScores=frontal.map(points=>{
    const width=Math.max(.04,distance(points[11],points[12]));
    return 100-Math.abs(points[11].y-points[12].y)/width*115;
  });
  const hipScores=frontal.map(points=>{
    const width=Math.max(.04,distance(points[23],points[24]));
    return 100-Math.abs(points[23].y-points[24].y)/width*115;
  });
  const torsoScores=frontal.map(points=>{
    const shoulder=midpoint(points[11],points[12]);const hip=midpoint(points[23],points[24]);
    const width=Math.max(.04,distance(points[11],points[12]));
    return 100-Math.abs(shoulder.x-hip.x)/width*105;
  });
  const stanceScores=frontal.map(points=>{
    const left=distance(points[23],points[25])+distance(points[25],points[27]);
    const right=distance(points[24],points[26])+distance(points[26],points[28]);
    return 100-Math.abs(left-right)/Math.max(.08,(left+right)/2)*150;
  });
  let headMetric=unavailableMetric("head",local,language);
  if(side){
    const ear=midpoint(side[7],side[8]);const shoulder=midpoint(side[11],side[12]);const hip=midpoint(side[23],side[24]);
    const torsoLength=Math.max(.08,distance(shoulder,hip));
    const headScore=100-Math.max(0,Math.abs(ear.x-shoulder.x)/torsoLength-.06)*175;
    headMetric=metric("head",headScore,confidenceFor(side,[7,8,11,12,23,24]),local);
  }
  const frontalConfidence=average(frontal.map(points=>confidenceFor(points,[11,12,23,24,25,26,27,28])));
  const metrics=[
    metric("shoulders",average(shoulderScores),frontalConfidence,local),
    metric("hips",average(hipScores),frontalConfidence,local),
    metric("torso",average(torsoScores),frontalConfidence,local),
    metric("stance",average(stanceScores),frontalConfidence,local),
    headMetric
  ];
  const assessed=metrics.filter(item=>item.assessed);
  const overall=Math.round(average(assessed.map(item=>item.score)));
  const confidence=Math.round(average(assessed.map(item=>item.confidence==="high"?94:item.confidence==="medium"?76:55)));
  const priorities=[...assessed].sort((a,b)=>a.score-b.score).slice(0,3).map(item=>({key:item.key,title:item.label,text:local.fixes[item.key]}));
  return {overall,confidence,metrics,priorities,next:local.next,photoCount:1+Number(Boolean(side))+Number(Boolean(back))};
}
