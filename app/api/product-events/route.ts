import {NextResponse} from "next/server";
import {getDb} from "../../../db";
import {productEvents} from "../../../db/schema";
import {getChatGPTUser} from "../../chatgpt-auth";

export const dynamic="force-dynamic";

const allowedEvents=new Set(["scan_opened","scan_started","scan_completed","scan_failed","share_card_created","workout_share_created","account_sync_started","corrective_plan_built","correction_cycle_started","correction_cycle_workout_completed","correction_cycle_rescanned","workout_started","workout_completed","paywall_viewed","pricing_plan_selected","founding_price_reserved","pro_feature_tapped","pro_access_granted","onboarding_started","onboarding_completed","workout_generated","workout_imported","set_completed","workout_abandoned","plan_saved","natural_language_log_started","natural_language_log_confirmed","share_card_generated","progress_viewed"]);
const allowedSources=new Set(["form","posture","workout","pricing","mini_program","web","cli","mcp","imported_plan","natural_language_log"]);
const allowedVariants=new Set(["control","coach_anchor"]);

function cleanMetadata(value:unknown){
  if(!value||typeof value!=="object"||Array.isArray(value))return{};
  const clean:Record<string,string|number|boolean|null>={};
  for(const [key,item] of Object.entries(value as Record<string,unknown>).slice(0,12)){
    if(!/^[a-z][a-zA-Z0-9_]{0,39}$/.test(key))continue;
    if(typeof item==="string")clean[key]=item.slice(0,120);
    else if(typeof item==="number"&&Number.isFinite(item))clean[key]=item;
    else if(typeof item==="boolean"||item===null)clean[key]=item;
  }
  return clean;
}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
  const eventName=typeof body.eventName==="string"&&allowedEvents.has(body.eventName)?body.eventName:null;
  const sessionId=typeof body.sessionId==="string"&&/^[a-zA-Z0-9-]{8,64}$/.test(body.sessionId)?body.sessionId:null;
  if(!eventName||!sessionId)return NextResponse.json({error:"Invalid event"},{status:400});
  const source=typeof body.source==="string"&&allowedSources.has(body.source)?body.source:null;
  const variant=typeof body.variant==="string"&&allowedVariants.has(body.variant)?body.variant:null;
  await getDb().insert(productEvents).values({id:crypto.randomUUID(),userId:user?.id||`anon_${sessionId}`,sessionId,eventName,occurredAt:Date.now(),source,variant,metadataJson:JSON.stringify(cleanMetadata(body.metadata))});
  return NextResponse.json({accepted:true},{status:202});
}
