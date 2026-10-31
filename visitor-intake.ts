// Credential overrides are encrypted in Vault; existing environment values remain fallback.
async function niaSecret(name:string):Promise<string|undefined>{
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const response=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/nia_config_read',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({p_name:name}),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('Credential storage unavailable');
 const value=await response.json();return value===null?Deno.env.get(name):value;
}
const allowedOrigin = 'https://niahyderabad1-lgtm.github.io';
const headers = {'Access-Control-Allow-Origin': allowedOrigin,'Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Content-Type':'application/json'};
const reply=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
// Resolve the published meeting on the server; never trust a browser-supplied event.
const currentMeeting=async()=>{
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/meeting_settings?id=eq.1&select=meeting_date,start_time,end_time,venue,address,revision',{
  headers:{apikey:service,Authorization:'Bearer '+service},signal:AbortSignal.timeout(10000)
 });
 if(!r.ok)throw Error('Meeting lookup failed');
 const m=(await r.json())[0];
 if(!m||!/^\d{4}-\d{2}-\d{2}$/.test(m.meeting_date)||typeof m.venue!=='string'||!m.venue.trim())throw Error('Meeting lookup failed');
 return m;
};
// Test checkout only: test orders never change a real visitor's paid status.
const paymentAction=async(b:any)=>{
 const key=(await niaSecret('RAZORPAY_KEY_ID'))||'',keySecret=(await niaSecret('RAZORPAY_KEY_SECRET'))||'';
 if(!key.startsWith('rzp_test_')||!keySecret)return reply(503,{error:'Test payment settings are incomplete. Contact NIA.'});
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,base=Deno.env.get('SUPABASE_URL')+'/rest/v1/';
 const dbHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 const rpHeaders={Authorization:'Basic '+btoa(key+':'+keySecret),'Content-Type':'application/json'};
 const rp=async(path:string,body?:unknown)=>{
  const r=await fetch('https://api.razorpay.com/v1/'+path,{method:body?'POST':'GET',headers:rpHeaders,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Razorpay could not process this test request. Please contact NIA.');return await r.json();
 };
 if(b.action==='payment_config'){
  await rp('orders?count=1');return reply(200,{test_mode:true,configured:true});
 }
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.request_id))return reply(400,{error:'Invalid request identifier'});
 const id=encodeURIComponent(b.request_id);
 const vr=await fetch(base+'visitor_requests?request_id=eq.'+id+'&select=request_id,created_at',{headers:dbHeaders});
 if(!vr.ok)throw Error('Unable to check your enquiry.');const requests=await vr.json();
 if(requests.length!==1||Date.now()-Date.parse(requests[0].created_at)>86400000)return reply(400,{error:'Please submit a fresh visitor enquiry.'});
 const getOrder=async()=>{const r=await fetch(base+'visitor_test_orders?request_id=eq.'+id+'&select=order_id,amount,currency,payment_id,verified_at',{headers:dbHeaders});if(!r.ok)throw Error('Test payment storage is unavailable.');return (await r.json())[0];};
 let order=await getOrder();
 if(b.action==='create_order'){
  if(!order){
   // Preserve the enquiry's meeting date if staff later schedules a new meeting.
   const leadResponse=await fetch(base+'visitor_requests?request_id=eq.'+id+'&select=leads(attribution)',{headers:dbHeaders});
   if(!leadResponse.ok)throw Error('Unable to check enquiry meeting.');
   const enquiry=(await leadResponse.json())[0];
   const linked=Array.isArray(enquiry?.leads)?enquiry.leads[0]:enquiry?.leads;
   const eventDate=linked?.attribution?.event;
   if(typeof eventDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(eventDate))throw Error('Unable to check enquiry meeting.');
   const created=await rp('orders',{amount:260000,currency:'INR',receipt:'nia_'+b.request_id.replaceAll('-',''),notes:{event:'NIA Hyderabad visitor '+eventDate,mode:'test'}});
   if(created.amount!==260000||created.currency!=='INR'||!/^order_[A-Za-z0-9]+$/.test(created.id))throw Error('Unexpected test order response.');
   const saved=await fetch(base+'visitor_test_orders',{method:'POST',headers:dbHeaders,body:JSON.stringify({request_id:b.request_id,order_id:created.id,amount:260000,currency:'INR'})});
   if(!saved.ok&&saved.status!==409)throw Error('Unable to save test order. No payment has been taken.');
   order=await getOrder();if(!order)throw Error('Unable to find test order.');
  }
  return reply(200,{key_id:key,order_id:order.order_id,amount:260000,currency:'INR',test_mode:true,already_verified:!!order.verified_at});
 }
 if(b.action!=='verify_payment')return reply(400,{error:'Unknown payment action'});
 if(!order||b.razorpay_order_id!==order.order_id||!/^pay_[A-Za-z0-9]+$/.test(b.razorpay_payment_id)||! /^[a-f0-9]{64}$/i.test(b.razorpay_signature))return reply(400,{error:'Invalid test payment response'});
 const hmacKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(keySecret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const signature=Uint8Array.from(b.razorpay_signature.match(/../g).map((v:string)=>parseInt(v,16)));
 if(!await crypto.subtle.verify('HMAC',hmacKey,signature,new TextEncoder().encode(order.order_id+'|'+b.razorpay_payment_id)))return reply(400,{error:'Payment signature did not match'});
 const [payment,rpOrder]=await Promise.all([rp('payments/'+b.razorpay_payment_id),rp('orders/'+order.order_id)]);
 if(payment.order_id!==order.order_id||payment.amount!==260000||payment.currency!=='INR'||payment.status!=='captured'||rpOrder.status!=='paid'||rpOrder.amount_paid!==260000)return reply(409,{error:'Test payment is not captured yet. Contact NIA; do not pay again.'});
 const updated=await fetch(base+'visitor_test_orders?request_id=eq.'+id,{method:'PATCH',headers:dbHeaders,body:JSON.stringify({payment_id:b.razorpay_payment_id,verified_at:new Date().toISOString()})});
 if(!updated.ok)throw Error('Test payment verification could not be saved. Contact NIA; do not pay again.');
 return reply(200,{verified:true,test_mode:true,payment_id:b.razorpay_payment_id});
};
const testWebhook=async(req:Request)=>{
 const secret=(await niaSecret('RAZORPAY_WEBHOOK_SECRET'))||'';
 if(!secret)return reply(503,{error:'Webhook not configured'});
 const sig=req.headers.get('x-razorpay-signature')||'';
 if(!/^[a-f0-9]{64}$/i.test(sig)){console.warn('webhook_rejected: signature missing or malformed');return reply(400,{error:'Invalid webhook signature'});}
 const raw=await req.text();if(new TextEncoder().encode(raw).length>8000)return reply(413,{error:'Request too large'});
 const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const signature=Uint8Array.from(sig.match(/../g)!.map(v=>parseInt(v,16)));
 if(!await crypto.subtle.verify('HMAC',hmac,signature,new TextEncoder().encode(raw))){console.warn('webhook_rejected: signature mismatch');return reply(400,{error:'Invalid webhook signature'});}
 const event=JSON.parse(raw);if(!['payment.captured','order.paid'].includes(event.event))return reply(200,{received:true});
 const entity=event.payload?.payment?.entity;
 if(!/^pay_[A-Za-z0-9]+$/.test(entity?.id)||!/^order_[A-Za-z0-9]+$/.test(entity?.order_id)){console.warn('webhook_rejected: invalid payment event');return reply(400,{error:'Invalid payment event'});}
 const key=(await niaSecret('RAZORPAY_KEY_ID'))||'',rpSecret=(await niaSecret('RAZORPAY_KEY_SECRET'))||'';
 if(!key.startsWith('rzp_test_')||!rpSecret)return reply(503,{error:'Test payment configuration required'});
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,base=Deno.env.get('SUPABASE_URL')+'/rest/v1/';
 const dbHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 const query='visitor_test_orders?order_id=eq.'+encodeURIComponent(entity.order_id);
 const found=await fetch(base+query+'&select=order_id,payment_id,verified_at',{headers:dbHeaders});if(!found.ok)return reply(500,{error:'Unable to reconcile'});
 const orders=await found.json();if(!orders.length)return reply(200,{received:true});
 const rpHeaders={Authorization:'Basic '+btoa(key+':'+rpSecret)};
 const [pr,orr]=await Promise.all([fetch('https://api.razorpay.com/v1/payments/'+entity.id,{headers:rpHeaders,signal:AbortSignal.timeout(15000)}),fetch('https://api.razorpay.com/v1/orders/'+entity.order_id,{headers:rpHeaders,signal:AbortSignal.timeout(15000)})]);
 if(!pr.ok||!orr.ok)return reply(502,{error:'Unable to confirm payment'});
 const payment=await pr.json(),order=await orr.json();
 if(payment.order_id!==entity.order_id||payment.status!=='captured'||payment.amount!==260000||payment.currency!=='INR'||order.status!=='paid'||order.amount_paid!==260000){console.warn('webhook_rejected: amount or capture status mismatch');return reply(400,{error:'Payment does not match test booking'});}
 if(orders[0].verified_at&&orders[0].payment_id===entity.id)return reply(200,{received:true,test_mode:true});
 const saved=await fetch(base+query,{method:'PATCH',headers:dbHeaders,body:JSON.stringify({payment_id:entity.id,verified_at:new Date().toISOString()})});
 return saved.ok?reply(200,{received:true,test_mode:true}):reply(500,{error:'Unable to reconcile'});
};
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Use POST'});
 if(new URL(req.url).searchParams.get('webhook')==='razorpay'){try{return await testWebhook(req);}catch{return reply(500,{error:'Unable to process webhook'});}}
 if(req.headers.get('origin')!==allowedOrigin)return reply(403,{error:'Origin not allowed'});
 if(Number(req.headers.get('content-length')||0)>8000)return reply(413,{error:'Request too large'});
 try{
  const raw=await req.text();if(raw.length>8000)return reply(413,{error:'Request too large'});const b=JSON.parse(raw);
  // Public test checkout has been retired while Razorpay reviews the live website.
  if(['payment_config','create_order','verify_payment'].includes(b.action))return reply(410,{error:'Online booking is not available yet. Please contact NIA on WhatsApp.'});
  if(b.website)return reply(400,{error:'Unable to submit'});
  if(b.consent!==true)return reply(400,{error:'Contact consent is required'});
  const clean=(key:string,max:number,required=true)=>{const v=String(b[key]||'').trim();if(v.length>max||(required&&!v))throw Error('Check '+key);return v;};
  const name=clean('name',100),company=clean('company',150),category=clean('category',100),email=clean('email',254,false);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(400,{error:'Check email'});
  let phone=clean('phone',18).replace(/\D/g,'');if(phone.length===10)phone='91'+phone;
  if(!/^91[6-9][0-9]{9}$/.test(phone))return reply(400,{error:'Enter a valid Indian mobile number'});
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.request_id))return reply(400,{error:'Invalid request identifier'});
  if(b.years_in_business!==undefined&&b.years_in_business!==''&&(!Number.isInteger(Number(b.years_in_business))||Number(b.years_in_business)<0||Number(b.years_in_business)>150))return reply(400,{error:'Check years in business'});
  let meeting;try{meeting=await currentMeeting();}catch{return reply(503,{error:'Meeting details are unavailable. Please retry or contact NIA.'});}
  const attribution:Record<string,string>={years_in_business:String(b.years_in_business||''),event:meeting.meeting_date,event_start_time:meeting.start_time,event_end_time:meeting.end_time,event_venue:meeting.venue,event_address:meeting.address||'',event_revision:String(meeting.revision),consent_at:new Date().toISOString()};
  for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])attribution[k]=String(b.attribution?.[k]||'').slice(0,200);
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+secret));const bucket=Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('');
  const response=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/capture_visitor',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({p_request_id:b.request_id,p_bucket:bucket,p_name:name,p_phone:phone,p_company:company,p_category:category,p_email:email,p_route:b.route==='payment'?'Payment':'WhatsApp',p_attribution:attribution})});
  if(!response.ok){const error=await response.json();return reply(error.message?.includes('Too many')?429:400,{error:error.message?.includes('Too many')?'Too many requests. Please contact NIA on WhatsApp.':'Unable to save. Please retry.'});}
  return reply(200,{lead_id:await response.json(),saved:true});
 }catch(e){return reply(400,{error:e instanceof Error&&e.message.startsWith('Razorpay')?e.message:'Unable to complete this request. Please retry or contact NIA.'});}
});
