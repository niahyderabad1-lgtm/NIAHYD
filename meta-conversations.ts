// Facebook Login / Page access token route. No credentials are returned to the browser.
const origin='https://niahyderabad1-lgtm.github.io';
Deno.serve(async(req:Request)=>{
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(status:number,data:any)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST'||req.headers.get('origin')!==origin)return reply(403,{error:'Origin or method denied'});
 const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const db={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 const page=Deno.env.get('META_FACEBOOK_PAGE_ID'),ig=Deno.env.get('META_INSTAGRAM_ACCOUNT_ID'),access=Deno.env.get('META_PAGE_ACCESS_TOKEN');
 const version='v25.0';
 const rest=async(path:string,options:any={})=>{const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{...db,...options.headers}});if(!r.ok)throw Error('Inbox storage request failed');return r.status===204?null:r.json();};
 const graph=async(path:string,options:any={})=>{const r=await fetch('https://graph.facebook.com/'+version+'/'+path,{...options,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'}});const data=await r.json();if(!r.ok||data.error)throw Error('Meta request failed (code '+(data.error?.code||r.status)+'). Check Page permissions and token.');return data;};
 try{
  const userR=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:req.headers.get('authorization')||''}});if(!userR.ok)return reply(401,{error:'Staff sign-in required'});const user=await userR.json();
  if(!(await rest('crm_staff?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id')).length)return reply(403,{error:'Staff access required'});
  const text=await req.text();if(text.length>12000)return reply(413,{error:'Request too large'});const input=JSON.parse(text);
  if(input.action==='status'){
   const state:any={facebook:false,instagram:false,instagram_account_id:null,errors:[],webhook:!!(Deno.env.get('META_APP_SECRET')&&Deno.env.get('WHATSAPP_VERIFY_TOKEN'))};
   if(!page||!access){state.errors.push('Page ID or Page token missing in Supabase.');return reply(200,state);}
   try{const info=await graph(encodeURIComponent(page)+'?fields=id,name,instagram_business_account{id,username}');state.page_name=info.name;state.instagram_account_id=info.instagram_business_account?.id||null;if(state.instagram_account_id)console.info('Linked Instagram account: '+state.instagram_account_id+' / '+(info.instagram_business_account?.username||''));}catch(e){state.errors.push(String(e instanceof Error?e.message:e));}
   try{await graph(encodeURIComponent(page)+'/conversations?fields=id&platform=messenger&limit=1');state.facebook=true;}catch(e){state.errors.push('Facebook: '+String(e instanceof Error?e.message:e));}
   if(ig){try{await graph(encodeURIComponent(page)+'/conversations?fields=id&platform=instagram&limit=1');state.instagram=true;}catch(e){state.errors.push('Instagram: '+String(e instanceof Error?e.message:e));}}else state.errors.push('Save the linked Instagram account ID as META_INSTAGRAM_ACCOUNT_ID.');
   return reply(200,state);
  }
  if(!page||!access)return reply(409,{error:'Configure META_FACEBOOK_PAGE_ID and META_PAGE_ACCESS_TOKEN in Supabase secrets.'});
  if(input.action==='sync'){
   const channel=input.channel;if(!['facebook','instagram'].includes(channel)||channel==='instagram'&&!ig)return reply(400,{error:'Choose a configured channel'});
   const cursor=typeof input.after==='string'?input.after:'';if(cursor.length>2000)return reply(400,{error:'Invalid cursor'});
   const query=new URLSearchParams({platform:channel==='instagram'?'instagram':'messenger',fields:'id,participants,messages.limit(20){id,message,from,to,created_time}',limit:'10'});if(cursor)query.set('after',cursor);
   const result=await graph(encodeURIComponent(page)+'/conversations?'+query);let count=0;
   for(const c of result.data||[]){for(const m of c.messages?.data||[]){const own=new Set([page,ig].filter(Boolean));const outgoing=own.has(String(m.from?.id));const participant=outgoing?m.to?.data?.find((p:any)=>!own.has(String(p.id))):m.from;if(!participant?.id||!m.id||!m.created_time)continue;
    await rest('rpc/meta_ingest_message',{method:'POST',body:JSON.stringify({p_channel:channel,p_account:channel==='facebook'?page:ig,p_participant:String(participant.id),p_name:participant.name||'',p_conversation:c.id,p_message:m.id,p_direction:outgoing?'outgoing':'incoming',p_body:m.message||'[Media message]',p_at:m.created_time})});count++;}}
   return reply(200,{count,after:result.paging?.next?result.paging?.cursors?.after||null:null,note:'Recent messages only; older history may be unavailable.'});
  }
  if(input.action==='reply'){
   if(!/^[a-f0-9-]{36}$/i.test(input.thread_id||'')||!/^[a-f0-9-]{36}$/i.test(input.request_id||'')||typeof input.body!=='string'||!input.body.trim()||input.body.length>1000)return reply(400,{error:'Invalid reply'});
   const thread=(await rest('meta_threads?id=eq.'+encodeURIComponent(input.thread_id)+'&select=*'))[0];if(!thread||thread.account_id!==(thread.channel==='facebook'?page:ig))return reply(404,{error:'Conversation not configured'});
   const last=(await rest('meta_messages?thread_id=eq.'+thread.id+'&direction=eq.incoming&order=event_at.desc&limit=1&select=event_at'))[0];const age=Date.now()-Date.parse(last?.event_at);if(!Number.isFinite(age)||age<0||age>86400000)return reply(409,{error:'Reply window closed. A new customer message is required.'});
   const existing=(await rest('meta_reply_attempts?request_id=eq.'+input.request_id+'&select=*'))[0];if(existing){if(existing.thread_id!==thread.id||existing.body!==input.body||existing.created_by!==user.id)return reply(409,{error:'Request ID already used'});return reply(200,{state:existing.state});}
   const reservation=await fetch(base+'/rest/v1/meta_reply_attempts',{method:'POST',headers:db,body:JSON.stringify({request_id:input.request_id,thread_id:thread.id,body:input.body,created_by:user.id})});if(!reservation.ok)return reply(409,{error:'Reply already reserved; refresh before retrying'});
   let result;try{result=await graph(encodeURIComponent(page)+'/messages',{method:'POST',body:JSON.stringify({recipient:{id:thread.participant_id},message:{text:input.body},...(thread.channel==='facebook'?{messaging_type:'RESPONSE'}:{})})});}catch(e){await rest('meta_reply_attempts?request_id=eq.'+input.request_id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({state:'unknown'})});return reply(502,{error:'Send result uncertain. Do not resend automatically; check Meta inbox.'});}
   if(!result.message_id)return reply(502,{error:'No message ID returned; check Meta inbox before retrying'});
   await rest('meta_reply_attempts?request_id=eq.'+input.request_id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({state:'accepted',message_id:result.message_id})});
   await rest('rpc/meta_ingest_message',{method:'POST',body:JSON.stringify({p_channel:thread.channel,p_account:thread.account_id,p_participant:thread.participant_id,p_name:'',p_conversation:null,p_message:result.message_id,p_direction:'outgoing',p_body:input.body,p_at:new Date().toISOString()})});return reply(200,{state:'accepted'});
  }
  return reply(400,{error:'Unknown action'});
 }catch(e){return reply(503,{error:e instanceof Error?e.message:'Inbox unavailable'});}
});
