import {and,desc,eq} from "drizzle-orm";
import {NextResponse} from "next/server";
import {getDb} from "../../../db";
import {scanRecords} from "../../../db/schema";
import {getChatGPTUser} from "../../chatgpt-auth";

export const dynamic="force-dynamic";

type IncomingMetric={key?:unknown;score?:unknown;assessed?:unknown};

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  const rows=await getDb().select().from(scanRecords).where(eq(scanRecords.userId,user.id)).orderBy(desc(scanRecords.createdAt)).limit(60);
  return NextResponse.json({scans:rows.map(row=>({id:row.id,date:new Date(row.createdAt).toISOString(),type:row.scanType,score:row.score,confidence:row.confidence,repCount:row.repCount??undefined,photoCount:row.photoCount??undefined,metrics:safeMetrics(row.metricsJson),pending:false}))});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return NextResponse.json({error:"Authentication required"},{status:401});
  let body:Record<string,unknown>;
  try{body=await request.json() as Record<string,unknown>}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
  if(typeof body.id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id))return NextResponse.json({error:"Invalid scan id"},{status:400});
  const type=body.type==="form"||body.type==="posture"?body.type:null;
  if(!type)return NextResponse.json({error:"Invalid scan type"},{status:400});
  const score=boundedInt(body.score,0,100,-1);const confidence=boundedInt(body.confidence,0,100,-1);
  if(score<0||confidence<0)return NextResponse.json({error:"Invalid score"},{status:400});
  const rawMetrics=Array.isArray(body.metrics)?body.metrics.slice(0,12) as IncomingMetric[]:[];
  const metrics=rawMetrics.flatMap(metric=>typeof metric.key==="string"&&/^[a-z][a-z0-9_-]{0,31}$/i.test(metric.key)?[{key:metric.key,score:boundedInt(metric.score,0,100,0),assessed:metric.assessed!==false}]:[]);
  if(!metrics.length)return NextResponse.json({error:"At least one metric is required"},{status:400});
  const requestedDate=typeof body.date==="string"?Date.parse(body.date):NaN;
  const createdAt=Number.isFinite(requestedDate)&&requestedDate<=Date.now()+5*60*1000&&requestedDate>=Date.now()-2*365*24*60*60*1000?requestedDate:Date.now();
  const repCount=type==="form"?boundedInt(body.repCount,0,100,0):null;
  const photoCount=type==="posture"?boundedInt(body.photoCount,2,3,2):null;
  const db=getDb();
  const existing=await db.select().from(scanRecords).where(and(eq(scanRecords.id,body.id),eq(scanRecords.userId,user.id))).limit(1);
  if(!existing.length)await db.insert(scanRecords).values({id:body.id,userId:user.id,createdAt,scanType:type,score,confidence,repCount,photoCount,metricsJson:JSON.stringify(metrics)});
  return NextResponse.json({scan:{id:body.id,date:new Date(createdAt).toISOString(),type,score,confidence,repCount:repCount??undefined,photoCount:photoCount??undefined,metrics,pending:false}},{status:existing.length?200:201});
}

function safeMetrics(value:string){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}}
function boundedInt(value:unknown,min:number,max:number,fallback:number){const parsed=Math.round(Number(value));return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback}
