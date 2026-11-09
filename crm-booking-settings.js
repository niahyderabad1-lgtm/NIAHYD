'use strict';
// Visible only to CRM administrators; the database RPC checks the role again.
(()=>{
 const nav=document.querySelector('.crm-tabs'),workspace=document.querySelector('#workspace');
 const button=document.createElement('button');button.type='button';button.textContent='Booking controls';button.hidden=true;nav.append(button);
 const panel=document.createElement('section');panel.className='workspace-card';panel.hidden=true;panel.innerHTML='<p class="eyebrow">ADMIN ONLY</p><h2>Guest payment controls</h2><p>Turn off online guest payment at any time. It also closes automatically 28 hours before the saved meeting start time. Visitors can still book a one-to-one NIA Office visit.</p><p id="booking-admin-status" role="status"></p><label class="check"><input id="booking-payment-enabled" type="checkbox"> Accept guest meeting payments</label><p id="booking-admin-cutoff" class="hint"></p><button id="booking-admin-save" class="primary" type="button">Save payment setting</button>';
 workspace.append(panel);const feedback=panel.querySelector('#booking-admin-status'),input=panel.querySelector('#booking-payment-enabled'),save=panel.querySelector('#booking-admin-save');
 const rpc=(name,body={})=>request('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body)});
 async function reload(){feedback.textContent='Loading booking settings…';save.disabled=true;try{const allowed=await rpc('nia_config_is_admin');button.hidden=!allowed;if(!allowed){panel.hidden=true;return;}const settings=await request('/rest/v1/guest_booking_settings?id=eq.1&select=accept_payments,updated_at');input.checked=settings[0]?.accept_payments===true;const m=await NiaMeeting.refresh();const cutoff=new Date(Date.parse(m.meeting_date+'T'+m.start_time.slice(0,5)+':00+05:30')-28*60*60*1000);panel.querySelector('#booking-admin-cutoff').textContent='Automatic cutoff: '+indiaTime(cutoff.toISOString())+'. This applies even if the switch is on.';feedback.textContent='Current setting: '+(input.checked?'on':'off')+'.';save.disabled=false;}catch(e){feedback.textContent='Booking controls unavailable: '+e.message;}}
 button.addEventListener('click',()=>{for(const el of workspace.children)el.hidden=el!==panel;panel.hidden=false;activeNav(button,'Booking controls');reload();});
 nav.addEventListener('click',e=>{if(e.target!==button&&e.target.closest('button'))panel.hidden=true;});
 save.addEventListener('click',async()=>{save.disabled=true;feedback.textContent='Saving…';try{await rpc('set_guest_payment_acceptance',{p_enabled:input.checked});feedback.textContent='Saved. The public page will update on refresh.';await reload();}catch(e){feedback.textContent=e.message;save.disabled=false;}});
 new MutationObserver(()=>{if(workspace.hidden){button.hidden=true;panel.hidden=true;}else if(!demo)reload();}).observe(workspace,{attributes:true,attributeFilter:['hidden']});
 if(!workspace.hidden&&!demo)reload();
})();
