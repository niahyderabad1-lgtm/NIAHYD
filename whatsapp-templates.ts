function compatible(components:any[],media:any=null){
 if(!Array.isArray(components)||!components.some(c=>c.type==='BODY'))return false;
 return components.every(c=>{
  if(c.type==='BODY')return typeof c.text==='string'&&!c.text.replaceAll('{{1}}','').includes('{{');
  if(c.type==='HEADER')return c.format==='TEXT'?!c.text?.includes('{{'):['IMAGE','VIDEO','DOCUMENT'].includes(c.format)&&media?.kind===c.format;
  if(c.type==='FOOTER')return !c.text?.includes('{{');
  if(c.type==='BUTTONS')return Array.isArray(c.buttons)&&c.buttons.every((b:any)=>b.type==='URL'&&!b.url?.includes('{{'));
  return false;
 });
}
const origin='https://niahyderabad1-lgtm.github.io';
Deno.serve(async(req:Request)=>{
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(status:number,data:any)=>new Response(JSON.stringify({...data,...(data.error?{message:data.error}: {})}),{status,headers});
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
  const raw=await req.text();if(raw.length>7500000)return reply(413,{error:'Request too large'});
  const input=JSON.parse(raw),token=Deno.env.get('WHATSAPP_ACCESS_TOKEN'),waba=Deno.env.get('WHATSAPP_WABA_ID');
  if(!token||waba!=='1747796306429948')return reply(503,{error:'Template connection unavailable'});
  const graph='https://graph.facebook.com/v25.0/'+waba+'/message_templates';
  const metaHeaders={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  if(input.action==='upload'){
   const types:any={'image/jpeg':'IMAGE','image/png':'IMAGE','video/mp4':'VIDEO','application/pdf':'DOCUMENT'};
   if(!types[input.mime]||typeof input.data!=='string'||typeof input.filename!=='string')return reply(400,{error:'Upload JPG, PNG, MP4 or PDF'});
   let bytes;try{bytes=Uint8Array.from(atob(input.data),c=>c.charCodeAt(0));}catch{return reply(400,{error:'Invalid file data'});}
   if(!bytes.length||bytes.length>5*1024*1024)return reply(413,{error:'Media must be 5 MB or smaller'});
   const uploadBase='https://graph.facebook.com/v25.0/';
   const session=await fetch(uploadBase+'28360688760263698/uploads?file_length='+bytes.length+'&file_type='+encodeURIComponent(input.mime),{method:'POST',headers:metaHeaders,signal:AbortSignal.timeout(15000)});const sd=await session.json();if(!session.ok||!sd.id)return reply(400,{error:'Meta could not create media upload (code '+(sd.error?.code||'unknown')+')'});
   if(typeof sd.id!=='string'||!sd.id.startsWith('upload:'))return reply(503,{error:'Unexpected upload session'});
   const uploaded=await fetch(uploadBase+sd.id,{method:'POST',headers:{Authorization:'OAuth '+token,file_offset:'0','Content-Type':input.mime},body:bytes,signal:AbortSignal.timeout(20000)});const ud=await uploaded.json();if(!uploaded.ok||!ud.h)return reply(400,{error:'Meta example upload failed (code '+(ud.error?.code||'unknown')+')'});
   const form=new FormData();form.append('messaging_product','whatsapp');form.append('type',input.mime);form.append('file',new Blob([bytes],{type:input.mime}),input.filename.slice(0,200));
   const sentMedia=await fetch(uploadBase+'1266052096601533/media',{method:'POST',headers:{Authorization:'Bearer '+token},body:form,signal:AbortSignal.timeout(20000)});const md=await sentMedia.json();if(!sentMedia.ok||!md.id)return reply(400,{error:'Meta send-media upload failed (code '+(md.error?.code||'unknown')+')'});
   const saved=await fetch(base+'/rest/v1/wa_media',{method:'POST',headers:{...db,Prefer:'return=representation'},body:JSON.stringify({meta_media_id:md.id,handle:ud.h,kind:types[input.mime],filename:input.filename.slice(0,200),created_by:user.id})});if(!saved.ok)return reply(503,{error:'Cannot save media reference'});return reply(200,{media:(await saved.json())[0]});
  }
  if(input.action==='sync'){
   let after='',items:any[]=[];
   for(let page=0;page<20;page++){
    const res=await fetch(graph+'?fields=id,name,language,category,status,components&limit=100'+(after?'&after='+encodeURIComponent(after):''),{headers:metaHeaders,signal:AbortSignal.timeout(15000)});
    const data=await res.json();if(!res.ok)return reply(400,{error:'Meta template sync failed (code '+(data.error?.code||'unknown')+')'});
    items.push(...(data.data||[]));if(!data.paging?.next)break;after=data.paging.cursors?.after;if(!after||page===19)return reply(503,{error:'Too many templates; list not refreshed completely'});
   }
   const local=await fetch(base+'/rest/v1/wa_templates?select=name,language,wa_media(kind)',{headers:db});if(!local.ok)return reply(503,{error:'Unable to load media references'});const localRows=await local.json();
   if(items.length){const saved=await fetch(base+'/rest/v1/wa_templates?on_conflict=name,language',{method:'POST',headers:{...db,Prefer:'resolution=merge-duplicates'},body:JSON.stringify(items.map(t=>({meta_id:t.id,name:t.name,language:t.language,category:t.category,status:t.status,components:t.components||[],supported:compatible(t.components,localRows.find((c:any)=>c.name===t.name&&c.language===t.language)?.wa_media),updated_at:new Date().toISOString()})))});if(!saved.ok)return reply(503,{error:'Unable to save template statuses'});}
   // Missing remote templates cannot remain selectable; local drafts stay intact.
   const cached=await fetch(base+'/rest/v1/wa_templates?meta_id=not.is.null&select=id,name,language',{headers:db});
   if(!cached.ok)return reply(503,{error:'Unable to reconcile template list'});
   for(const c of await cached.json())if(!items.some(t=>t.name===c.name&&t.language===c.language))await fetch(base+'/rest/v1/wa_templates?id=eq.'+c.id,{method:'PATCH',headers:db,body:JSON.stringify({status:'UNAVAILABLE',supported:false,updated_at:new Date().toISOString()})});
   return reply(200,{count:items.length});
  }
  if(input.action==='draft'){
   const {name,body,header='',footer='',url='',button='Visit page'}=input;
   if(typeof name!=='string'||! /^[a-z][a-z0-9_]{2,511}$/.test(name)||typeof body!=='string'||!body.trim()||body.length>1024||typeof header!=='string'||header.length>60||header.includes('{{')||typeof footer!=='string'||footer.length>60||footer.includes('{{')||body.replaceAll('{{1}}','').includes('{{'))return reply(400,{error:'Use lowercase template names and only {{1}} for the recipient name. Check text lengths.'});
   let media=null;if(input.media_id){const found=await fetch(base+'/rest/v1/wa_media?id=eq.'+encodeURIComponent(input.media_id)+'&created_by=eq.'+user.id+'&select=*',{headers:db});if(!found.ok||!(media=(await found.json())[0]))return reply(400,{error:'Upload media before saving the draft'});}
   const components:any[]=[];if(media)components.push({type:'HEADER',format:media.kind,example:{header_handle:[media.handle]}});else if(header)components.push({type:'HEADER',format:'TEXT',text:header});
   components.push({type:'BODY',text:body,...(body.includes('{{1}}')?{example:{body_text:[['Visitor']]}}:{})});
   if(footer)components.push({type:'FOOTER',text:footer});
   if(url){let u;try{u=new URL(url);}catch{return reply(400,{error:'Use a valid HTTPS website URL'});}if(u.protocol!=='https:'||u.username||u.password||url.includes('{{')||typeof button!=='string'||!button.trim()||button.length>25)return reply(400,{error:'Use a static HTTPS button URL and a label up to 25 characters'});components.push({type:'BUTTONS',buttons:[{type:'URL',text:button,url}]});}
   const saved=await fetch(base+'/rest/v1/wa_templates',{method:'POST',headers:{...db,Prefer:'return=representation'},body:JSON.stringify({name,language:'en_US',category:'MARKETING',status:'DRAFT',components,media_id:media?.id||null,supported:true,created_by:user.id})});
   if(!saved.ok)return reply(409,{error:'Template name already exists, or draft could not be saved. Use a new name.'});
   return reply(200,{template:(await saved.json())[0]});
  }
  if(input.action==='attach'){
   if(!/^[0-9a-f-]{36}$/i.test(input.id)||!/^[0-9a-f-]{36}$/i.test(input.media_id))return reply(400,{error:'Invalid media selection'});
   const tr=await fetch(base+'/rest/v1/wa_templates?id=eq.'+input.id+'&select=*',{headers:db});const mr=await fetch(base+'/rest/v1/wa_media?id=eq.'+input.media_id+'&created_by=eq.'+user.id+'&select=*',{headers:db});if(!tr.ok||!mr.ok)return reply(503,{error:'Cannot read media selection'});const t=(await tr.json())[0],m=(await mr.json())[0];if(!t||!m||!compatible(t.components,m))return reply(400,{error:'Media type does not match this template'});
   const saved=await fetch(base+'/rest/v1/wa_templates?id=eq.'+t.id,{method:'PATCH',headers:db,body:JSON.stringify({media_id:m.id,supported:true})});if(!saved.ok)return reply(503,{error:'Cannot attach media'});return reply(200,{attached:true});
  }
  if(input.action==='submit'){
   if(!/^[0-9a-f-]{36}$/i.test(input.id))return reply(400,{error:'Invalid template'});
   const locked=await fetch(base+'/rest/v1/wa_templates?id=eq.'+input.id+'&status=eq.DRAFT',{method:'PATCH',headers:{...db,Prefer:'return=representation'},body:JSON.stringify({status:'SUBMITTING',updated_at:new Date().toISOString()})});
   if(!locked.ok)return reply(503,{error:'Cannot reserve draft'});const t=(await locked.json())[0];if(!t)return reply(409,{error:'Draft already submitted. Refresh statuses before retrying.'});
   let result,state='UNKNOWN';
   try{const res=await fetch(graph,{method:'POST',headers:metaHeaders,body:JSON.stringify({name:t.name,language:t.language,category:t.category,components:t.components}),signal:AbortSignal.timeout(15000)});result=await res.json();state=res.ok?(result.status||'PENDING'):'DRAFT';
    await fetch(base+'/rest/v1/wa_templates?id=eq.'+t.id,{method:'PATCH',headers:db,body:JSON.stringify({status:state,meta_id:result.id||null,updated_at:new Date().toISOString()})});
    return res.ok?reply(200,{status:state}):reply(400,{error:'Meta rejected template submission (code '+(result.error?.code||'unknown')+'). '+(result.error?.error_user_msg||'Check content and account permissions.')});
   }catch{await fetch(base+'/rest/v1/wa_templates?id=eq.'+t.id,{method:'PATCH',headers:db,body:JSON.stringify({status:'UNKNOWN'})});return reply(502,{error:'Submission outcome uncertain. Sync Meta statuses before retrying.'});}
  }
  return reply(400,{error:'Unknown action'});
 }catch{return reply(500,{error:'Unable to manage templates'});}
});
