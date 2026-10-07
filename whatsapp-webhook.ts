// Public Meta ingress: GET challenge + signed POST, no database reads exposed.
const response=(status:number,text:string)=>new Response(text,{status,headers:{'Content-Type':'text/plain'}});
Deno.serve(async(req:Request)=>{
 const verify=Deno.env.get('WHATSAPP_VERIFY_TOKEN'),secret=Deno.env.get('META_APP_SECRET');
 if(req.method==='GET'){
  const p=new URL(req.url).searchParams;
  return verify&&p.get('hub.mode')==='subscribe'&&p.get('hub.verify_token')===verify
   ?response(200,p.get('hub.challenge')||''):response(403,'Verification failed');
 }
 if(req.method!=='POST')return response(405,'Method not allowed');
 const number=Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),waba=Deno.env.get('WHATSAPP_WABA_ID');
 if(!secret||!number||!waba)return response(503,'Not configured');
 try{
  // Bound body memory even when content-length is missing.
  const reader=req.body?.getReader();if(!reader)return response(400,'Missing body');
  const parts:Uint8Array[]=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>262144){await reader.cancel();return response(413,'Too large');}parts.push(value);}
  const raw=new Uint8Array(length);let offset=0;for(const part of parts){raw.set(part,offset);offset+=part.length;}
  const header=req.headers.get('x-hub-signature-256')||'';
  if(!/^sha256=[a-f0-9]{64}$/i.test(header))return response(401,'Invalid signature');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const signature=Uint8Array.from(header.slice(7).match(/../g)!.map(v=>parseInt(v,16)));
  if(!await crypto.subtle.verify('HMAC',key,signature,raw))return response(401,'Invalid signature');
  const event=JSON.parse(new TextDecoder().decode(raw));
  if(event.object!=='whatsapp_business_account')return response(200,'Ignored');
  const rows=[];
  for(const entry of event.entry||[]){if(String(entry.id)!==waba)continue;
   for(const change of entry.changes||[]){const v=change.value;if(change.field!=='messages'||v?.metadata?.phone_number_id!==number)continue;
    for(const m of v.messages||[]){if(!m.id||!m.from||!/^\d+$/.test(String(m.timestamp)))continue;
     rows.push({event_key:'incoming:'+m.id,phone_number_id:number,kind:'incoming',message_id:m.id,contact_id:m.from,event_at:new Date(Number(m.timestamp)*1000).toISOString(),body:String(m.text?.body||m.button?.text||m.interactive?.button_reply?.title||m.interactive?.list_reply?.title||'['+m.type+' message]').slice(0,10000),status:''});
    }
    for(const s of v.statuses||[]){if(!s.id||!s.recipient_id||!/^\d+$/.test(String(s.timestamp)))continue;
     rows.push({event_key:'status:'+s.id+':'+s.status+':'+s.timestamp,phone_number_id:number,kind:'status',message_id:s.id,contact_id:s.recipient_id,event_at:new Date(Number(s.timestamp)*1000).toISOString(),body:JSON.stringify((s.errors||[]).map((e:any)=>({code:e.code,title:e.title,detail:e.error_data?.details}))).slice(0,10000),status:String(s.status).slice(0,100)});
    }
   }
  }
  if(rows.length){const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
   const stored=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/wa_events?on_conflict=event_key',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(rows)});
   if(!stored.ok)return response(503,'Please retry');
  }
  // Honour explicit opt-out replies before returning success.
  const stops=rows.filter(r=>r.kind==='incoming'&&/^(stop|unsubscribe|opt out)$/i.test(r.body.trim()));
  for(const r of stops){const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
   const saved=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/wa_permissions?on_conflict=contact_id',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify({contact_id:r.contact_id,opted_in:false,evidence:'WhatsApp opt-out: '+r.body,updated_at:new Date().toISOString(),updated_by:null})});
   if(!saved.ok)return response(503,'Please retry');
  }
  return response(200,'Received');
 }catch{return response(400,'Invalid event');}
});
