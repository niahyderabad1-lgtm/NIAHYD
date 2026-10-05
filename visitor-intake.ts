const allowedOrigin = 'https://niahyderabad1-lgtm.github.io';
const headers = {'Access-Control-Allow-Origin': allowedOrigin,'Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Content-Type':'application/json'};
const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Use POST'});
 if(req.headers.get('origin')!==allowedOrigin)return reply(403,{error:'Origin not allowed'});
 if(Number(req.headers.get('content-length')||0)>8000)return reply(413,{error:'Request too large'});
 try{
  const raw=await req.text();if(raw.length>8000)return reply(413,{error:'Request too large'});const b=JSON.parse(raw);
  if(b.website)return reply(400,{error:'Unable to submit'});
  if(b.consent!==true)return reply(400,{error:'Contact consent is required'});
  const clean=(key:string,max:number,required=true)=>{const v=String(b[key]||'').trim();if(v.length>max||(required&&!v))throw Error('Check '+key);return v;};
  const name=clean('name',100),company=clean('company',150),category=clean('category',100),email=clean('email',254,false);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(400,{error:'Check email'});
  let phone=clean('phone',18).replace(/\D/g,'');if(phone.length===10)phone='91'+phone;
  if(!/^91[6-9][0-9]{9}$/.test(phone))return reply(400,{error:'Enter a valid Indian mobile number'});
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.request_id))return reply(400,{error:'Invalid request identifier'});
  const attribution:Record<string,string>={event:'2026-10-14',consent_at:new Date().toISOString()};
  for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])attribution[k]=String(b.attribution?.[k]||'').slice(0,200);
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+secret));const bucket=Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('');
  const response=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/capture_visitor',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({p_request_id:b.request_id,p_bucket:bucket,p_name:name,p_phone:phone,p_company:company,p_category:category,p_email:email,p_route:b.route==='payment'?'Payment':'WhatsApp',p_attribution:attribution})});
  if(!response.ok){const error=await response.json();return reply(error.message?.includes('Too many')?429:400,{error:error.message?.includes('Too many')?'Too many requests. Please contact NIA on WhatsApp.':'Unable to save. Please retry.'});}
  return reply(200,{lead_id:await response.json(),saved:true});
 }catch{return reply(400,{error:'Check your details and try again'});}
});
