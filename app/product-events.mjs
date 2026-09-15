const SESSION_KEY="form-ai-product-session-v1";
const PRICING_VARIANT_KEY="form-ai-pricing-variant-v1";

function storedValue(key,create){
  try{const current=window.localStorage.getItem(key);if(current)return current;const next=create();window.localStorage.setItem(key,next);return next}catch{return create()}
}

export function getPricingVariant(){
  return storedValue(PRICING_VARIANT_KEY,()=>Math.random()<.5?"control":"coach_anchor")==="coach_anchor"?"coach_anchor":"control";
}

export function getProductSession(){
  if(typeof window==="undefined")return"";
  return storedValue(SESSION_KEY,()=>crypto.randomUUID());
}

export function trackProductEvent(eventName,properties={}){
  if(typeof window==="undefined")return;
  const sessionId=getProductSession();
  const payload={eventName,sessionId,source:typeof properties.source==="string"?properties.source:undefined,variant:typeof properties.variant==="string"?properties.variant:undefined,metadata:Object.fromEntries(Object.entries(properties).filter(([key])=>key!=="source"&&key!=="variant"))};
  void fetch("/api/product-events",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),keepalive:true}).catch(()=>{});
}
