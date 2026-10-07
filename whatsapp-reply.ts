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
  const raw=await req.text();if(raw.length>12000)return reply(413,{error:'Request too large'});
  const {request_id,contact_id,body}=JSON.parse(raw);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request_id)||!/^\d{8,15}$/.test(contact_id)||typeof body!=='string'||!body.trim()||body.length>4096)return reply(400,{error:'Invalid message'});
  const prior=await fetch(base+'/rest/v1/wa_outgoing?request_id=eq.'+request_id+'&select=*',{headers:db});
  if(!prior.ok)return reply(503,{error:'Storage unavailable'});
  const priorRows=await prior.json();if(priorRows.length){const p=priorRows[0];if(p.contact_id!==contact_id||p.body!==body||p.staff_id!==user.id)return reply(409,{error:'Request already used'});return reply(200,{state:p.state,message_id:p.message_id});}
  const recent=await fetch(base+'/rest/v1/wa_events?kind=eq.incoming&contact_id=eq.'+contact_id+'&select=event_at&order=event_at.desc&limit=1',{headers:db});
  if(!recent.ok)return reply(503,{error:'Inbox unavailable'});
  const rows=await recent.json();if(!rows.length||Date.now()-new Date(rows[0].event_at).getTime()>86400000)return reply(400,{error:'Reply window closed. Use an approved template.'});
  const inserted=await fetch(base+'/rest/v1/wa_outgoing',{method:'POST',headers:db,body:JSON.stringify({request_id,staff_id:user.id,contact_id,body})});
  if(!inserted.ok)return reply(409,{error:'Send already started; refresh before retrying.'});
  const patch=async(state:string,message_id:string|null=null)=>fetch(base+'/rest/v1/wa_outgoing?request_id=eq.'+request_id,{method:'PATCH',headers:db,body:JSON.stringify({state,message_id})});
  try{
   const token=Deno.env.get('WHATSAPP_ACCESS_TOKEN'),number=Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
   if(!token||!number){await patch('failed');return reply(503,{error:'WhatsApp is not configured'});}
   const sent=await fetch('https://graph.facebook.com/v25.0/'+number+'/messages',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:contact_id,type:'text',text:{body}}),signal:AbortSignal.timeout(15000)});
   const result=await sent.json();
   if(!sent.ok){await patch('failed');return reply(400,{error:'Meta rejected message',code:result.error?.code});}
   const message_id=result.messages?.[0]?.id;const stored=await patch('accepted',message_id||null);
   return reply(200,{state:stored.ok?'accepted':'uncertain',message_id});
  }catch{await patch('uncertain');return reply(502,{error:'Send result uncertain. Check delivery before resending.'});}
 }catch{return reply(500,{error:'Unable to process reply'});}
});
