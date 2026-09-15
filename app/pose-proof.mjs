export const PROOF_JOINTS=[11,12,23,24,25,26,27,28];
export const PROOF_CONNECTIONS=[[11,12],[11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28]];

const visible=(point)=>Boolean(point)&&Number(point.visibility??1)>=.42;
const angle=(a,b,c)=>{
  const first=Math.atan2(a.y-b.y,a.x-b.x),second=Math.atan2(c.y-b.y,c.x-b.x);
  let degrees=Math.abs((first-second)*180/Math.PI);if(degrees>180)degrees=360-degrees;return degrees;
};

export function selectDeepestSquatFrame(frames){
  const usable=frames.filter(frame=>PROOF_JOINTS.every(index=>visible(frame.landmarks?.[index])));
  if(!usable.length)return null;
  return usable.reduce((best,current)=>{
    const score=averageKneeAngle(current.landmarks),bestScore=averageKneeAngle(best.landmarks);
    return score<bestScore?current:best;
  },usable[0]);
}

export function averageKneeAngle(points){
  return (angle(points[23],points[25],points[27])+angle(points[24],points[26],points[28]))/2;
}
