'use strict';
// The legacy disposition is separate from the guest visit stage and verified payment.
const dispositionFieldset=document.createElement('fieldset');
dispositionFieldset.className='member-profile';
dispositionFieldset.hidden=true;
dispositionFieldset.innerHTML='<legend>Disposition and group</legend><div class="fields"><label>Lead disposition<select name="disposition"><option value="">Not set</option></select></label><label>Assigned group<select name="qualified_group_id"><option value="">Not assigned</option></select></label></div><label>Disposition reason<input name="disposition_reason" maxlength="120" list="disposition-reasons" placeholder="Optional"></label><datalist id="disposition-reasons"><option value="Not interested"><option value="Not a fit for the group"><option value="No response after follow-up"><option value="Duplicate record"><option value="Invalid contact details"><option value="Other"></datalist><p id="original-group" class="hint" hidden></p><p class="hint">Disposition tracks the lead outcome. Assigned group is the proposed member group; neither changes verified guest payment.</p><p id="group-load-status" class="hint" role="status"></p>';
document.querySelector('#edit-form .member-profile').after(dispositionFieldset);
const dispositionSelect=dispositionFieldset.querySelector('[name="disposition"]');
dispositionSelect.disabled=true;
dispositionFieldset.querySelector('[name="disposition_reason"]').disabled=true;
for(const [value,label] of Object.entries(dispositionNames)){const option=document.createElement('option');option.value=value;option.textContent=label;dispositionSelect.append(option);}
const groupSelect=dispositionFieldset.querySelector('[name="qualified_group_id"]');
groupSelect.disabled=true;
const filterBar=document.querySelector('#pipeline-panel .toolbar');
const dispositionFilter=document.createElement('select');dispositionFilter.id='disposition-filter';dispositionFilter.setAttribute('aria-label','Filter by disposition');
dispositionFilter.append(new Option('All dispositions',''),new Option('Not set','__unset__'));
for(const [value,label] of Object.entries(dispositionNames))dispositionFilter.append(new Option(label,value));
filterBar.insertBefore(dispositionFilter,document.querySelector('#queue-filter'));
const groupFilter=document.createElement('select');groupFilter.id='group-filter';groupFilter.setAttribute('aria-label','Filter by assigned group');
groupFilter.append(new Option('All groups',''),new Option('Unassigned','__unassigned__'));
filterBar.insertBefore(groupFilter,document.querySelector('#queue-filter'));
dispositionFilter.hidden=true;groupFilter.hidden=true;
dispositionFilter.addEventListener('change',resetLeadPage);groupFilter.addEventListener('change',resetLeadPage);

async function loadTeamGroups(){
 if(demo)return;
 const status=document.querySelector('#group-load-status');
 try{
  const groups=await request('/rest/v1/crm_team_groups?select=id,name,archived&order=name.asc');
  const selected=groupSelect.value,filterValue=groupFilter.value;
  groupSelect.replaceChildren(new Option('Not assigned',''));
  groupFilter.replaceChildren(new Option('All groups',''),new Option('Unassigned','__unassigned__'));
  for(const group of groups){
   const name=group.name+(group.archived?' (archived)':'');
   groupSelect.append(new Option(name,group.id));
   groupFilter.append(new Option(name,group.id));
  }
  groupSelect.value=selected;groupFilter.value=filterValue;groupSelect.disabled=false;groupFilter.disabled=false;dispositionSelect.disabled=false;dispositionFieldset.querySelector('[name="disposition_reason"]').disabled=false;dispositionFieldset.hidden=false;dispositionFilter.hidden=false;groupFilter.hidden=false;document.body.classList.add('legacy-fields-ready');status.textContent='';
 }catch(e){status.textContent='Group list unavailable. The group migration may still be pending.';groupSelect.disabled=true;groupFilter.disabled=true;dispositionSelect.disabled=true;dispositionFieldset.querySelector('[name="disposition_reason"]').disabled=true;dispositionFieldset.hidden=true;dispositionFilter.hidden=true;groupFilter.hidden=true;document.body.classList.remove('legacy-fields-ready');}
}
const openWorkspaceBeforeLegacy=openWorkspace;
openWorkspace=function(){openWorkspaceBeforeLegacy();loadTeamGroups();};
if(!document.querySelector('#workspace').hidden)loadTeamGroups();
const editBeforeLegacy=edit;
const legacyHistory=document.createElement('section');legacyHistory.id='legacy-history';legacyHistory.innerHTML='<h3>Earlier CRM activity</h3><div id="legacy-history-list" role="status"></div>';
document.querySelector('#lead-change-section').after(legacyHistory);
async function loadLegacyHistory(id){const list=document.querySelector('#legacy-history-list');list.textContent='Loading earlier activity…';try{
 const events=demo?[]:await request('/rest/v1/crm_legacy_events?select=occurred_at,summary,source_table,details&lead_id=eq.'+encodeURIComponent(id)+'&order=occurred_at.desc&limit=30');
 if(editing!==id)return;list.replaceChildren();if(!events.length){list.textContent='No earlier CRM activity linked to this lead.';return;}
 for(const event of events){const item=document.createElement('article');item.className='activity';const title=document.createElement('strong');const details=event.details||{};let extra='';if(event.source_table==='crm_callback_reminders')extra=details.reminderStatus||'';else if(event.source_table==='crm_in_app_notifications')extra=details.title||'';else if(event.source_table==='crm_basic_online_checks')extra=details.status||'';else if(event.source_table==='crm_lead_changes'){try{const change=JSON.parse(details.changesJson||'{}');extra=Object.keys(change).join(', ');}catch{extra='Change recorded';}}title.textContent=event.summary+(extra?' · '+extra:'');const date=document.createElement('small');date.textContent=indiaTime(event.occurred_at);item.append(title,date);list.append(item);}
 }catch(e){list.textContent='Earlier CRM activity is unavailable until the database import is complete.';}}
edit=function(lead){editBeforeLegacy(lead);if(!lead)dispositionSelect.value='open';const group=document.querySelector('#original-group');group.hidden=!lead?.legacy_group_name;group.textContent=lead?.legacy_group_name?'Original group in previous CRM: '+lead.legacy_group_name:'';legacyHistory.hidden=!lead||!document.body.classList.contains('legacy-fields-ready');if(!legacyHistory.hidden)loadLegacyHistory(lead.id);};
