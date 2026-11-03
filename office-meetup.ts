// Public office-meeting availability and booking endpoint. Google Calendar is
// the source of truth for externally blocked time; Supabase prevents two web
// visitors reserving the same slot concurrently.
async function secret(name:string):Promise<string|undefined>{
 const value=Deno.env.get(name);if(value)return value;
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,base=Deno.env.get('SUPABASE_URL')!;
 const r=await fetch(base+'/rest/v1/rpc/nia_config_read',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({p_name:name}),signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw Error('Credential storage unavailable');return await r.json();
}
const origin='https://hyderabad.networkinaction.info';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
const slots=['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const dateOK=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T12:00:00+05:30').getDay()>=1&&new Date(date+'T12:00:00+05:30').getDay()<=6&&date>=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const db=()=>{const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;return {base:Deno.env.get('SUPABASE_URL')+'/rest/v1/',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'}}};
const base64url=(input:Uint8Array|string)=>{const bytes=typeof input==='string'?new TextEncoder().encode(input):input;let value='';for(const byte of bytes)value+=String.fromCharCode(byte);return btoa(value).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')};
const pemBytes=(pem:string)=>Uint8Array.from(atob(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----|\s/g,'')),c=>c.charCodeAt(0));
let cachedToken:{value:string,expires:number}|null=null;
async function calendarToken(){
 if(cachedToken&&cachedToken.expires>Date.now()+60000)return cachedToken.value;
 const raw=await secret('GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON');if(!raw)throw Error('Google Calendar is not configured');
 let account:{client_email:string,private_key:string};try{account=JSON.parse(raw)}catch{throw Error('Google Calendar configuration is invalid')};
 if(!account.client_email||!account.private_key)throw Error('Google Calendar configuration is invalid');
 const now=Math.floor(Date.now()/1000),encodedHeader=base64url(JSON.stringify({alg:'RS256',typ:'JWT'})),encodedClaim=base64url(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/calendar',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
 const key=await crypto.subtle.importKey('pkcs8',pemBytes(account.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(encodedHeader+'.'+encodedClaim)));
 const token=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:encodedHeader+'.'+encodedClaim+'.'+base64url(signature)}),signal:AbortSignal.timeout(10000)});
 const value=await token.json();if(!token.ok||typeof value.access_token!=='string')throw Error('Google Calendar authorization failed');cachedToken={value:value.access_token,expires:Date.now()+Math.max(300,value.expires_in||3600)*1000};return cachedToken.value;
}
async function calendarFetch(path:string,options:RequestInit={}){const token=await calendarToken();const r=await fetch('https://www.googleapis.com/calendar/v3'+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Google Calendar is unavailable');return r.json();}
const meetingWindow=(date:string,slot:string)=>{const start=`${date}T${slot}:00+05:30`,hour=Number(slot.slice(0,2))+1,end=`${date}T${String(hour).padStart(2,'0')}:00:00+05:30`;return {start,end}};
async function availableSlots(date:string){
 if(!dateOK(date))throw Error('Choose a Monday–Saturday date from today onward');
 const calendarId=await secret('GOOGLE_CALENDAR_ID');if(!calendarId)throw Error('Google Calendar is not configured');
 const dayStart=`${date}T10:00:00+05:30`,dayEnd=`${date}T18:00:00+05:30`;
 const freebusy=await calendarFetch('/freeBusy',{method:'POST',body:JSON.stringify({timeMin:dayStart,timeMax:dayEnd,timeZone:'Asia/Kolkata',items:[{id:calendarId}]})});
 const busy=(freebusy.calendars?.[calendarId]?.busy||[]).map((entry:any)=>({start:Date.parse(entry.start),end:Date.parse(entry.end)}));
 const {base,headers:dbHeaders}=db();const held=await fetch(base+'office_meetups?appointment_date=eq.'+date+'&status=in.(holding,requested,confirmed)&select=slot_start',{headers:dbHeaders});if(!held.ok)throw Error('Appointment storage is unavailable');const claimed=new Set((await held.json()).map((row:any)=>String(row.slot_start).slice(0,5)));
 return slots.filter(slot=>{const window=meetingWindow(date,slot),start=Date.parse(window.start),end=Date.parse(window.end);return !claimed.has(slot)&&!busy.some((b:{start:number,end:number})=>b.start<end&&b.end>start)});
}
async function schedule(b:any,req:Request){
 const clean=(key:string,max:number,required=true)=>{const v=String(b[key]||'').trim();if(v.length>max||(required&&!v))throw Error('Check '+key);return v};
 if(b.website||b.consent!==true)throw Error('Contact consent is required');const name=clean('name',100),company=clean('company',150),category=clean('category',100),email=clean('email',254,false);if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Check email');let phone=clean('phone',18).replace(/\D/g,'');if(phone.length===10)phone='91'+phone;if(!/^91[6-9][0-9]{9}$/.test(phone)||!uuid(b.request_id))throw Error('Invalid request');const date=String(b.office_date||''),time=String(b.office_time||'');if(!slots.includes(time))throw Error('Choose a valid one-hour slot');if(!(await availableSlots(date)).includes(time))return reply(409,{error:'That time is no longer available. Please choose another slot.'});
 const attribution:Record<string,string>={years_in_business:String(b.years_in_business||''),office_appointment_date:date,office_appointment_time:time,consent_at:new Date().toISOString()};for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])attribution[k]=String(b.attribution?.[k]||'').slice(0,200);
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown',digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+service)),bucket=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');const {base,headers:dbHeaders}=db();
 const reserved=await fetch(base+'rpc/reserve_office_meetup',{method:'POST',headers:dbHeaders,body:JSON.stringify({p_request_id:b.request_id,p_bucket:bucket,p_name:name,p_phone:phone,p_company:company,p_category:category,p_email:email,p_appointment_date:date,p_slot_start:time,p_attribution:attribution})});if(!reserved.ok){const detail=await reserved.json().catch(()=>({}));return reply(String(detail.message||'').includes('no longer available')?409:400,{error:String(detail.message||'Unable to reserve that time')})};const hold=await reserved.json();if(!hold.meeting_id)return reply(200,{lead_id:hold.lead_id,saved:true,appointment:{date,time,status:'requested'}});
 try{const calendarId=await secret('GOOGLE_CALENDAR_ID');const window=meetingWindow(date,time);const event=await calendarFetch('/calendars/'+encodeURIComponent(calendarId!)+'/events?sendUpdates=none',{method:'POST',body:JSON.stringify({summary:'NIA Office 1-to-1 · '+name,description:`Guest: ${name}\nPhone: +${phone}\nBusiness: ${company}\nCategory: ${category}${email?'\nEmail: '+email:''}\nCRM lead: ${hold.lead_id}`,location:'NIA Office',start:{dateTime:window.start,timeZone:'Asia/Kolkata'},end:{dateTime:window.end,timeZone:'Asia/Kolkata'},transparency:'opaque',visibility:'private'})});await fetch(base+'rpc/finalize_office_meetup',{method:'POST',headers:dbHeaders,body:JSON.stringify({p_meeting_id:hold.meeting_id,p_calendar_event_id:event.id})});return reply(200,{lead_id:hold.lead_id,saved:true,appointment:{date,time,status:'requested'}})}catch(error){await fetch(base+'rpc/cancel_office_meetup_hold',{method:'POST',headers:dbHeaders,body:JSON.stringify({p_meeting_id:hold.meeting_id})});throw error}
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{error:'Use POST'});if(req.headers.get('origin')!==origin)return reply(403,{error:'Origin not allowed'});try{const raw=await req.text();if(raw.length>8000)return reply(413,{error:'Request too large'});const body=JSON.parse(raw);if(body.action==='availability')return reply(200,{slots:await availableSlots(String(body.date||''))});if(body.action==='schedule')return await schedule(body,req);return reply(400,{error:'Unknown request'})}catch(error){return reply(503,{error:error instanceof Error?error.message:'Office appointments are unavailable'})}});
