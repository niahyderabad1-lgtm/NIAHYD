// Add this logic to the existing signed Meta Page webhook. Meta sends a lead ID;
// the server immediately retrieves the answers with the Page access token.
const pick=(fields:Record<string,string>,...names:string[])=>names.map(n=>fields[n]).find(Boolean)||'';
const clean=(value:unknown,max:number)=>String(value||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
const phone=(value:string)=>{const n=value.replace(/\D/g,'');return n.length===10?'91'+n:n.startsWith('91')?n:''};

export async function ingestMetaInstantLead(value:any,pageId:string){
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,base=Deno.env.get('SUPABASE_URL')!,access=Deno.env.get('META_PAGE_ACCESS_TOKEN');
 const id=String(value?.leadgen_id||'');if(!/^\d+$/.test(id)||!access)throw Error('Lead retrieval is not configured');
 const db={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 const existing=await fetch(base+'/rest/v1/meta_instant_form_leads?meta_lead_id=eq.'+id+'&select=meta_lead_id',{headers:db});
 if(!existing.ok)throw Error('Lead storage unavailable');if((await existing.json()).length)return;
 const remote=await fetch('https://graph.facebook.com/v25.0/'+id+'?fields=id,created_time,ad_id,adgroup_id,form_id,field_data',{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(12000)});
 const data=await remote.json();if(!remote.ok||!data?.id)throw Error('Meta lead retrieval failed');
 if(String(value.page_id||pageId)!==pageId)throw Error('Lead Page does not match this CRM');
 const fields:Record<string,string>={};for(const item of data.field_data||[]){const key=clean(item?.name,100).toLowerCase(),answer=clean(item?.values?.[0],1000);if(key&&answer)fields[key]=answer;}
 const fullName=clean(pick(fields,'full_name','name')||[fields.first_name,fields.last_name].filter(Boolean).join(' '),100);
 const mobile=phone(pick(fields,'phone_number','phone','mobile_phone'));
 const company=clean(pick(fields,'company_name','business_name','company','organization')||'Not provided',150);
 const category=clean(pick(fields,'business_category','category','industry')||'Not provided',100);
 const email=clean(pick(fields,'email','email_address'),254);
 const record={meta_lead_id:id,page_id:pageId,form_id:String(data.form_id||value.form_id||''),ad_id:data.ad_id?String(data.ad_id):null,adgroup_id:data.adgroup_id?String(data.adgroup_id):null,submitted_at:data.created_time||null,field_data:fields,status:fullName&&mobile?'received':'needs_review',error:fullName&&mobile?'':'The Instant Form must require full name and mobile number.'};
 if(!/^\d+$/.test(record.form_id)){throw Error('Meta lead did not include a form ID');}
 const claimed=await fetch(base+'/rest/v1/meta_instant_form_leads',{method:'POST',headers:{...db,Prefer:'return=representation,resolution=ignore-duplicates'},body:JSON.stringify(record)});
 if(!claimed.ok)throw Error('Lead storage unavailable');if(!(await claimed.json()).length)return;
 if(!fullName||!mobile)return;
 const attribution={meta_lead_id:id,meta_page_id:pageId,meta_form_id:record.form_id,meta_ad_id:record.ad_id,meta_adgroup_id:record.adgroup_id,meta_field_data:fields};
 const saved=await fetch(base+'/rest/v1/leads',{method:'POST',headers:{...db,Prefer:'return=representation'},body:JSON.stringify({name:fullName,phone:mobile,company,category,email,source:'Meta Instant Form · '+record.form_id,attribution,notes:'Submitted a Meta Instant Form. Contact promptly.'})});
 const lead=(await saved.json())[0];if(!saved.ok||!lead?.id){await fetch(base+'/rest/v1/meta_instant_form_leads?meta_lead_id=eq.'+id,{method:'PATCH',headers:db,body:JSON.stringify({status:'failed',error:'Unable to create CRM lead',updated_at:new Date().toISOString()})});throw Error('CRM lead creation failed');}
 await fetch(base+'/rest/v1/meta_instant_form_leads?meta_lead_id=eq.'+id,{method:'PATCH',headers:db,body:JSON.stringify({lead_id:lead.id,status:'imported',updated_at:new Date().toISOString()})});
}
