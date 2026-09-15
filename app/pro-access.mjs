const ACCESS_KEY="purefitness-founding-beta-access-v1";

export function hasProAccess(){
  if(typeof window==="undefined")return false;
  try{return window.localStorage.getItem(ACCESS_KEY)==="granted"}catch{return false}
}

export function grantProAccess(){
  if(typeof window==="undefined")return false;
  try{window.localStorage.setItem(ACCESS_KEY,"granted");return true}catch{return false}
}

export function clearProAccessForTest(){
  if(typeof window==="undefined")return;
  try{window.localStorage.removeItem(ACCESS_KEY)}catch{/* storage unavailable */}
}
