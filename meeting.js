/* Public event details only. No login tokens or private CRM data. */
'use strict';
window.NiaMeeting = (() => {
 const sample = {meeting_date:'2026-10-14',start_time:'18:00:00',end_time:'21:00:00',venue:'Novotel HICC Hyderabad',address:'',after_meeting:'Followed by dinner',revision:1};
 let current=null;
 const clock=t=>new Date('2000-01-01T'+t.slice(0,5)+':00Z').toLocaleTimeString('en-IN',{timeZone:'UTC',hour:'numeric',minute:'2-digit'});
 const day=m=>new Date(m.meeting_date+'T12:00:00+05:30').toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'long',year:'numeric'});
 function valid(m){if(!m||!/^\d{4}-\d{2}-\d{2}$/.test(m.meeting_date))return false;const d=new Date(m.meeting_date+'T12:00:00Z');if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==m.meeting_date)return false;const time=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?$/.test(t);return time(m.start_time)&&time(m.end_time)&&m.end_time.slice(0,5)>m.start_time.slice(0,5)&&typeof m.venue==='string'&&m.venue.trim().length>0&&m.venue.length<=200;}
 const schedule=m=>day(m)+' · '+clock(m.start_time)+'–'+clock(m.end_time)+' IST'+(m.after_meeting?', '+m.after_meeting:'');
 const description=()=>current?schedule(current)+' at '+current.venue+(current.address?', '+current.address:''):'the next guest meeting (please confirm the date, time and venue with NIA)';
 function apply(m){if(!valid(m))throw Error('Meeting details are incomplete.');current={...m};
  for(const el of document.querySelectorAll('[data-meeting]')){const key=el.dataset.meeting;el.textContent=key==='schedule'?schedule(m):key==='date'?day(m):key==='time'?clock(m.start_time)+'–'+clock(m.end_time)+' IST':key==='summary'?day(m)+' · ₹2,600':key==='short'?clock(m.start_time)+'–'+clock(m.end_time)+' IST · '+m.venue:key==='venue'?m.venue:key==='address'?m.address||'':key==='after'?m.after_meeting||'':'';}
  const hint=document.querySelector('#meeting-notice');if(hint){const past=Date.parse(m.meeting_date+'T'+m.end_time.slice(0,5)+':00+05:30')<Date.now();hint.hidden=!past;hint.textContent=past?'This meeting has ended. Contact NIA for the next meeting date before making plans.':'';}
  window.dispatchEvent(new CustomEvent('nia-meeting-updated',{detail:{...current}}));return current;
 }
 async function refresh(){const c=window.NIA_CONFIG||{};const r=await fetch(c.supabaseUrl+'/rest/v1/meeting_settings?id=eq.1&select=meeting_date,start_time,end_time,venue,address,after_meeting,revision,updated_at',{headers:{apikey:c.publishableKey},cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Meeting settings are unavailable.');const rows=await r.json();if(!rows.length)throw Error('Meeting settings are not configured.');return apply(rows[0]);}
 const ready=refresh().catch(()=>{const n=document.querySelector('#meeting-notice');if(n){n.hidden=false;n.textContent='Please confirm the meeting date, time and venue with NIA. Details could not be loaded.';}return null;});
 return {sample,ready,refresh,apply,valid,day,clock,schedule,description,get current(){return current;}};
})();
