import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../db";
import { betaFeedback } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic="force-dynamic";
const categories=new Set(["bug","idea","content","other"]);
const sessionPattern=/^[a-zA-Z0-9-]{8,64}$/;

async function anonymousReporter(sessionId:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(sessionId));
  return `anon_${Array.from(new Uint8Array(digest)).slice(0,12).map(value=>value.toString(16).padStart(2,"0")).join("")}`;
}

export async function POST(request:Request){
  let body:Record<string,unknown>;
  try{body=await request.json() as Record<string,unknown>}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
  const category=typeof body.category==="string"&&categories.has(body.category)?body.category:null;
  const message=typeof body.message==="string"?body.message.trim().replace(/\s+/g," "):"";
  const sessionId=typeof body.sessionId==="string"&&sessionPattern.test(body.sessionId)?body.sessionId:null;
  const page=typeof body.page==="string"&&/^[a-z]{1,20}$/.test(body.page)?body.page:"unknown";
  if(!category||message.length<8||message.length>800||!sessionId)return NextResponse.json({error:"Invalid feedback"},{status:400});
  const user=await getChatGPTUser();const reporterId=user?.id||await anonymousReporter(sessionId);const db=getDb();
  const recent=await db.select({id:betaFeedback.id}).from(betaFeedback).where(and(eq(betaFeedback.reporterId,reporterId),gt(betaFeedback.createdAt,Date.now()-60_000))).limit(3);
  if(recent.length>=3)return NextResponse.json({error:"Please wait a moment before sending more feedback."},{status:429});
  await db.insert(betaFeedback).values({id:crypto.randomUUID(),reporterId,category,message,page,createdAt:Date.now()});
  return NextResponse.json({accepted:true},{status:202});
}
