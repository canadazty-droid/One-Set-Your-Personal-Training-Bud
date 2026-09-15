import {eq} from "drizzle-orm";
import {NextResponse} from "next/server";
import {getDb} from "../../../db";
import {membershipInterests} from "../../../db/schema";
import {getChatGPTUser} from "../../chatgpt-auth";

export const dynamic="force-dynamic";

export async function GET(){
  const user=await getChatGPTUser();if(!user)return NextResponse.json({interest:null,authenticated:false});
  const rows=await getDb().select().from(membershipInterests).where(eq(membershipInterests.userId,user.id)).limit(1);
  return NextResponse.json({interest:rows[0]?{selectedPlan:rows[0].selectedPlan,reservedAt:new Date(rows[0].createdAt).toISOString()}:null,authenticated:true});
}

async function anonymousLeadId(email:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(email));return`lead_${Array.from(new Uint8Array(bytes)).slice(0,16).map(value=>value.toString(16).padStart(2,"0")).join("")}`}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
  const selectedPlan=body.selectedPlan==="monthly"||body.selectedPlan==="annual"?body.selectedPlan:null;
  if(!selectedPlan)return NextResponse.json({error:"Invalid plan"},{status:400});
  const submittedEmail=typeof body.email==="string"?body.email.trim().toLowerCase():"";const email=user?.email.toLowerCase()||submittedEmail;
  if((!user&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))||email.length>254)return NextResponse.json({error:"Valid email required"},{status:400});
  const userId=user?.id||await anonymousLeadId(email);const now=Date.now();const db=getDb();const existing=await db.select().from(membershipInterests).where(eq(membershipInterests.userId,userId)).limit(1);
  if(existing.length)await db.update(membershipInterests).set({selectedPlan,updatedAt:now}).where(eq(membershipInterests.userId,userId));
  else await db.insert(membershipInterests).values({userId,userEmail:email,selectedPlan,createdAt:now,updatedAt:now});
  return NextResponse.json({interest:{selectedPlan,reservedAt:new Date(existing[0]?.createdAt||now).toISOString()},authenticated:Boolean(user)});
}
