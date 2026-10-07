const origin='https://niahyderabad1-lgtm.github.io';
Deno.serve(async(req:Request)=>{
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 if(req.headers.get('origin')!==origin)return reply(403,{error:'Origin denied'});
 const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const auth=req.headers.get('authorization')||'';
 const db={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 try{
  const userResponse=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:auth}});
  if(!userResponse.ok)return reply(401,{error:'Staff sign-in required'});
  const user=await userResponse.json();
  const staff=await fetch(base+'/rest/v1/crm_staff?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id',{headers:db});
  if(!staff.ok||!(await staff.json()).length)return reply(403,{error:'Staff access required'});
  const raw=await req.text();if(raw.length>2000)return reply(413,{error:'Request too large'});
  const {campaign_id}=JSON.parse(raw);if(!/^[0-9a-f-]{36}$/i.test(campaign_id))return reply(400,{error:'Invalid campaign'});
  const token=Deno.env.get('WHATSAPP_ACCESS_TOKEN'),number=Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if(!token||number!=='1266052096601533')return reply(503,{error:'Broadcast sender unavailable'});
  const claimed=await fetch(base+'/rest/v1/rpc/wa_claim_batch',{method:'POST',headers:db,body:JSON.stringify({p_id:campaign_id})});
  if(!claimed.ok)return reply(503,{error:'Unable to claim recipients'});
  const rows=await claimed.json(),results=[];
  for(const r of rows){
   let state='uncertain',message_id=null,error_code=null;
   try{
    const permission=await fetch(base+'/rest/v1/wa_permissions?contact_id=eq.'+r.contact_id+'&select=opted_in',{headers:db});
    if(!permission.ok)throw Error('Consent unavailable');
    if(!(await permission.json())[0]?.opted_in){state='skipped';}
    else{
     const sent=await fetch('https://graph.facebook.com/v25.0/'+number+'/messages',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:r.contact_id,type:'template',template:{name:'broadcast_update',language:{code:'en_US'},components:[{type:'body',parameters:[{type:'text',text:r.recipient_name}]}]}}),signal:AbortSignal.timeout(10000)});
     const result=await sent.json();state=sent.ok?'accepted':'failed';message_id=result.messages?.[0]?.id||null;error_code=result.error?.code?String(result.error.code):null;
    }
   }catch{state='uncertain';}
   const saved=await fetch(base+'/rest/v1/wa_campaign_recipients?id=eq.'+r.id,{method:'PATCH',headers:db,body:JSON.stringify({state,message_id,error_code,updated_at:new Date().toISOString()})});
   results.push({contact_id:r.contact_id,state:saved.ok?state:'uncertain',error_code});
  }
  await fetch(base+'/rest/v1/rpc/wa_finish_campaign',{method:'POST',headers:db,body:JSON.stringify({p_id:campaign_id})});
  return reply(200,{processed:results.length,results});
 }catch{return reply(500,{error:'Unable to process campaign; refresh before retrying'});}
});
