// Public, write-only Meta Conversions API relay. It only runs after the guest
// form confirms its enquiry was saved and never returns provider credentials.
const origin='https://hyderabad.networkinaction.info';
const sha256=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const clean=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
Deno.serve(async req=>{
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const out=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST'||req.headers.get('origin')!==origin)return out(403,{error:'Origin or method denied'});
 try{
  const body=await req.json(),requestId=clean(body.request_id,36),name=clean(body.name,100),phone=clean(body.phone,18).replace(/\D/g,''),email=clean(body.email,254).toLowerCase();
  if(!/^[0-9a-f-]{36}$/i.test(requestId)||!name||!(/^(91)?[6-9][0-9]{9}$/.test(phone)))return out(400,{error:'Invalid conversion event'});
  const dataset=Deno.env.get('META_DATASET_ID')||'',token=Deno.env.get('META_CAPI_ACCESS_TOKEN')||'';
  if(!/^\d+$/.test(dataset)||!token)return out(204,{configured:false});
  const normalized=phone.length===10?'91'+phone:phone,user_data:any={ph:[await sha256(normalized)],client_ip_address:req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'',client_user_agent:(req.headers.get('user-agent')||'').slice(0,500)};
  if(email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))user_data.em=[await sha256(email)];
  for(const key of ['fbp','fbc']){const value=clean(body[key],200);if(value)user_data[key]=value}
  const page=clean(body.page_url,500).startsWith(origin)?clean(body.page_url,500):origin;
  const sent=await fetch('https://graph.facebook.com/v25.0/'+dataset+'/events',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({data:[{event_name:'Lead',event_time:Math.floor(Date.now()/1000),event_id:requestId,action_source:'website',event_source_url:page,user_data}],partner_agent:'nia_hyderabad_crm'}),signal:AbortSignal.timeout(10000)});
  return out(sent.ok?200:202,{reported:sent.ok});
 }catch{return out(400,{error:'Invalid conversion event'})}
});
