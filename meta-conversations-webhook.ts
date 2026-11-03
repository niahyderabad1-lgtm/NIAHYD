// Public callback: challenge verification, signed messages and Instant Form leads.
const instantPick=(fields:Record<string,string>,...names:string[])=>names.map(n=>fields[n]).find(Boolean)||'';
const instantClean=(value:unknown,max:number)=>String(value||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const instantPhone=(value:string)=>{const n=value.replace(/\D/g,'');return n.length===10?'91'+n:n.startsWith('91')?n:''};
async function ingestInstantLead(value:any,pageId:string){
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,base=Deno.env.get('SUPABASE_URL')!,access=Deno.env.get('META_PAGE_ACCESS_TOKEN'),id=String(value?.leadgen_id||'');
 if(!/^\d+$/.test(id)||!access)throw Error('Lead retrieval is not configured');const db={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 const seen=await fetch(base+'/rest/v1/meta_instant_form_leads?meta_lead_id=eq.'+id+'&select=meta_lead_id',{headers:db});if(!seen.ok)throw Error('Lead storage unavailable');if((await seen.json()).length)return;
 const response=await fetch('https://graph.facebook.com/v25.0/'+id+'?fields=id,created_time,ad_id,adgroup_id,form_id,field_data',{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(12000)});const data=await response.json();if(!response.ok||!data?.id||String(value.page_id||pageId)!==pageId)throw Error('Meta lead retrieval failed');
 const fields:Record<string,string>={};for(const item of data.field_data||[]){const key=instantClean(item?.name,100).toLowerCase(),answer=instantClean(item?.values?.[0],1000);if(key&&answer)fields[key]=answer;}
 const name=instantClean(instantPick(fields,'full_name','name')||[fields.first_name,fields.last_name].filter(Boolean).join(' '),100),phone=instantPhone(instantPick(fields,'phone_number','phone','mobile_phone')),formId=String(data.form_id||value.form_id||'');if(!/^\d+$/.test(formId))throw Error('Meta lead did not include a form ID');
 const record={meta_lead_id:id,page_id:pageId,form_id:formId,ad_id:data.ad_id?String(data.ad_id):null,adgroup_id:data.adgroup_id?String(data.adgroup_id):null,submitted_at:data.created_time||null,field_data:fields,status:name&&phone?'received':'needs_review',error:name&&phone?'':'The Instant Form must require full name and mobile number.'};
 const claimed=await fetch(base+'/rest/v1/meta_instant_form_leads',{method:'POST',headers:{...db,Prefer:'return=representation,resolution=ignore-duplicates'},body:JSON.stringify(record)});if(!claimed.ok)throw Error('Lead storage unavailable');if(!(await claimed.json()).length||!name||!phone)return;
 const company=instantClean(instantPick(fields,'company_name','business_name','company','organization')||'Not provided',150),category=instantClean(instantPick(fields,'business_category','category','industry')||'Not provided',100),email=instantClean(instantPick(fields,'email','email_address'),254);
 const saved=await fetch(base+'/rest/v1/leads',{method:'POST',headers:{...db,Prefer:'return=representation'},body:JSON.stringify({name,phone,company,category,email,source:'Meta Instant Form · '+formId,attribution:{meta_lead_id:id,meta_page_id:pageId,meta_form_id:formId,meta_ad_id:record.ad_id,meta_adgroup_id:record.adgroup_id,meta_field_data:fields},notes:'Submitted a Meta Instant Form. Contact promptly.'})});const lead=(await saved.json())[0];if(!saved.ok||!lead?.id)throw Error('CRM lead creation failed');
 await fetch(base+'/rest/v1/meta_instant_form_leads?meta_lead_id=eq.'+id,{method:'PATCH',headers:db,body:JSON.stringify({lead_id:lead.id,status:'imported',updated_at:new Date().toISOString()})});
}
Deno.serve(async(req:Request)=>{
 const out=(status:number,text:string)=>new Response(text,{status,headers:{'Content-Type':'text/plain'}});
 const verify=Deno.env.get('WHATSAPP_VERIFY_TOKEN'),secret=Deno.env.get('META_APP_SECRET');
 if(req.method==='GET'){const q=new URL(req.url).searchParams;return verify&&q.get('hub.mode')==='subscribe'&&q.get('hub.verify_token')===verify?out(200,q.get('hub.challenge')||''):out(403,'Verification failed');}
 if(req.method!=='POST')return out(405,'POST required');
 const page=Deno.env.get('META_FACEBOOK_PAGE_ID'),ig=Deno.env.get('META_INSTAGRAM_ACCOUNT_ID');if(!secret||!page)return out(503,'Not configured');
 try{
  const reader=req.body?.getReader();if(!reader)return out(400,'Missing body');let size=0;const parts=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();return out(413,'Too large');}parts.push(value);}
  const raw=new Uint8Array(size);let at=0;for(const p of parts){raw.set(p,at);at+=p.length;}
  const sig=req.headers.get('x-hub-signature-256')||'';if(!/^sha256=[a-f0-9]{64}$/i.test(sig))return out(401,'Invalid signature');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(sig.slice(7).match(/../g)!.map(v=>parseInt(v,16))),raw))return out(401,'Invalid signature');
  const data=JSON.parse(new TextDecoder().decode(raw));if(!['page','instagram'].includes(data.object))return out(200,'Ignored');
  for(const entry of data.entry||[]){const channel=data.object==='page'?'facebook':'instagram',account=channel==='facebook'?page:ig;if(!account||String(entry.id)!==account)continue;
   if(channel==='facebook')for(const change of entry.changes||[])if(change?.field==='leadgen')await ingestInstantLead(change.value,page);
   for(const event of entry.messaging||[]){const message=event.message;if(!message?.mid||!event.sender?.id||!event.recipient?.id||!Number.isFinite(event.timestamp))continue;
    const outgoing=String(event.sender.id)===account;if(!outgoing&&String(event.recipient.id)!==account)continue;
    const participant=String(outgoing?event.recipient.id:event.sender.id);if(participant===account)continue;
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const saved=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/meta_ingest_message',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({p_channel:channel,p_account:account,p_participant:participant,p_name:'',p_conversation:null,p_message:message.mid,p_direction:outgoing?'outgoing':'incoming',p_body:String(message.text||'['+(message.attachments?.[0]?.type||'Media')+' message]').slice(0,10000),p_at:new Date(event.timestamp).toISOString()})});
    if(!saved.ok)return out(503,'Please retry');
   }
  }return out(200,'Received');
 }catch{return out(400,'Invalid event');}
});
