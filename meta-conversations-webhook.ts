// Public callback: challenge verification and HMAC-signed messages only.
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
