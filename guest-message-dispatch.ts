// Internal scheduled worker for personalised, approved WhatsApp templates.
// Deploy as a Supabase Edge Function. Invoke only from a server scheduler with
// NIA_SCHEDULER_SECRET; no browser or CRM page can call this endpoint.
async function niaSecret(name:string):Promise<string|undefined>{
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,base=Deno.env.get('SUPABASE_URL')!;
 const r=await fetch(base+'/rest/v1/rpc/nia_config_read',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({p_name:name}),signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw Error('Credential storage unavailable');const value=await r.json();return value===null?Deno.env.get(name):value;
}
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const api=async(path:string,init:RequestInit={})=>{
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,base=Deno.env.get('SUPABASE_URL')!;
 return fetch(base+'/rest/v1/'+path,{...init,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',...(init.headers||{})}});
};
const text=(value:unknown)=>typeof value==='string'?value:'';
function bodyParameters(order:unknown,values:Record<string,unknown>){
 if(!Array.isArray(order)||order.length>10)throw Error('Invalid template parameter mapping');
 return order.map(key=>({type:'text',text:text(values[String(key)]).slice(0,1024)}));
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json(405,{error:'POST required'});
 const scheduler=Deno.env.get('NIA_SCHEDULER_SECRET')||'';
 if(!scheduler||req.headers.get('x-nia-scheduler-secret')!==scheduler)return json(401,{error:'Scheduler authentication required'});
 try{
  const [token,number]=await Promise.all([niaSecret('WHATSAPP_ACCESS_TOKEN'),niaSecret('WHATSAPP_PHONE_NUMBER_ID')]);
  if(!token||!/^\d+$/.test(number||''))throw Error('WhatsApp sender unavailable');
  const claimed=await api('rpc/claim_due_guest_message_jobs',{method:'POST',body:JSON.stringify({p_limit:20})});
  if(!claimed.ok)throw Error('Unable to claim guest message jobs');
  const jobs=await claimed.json(),results=[];
  for(const job of jobs){
   let state='uncertain',messageId:string|null=null,error='';
   try{
    const templateR=await api('wa_templates?id=eq.'+encodeURIComponent(job.template_id)+'&select=name,language,status,supported,components');
    const template=(await templateR.json())[0];
    const body=template?.components?.find((part:any)=>part.type==='BODY');
    const required=(body?.text?.match(/\{\{\d+\}\}/g)||[]).length;
    const parameters=bodyParameters(job.parameter_order,job.parameters);
    if(!templateR.ok||template.status!=='APPROVED'||!template.supported||!body||required!==parameters.length)throw Error('Approved template no longer matches this job');
    const sent=await fetch('https://graph.facebook.com/v25.0/'+number+'/messages',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:job.recipient_phone,type:'template',template:{name:template.name,language:{code:template.language},...(parameters.length?{components:[{type:'body',parameters}]}:{})}}),signal:AbortSignal.timeout(15000)});
    const output=await sent.json();messageId=output.messages?.[0]?.id||null;
    state=sent.ok&&messageId?'accepted':sent.ok?'uncertain':'failed';
    error=output.error?.code?String(output.error.code):'';
   }catch(e){error=e instanceof Error?e.message:'Unknown dispatch failure';}
   const done=await api('rpc/finish_guest_message_job',{method:'POST',body:JSON.stringify({p_job:job.id,p_state:state,p_message_id:messageId,p_error:error})});
   results.push({id:job.id,state:done.ok?state:'uncertain'});
  }
  return json(200,{processed:results.length,results});
 }catch(e){return json(503,{error:e instanceof Error?e.message:'Dispatch unavailable'});}
});
