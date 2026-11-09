'use strict';
// Staff-only exports use the same protected Supabase session as the CRM.
const exportCsvButton=document.querySelector('#export');
const exportExcelButton=document.querySelector('#export-excel');
exportCsvButton.textContent='Export full CSV';

const exportFields=[
 ['Lead ID','id'],['Received','_received_at'],['Created at','created_at'],['Name','name'],['Phone','phone'],
 ['Email','email'],['Business','company'],['Category','category'],['Stage','stage'],
 ['Disposition','disposition'],['Disposition reason','disposition_reason'],
 ['Assigned group','qualified_group_id'],['Original group','legacy_group_name'],
 ['Payment status','payment_status'],['Payment reference','payment_reference'],
 ['Owner','owner'],['Next callback','next_follow_up_at'],['Next action','next_action'],
 ['Follow-up date','follow_up'],['Source','source'],['Website','website'],
 ['Business address','business_address'],['Years in business','years_in_business'],
 ['Turnover range','turnover_range'],['Referred by','referred_by'],
 ['Membership fit','fit_status'],['Qualification notes','qualification_notes'],
 ['Follow-up notes','notes'],['Attribution','attribution'],
 ['Latest call date','_latest_call_date'],['Latest call outcome','_latest_call_outcome'],
 ['Latest call note','_latest_call_note'],['All conversation history','_activity_history'],
 ['Earlier CRM history','_legacy_history'],['Profile change history','_change_history']
];

function exportValue(value){
 const text=typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'');
 return /^\s*[=+@\-\t\r]/.test(text)?"'"+text:text;
}
function exportCsvCell(value){return '"'+exportValue(value).replaceAll('"','""')+'"';}
function exportDate(value){return value?indiaTime(value):'';}

async function exportTable(table,order,leadIds){
 if(!leadIds.length)return [];
 const rows=[];
 for(let i=0;i<leadIds.length;i+=75){
  const ids=leadIds.slice(i,i+75);
  for(let offset=0;;offset+=1000){
   const page=await request('/rest/v1/'+table+'?select=*&lead_id=in.('+ids.join(',')+')&order='+order+'.asc&limit=1000&offset='+offset);
   if(!Array.isArray(page))throw Error('Could not read '+table+' for export.');
   rows.push(...page);
   if(page.length<1000)break;
  }
 }
 return rows;
}

function exportRows(leadRows,activities,legacy,changes){
 const byLead=(rows)=>{const map=new Map();for(const row of rows){if(!map.has(row.lead_id))map.set(row.lead_id,[]);map.get(row.lead_id).push(row);}return map;};
 const activityMap=byLead(activities),legacyMap=byLead(legacy),changeMap=byLead(changes);
 const known=new Set(exportFields.map(([,key])=>key));
 const fields=[...exportFields,...[...new Set(leadRows.flatMap(l=>Object.keys(l)))].filter(key=>!known.has(key)).sort().map(key=>[key.replaceAll('_',' '),key])];
 const rows=leadRows.map(lead=>{
  const calls=(activityMap.get(lead.id)||[]).filter(a=>a.activity_type==='Call');
  const latest=calls.at(-1);
  const activity=(activityMap.get(lead.id)||[]).map(a=>[exportDate(a.created_at),a.activity_type,a.outcome,a.note].join(' | ')).join('\n');
  const old=(legacyMap.get(lead.id)||[]).map(e=>[exportDate(e.occurred_at),e.summary,JSON.stringify(e.details||{})].join(' | ')).join('\n');
  const updates=(changeMap.get(lead.id)||[]).map(c=>[exportDate(c.changed_at),c.actor_email||'System',JSON.stringify(c.changes||{})].join(' | ')).join('\n');
  const extra={_received_at:lead.attribution?.meta_received_at||lead.attribution?.meta_first_message_at||lead.created_at||'',_latest_call_date:exportDate(latest?.created_at),_latest_call_outcome:latest?.outcome||'',_latest_call_note:latest?.note||'',_activity_history:activity,_legacy_history:old,_change_history:updates};
  return fields.map(([,key])=>extra[key]??lead[key]);
 });
 return {fields,rows};
}

function exportDownloadCsv(data){
 const lines=[data.fields.map(([label])=>label),...data.rows].map(row=>row.map(exportCsvCell).join(','));
 const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='nia-full-leads-'+new Date().toISOString().slice(0,10)+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportSheet(headers,rows){return XLSX.utils.aoa_to_sheet([headers,...rows.map(row=>row.map(exportValue))]);}
function exportDownloadExcel(data,leadRows,activities,legacy,changes){
 const wb=XLSX.utils.book_new();
 const leadData=data.rows.map(row=>row.map((v,i)=>{
  // Excel limits a cell to 32,767 characters. The separate history sheets preserve every entry.
  const text=String(v??'');return text.length>32000&&i>=data.fields.findIndex(([,key])=>key==='_activity_history')?text.slice(0,31940)+'… See history sheets for full entries.':v;
 }));
 XLSX.utils.book_append_sheet(wb,exportSheet(data.fields.map(([label])=>label),leadData),'Leads');
 const names=new Map(leadRows.map(l=>[l.id,l.name]));
 XLSX.utils.book_append_sheet(wb,exportSheet(['Lead ID','Name','Date (IST)','Type','Outcome','Call or conversation note','Staff ID'],activities.map(a=>[a.lead_id,names.get(a.lead_id)||'',exportDate(a.created_at),a.activity_type,a.outcome,a.note,a.actor_id])),'Conversations');
 XLSX.utils.book_append_sheet(wb,exportSheet(['Lead ID','Name','Date (IST)','Earlier CRM event','Source','Full details'],legacy.map(e=>[e.lead_id,names.get(e.lead_id)||'',exportDate(e.occurred_at),e.summary,e.source_table,JSON.stringify(e.details||{})])),'Earlier CRM');
 XLSX.utils.book_append_sheet(wb,exportSheet(['Lead ID','Name','Date (IST)','Changed by','Full changes'],changes.map(c=>[c.lead_id,names.get(c.lead_id)||'',exportDate(c.changed_at),c.actor_email||'System',JSON.stringify(c.changes||{})])),'Profile changes');
 XLSX.writeFile(wb,'nia-full-leads-'+new Date().toISOString().slice(0,10)+'.xlsx');
}

async function exportFull(format){
 if(format==='xlsx'&&typeof XLSX==='undefined'){status('Excel support is unavailable. Use CSV export.');return;}
 exportCsvButton.disabled=exportExcelButton.disabled=true;
 try{
  let leadRows;
  if(demo)leadRows=leads.slice();
  else{
   leadRows=[];
   for(let offset=0;;offset+=1000){
    status('Loading complete lead records for export… '+leadRows.length+' loaded');
    const page=await request('/rest/v1/leads?select=*&order=created_at.desc&limit=1000&offset='+offset);
    if(!Array.isArray(page))throw Error('Could not read leads for export.');
    leadRows.push(...page);
    if(page.length<1000)break;
   }
  }
  if(!leadRows.length){status('No leads to export.');return;}
  const ids=leadRows.map(l=>l.id);
  status('Loading call outcomes, notes and earlier CRM history…');
  const activities=demo?demoActivities.filter(a=>ids.includes(a.lead_id)):await exportTable('lead_activities','created_at',ids);
  const legacy=demo?[]:await exportTable('crm_legacy_events','occurred_at',ids);
  const changes=demo?[]:await exportTable('lead_change_history','changed_at',ids);
  const data=exportRows(leadRows,activities,legacy,changes);
  if(format==='csv')exportDownloadCsv(data);
  else exportDownloadExcel(data,leadRows,activities,legacy,changes);
  status('Exported '+leadRows.length+' leads, '+activities.length+' conversations, '+legacy.length+' earlier CRM events and '+changes.length+' profile changes.');
 }catch(error){status('Export stopped; no partial file was downloaded. '+error.message);}
 finally{exportCsvButton.disabled=exportExcelButton.disabled=false;}
}
exportCsvButton.addEventListener('click',()=>exportFull('csv'));
exportExcelButton.addEventListener('click',()=>exportFull('xlsx'));
