'use strict';
// Presentation layer: retain the existing protected CRM and campaign actions.
const uiNode=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const uiNav=$('.crm-tabs');$('aside').insertBefore(uiNav,$('aside .event'));uiNav.setAttribute('aria-label','Workspace navigation');
$('#pipeline-tab').textContent='Leads';
const followNav=uiNode('button','','Follow-ups');followNav.type='button';uiNav.insertBefore(followNav,$('#wa-broadcast-tab'));
const inboxNav=uiNode('button','','Conversations');inboxNav.type='button';uiNav.append(inboxNav);
const pageTitle=$('main h1');
function activeNav(b,title){for(const item of uiNav.children)item.setAttribute('aria-selected',String(item===b));pageTitle.textContent=title;}
const workspaceObserver=new MutationObserver(()=>{uiNav.hidden=$('#workspace').hidden;});workspaceObserver.observe($('#workspace'),{attributes:true,attributeFilter:['hidden']});uiNav.hidden=$('#workspace').hidden;
$('#pipeline-tab').addEventListener('click',()=>{activeNav($('#pipeline-tab'),'Guest leads');$('#queue-filter').value='';render();});
followNav.addEventListener('click',()=>{switchCrmTab(false);activeNav(followNav,'Follow-ups');$('#queue-filter').value='due';$('#lead-sort').value='followup';resetLeadPage();});
$('#wa-broadcast-tab').addEventListener('click',()=>{activeNav($('#wa-broadcast-tab'),'WhatsApp broadcasts');showBroadcastSection('campaigns');});
inboxNav.addEventListener('click',()=>{switchCrmTab(true);activeNav(inboxNav,'Conversations');showBroadcastSection('conversations');});
// Keep the existing controls together in dedicated workspaces.
const waRoot=$('#wa-broadcast-panel details.campaign-summary');waRoot.open=true;waRoot.querySelector(':scope > summary').hidden=true;
const waTabs=uiNode('nav','broadcast-tabs');waTabs.setAttribute('aria-label','Broadcast sections');waRoot.insertBefore(waTabs,$('#wa-template-builder'));
let refreshWizard=()=>{};const sections={};for(const [key,title] of [['campaigns','Campaigns'],['templates','Templates'],['contacts','Contacts'],['conversations','Replies & delivery']]){const panel=uiNode('section','workspace-card');panel.id='ui-'+key;sections[key]=panel;waRoot.append(panel);const b=uiNode('button','',title);b.type='button';b.dataset.section=key;b.addEventListener('click',()=>showBroadcastSection(key));waTabs.append(b);}
function moveRange(first,end,panel){let n=first;while(n&&n!==end){const next=n.nextElementSibling;panel.append(n);n=next;}}
const contactHeading=$('#wa-import-form').previousElementSibling.previousElementSibling;
const templateHeading=$('#wa-template-sync').previousElementSibling;
moveRange(contactHeading,templateHeading,sections.contacts);
moveRange(templateHeading,$('#wa-campaign-form'),sections.templates);
sections.templates.insertBefore($('#wa-template-builder'),sections.templates.firstChild);
moveRange($('#wa-campaign-form'),$('#wa-refresh'),sections.campaigns);
moveRange($('#wa-refresh'),sections.campaigns,sections.conversations); // Stop at the panels appended above.
// The previous range includes section nodes; keep all sections as siblings.
for(const panel of Object.values(sections))if(panel.parentNode!==waRoot)waRoot.append(panel);
sections.contacts.prepend($('#wa-consent-form').closest('details'));
// Shared feedback remains visible across every broadcast section.
waRoot.insertBefore($('#wa-status'),waTabs.nextSibling);
function showBroadcastSection(key){if(key==='campaigns')refreshWizard();for(const [k,p] of Object.entries(sections))p.hidden=k!==key;for(const b of waTabs.children)b.setAttribute('aria-selected',String(b.dataset.section===key));}
showBroadcastSection('campaigns');
// Search, owner/source filters and sorting all use the same lead predicate.
const toolbar=$('#pipeline-panel .toolbar');
for(const [id,label] of [['owner-filter','All owners'],['source-filter','All sources']]){const select=uiNode('select');select.id=id;select.setAttribute('aria-label',label);select.append(new Option(label,''));toolbar.insertBefore(select,$('#export'));select.addEventListener('change',resetLeadPage);}
const sort=uiNode('select');sort.id='lead-sort';sort.setAttribute('aria-label','Sort leads');for(const [v,label] of [['recent','Newest first'],['name','Name A–Z'],['followup','Next follow-up'],['stage','Stage']])sort.append(new Option(label,v));toolbar.insertBefore(sort,$('#export'));sort.addEventListener('change',resetLeadPage);
const count=uiNode('p','hint');count.id='lead-result-count';toolbar.after(count);
const originalRender=render;render=function(){for(const [id,key,label] of [['owner-filter','owner','All owners'],['source-filter','source','All sources']]){const el=$('#'+id),saved=el.value;el.replaceChildren(new Option(label,''));for(const v of [...new Set(leads.map(l=>l[key]).filter(Boolean))].sort())el.append(new Option(v,v));el.value=saved;}
 originalRender();const query=$('#search').value.toLowerCase(),stage=$('#stage-filter').value;const matching=leads.filter(l=>uiLeadMatches(l)&&queueMatches(l)&&(!stage||l.stage===stage)&&[l.name,l.company,l.category,l.phone,l.email].some(v=>(v||'').toLowerCase().includes(query))).length;count.textContent=matching+' matching leads · '+leads.length+' total';for(const row of $('#rows').children){for(const idx of [3,5]){const td=row.children[idx],badge=uiNode('span','status-badge '+(td.textContent==='paid'?'badge-approved':'badge-neutral'),td.textContent);td.replaceChildren(badge);}}};
// A side drawer keeps list context visible while editing a lead.
$('#editor').classList.add('lead-drawer');
// Put the next conversation where staff can act on it without scrolling through a profile.
const editor=$('#editor'),profileForm=$('#edit-form'),editorHeader=profileForm.querySelector('header');
editor.prepend(editorHeader);
const activitySection=$('#activity-section'),activityForm=$('#activity-form'),activityList=$('#activity-list');
editorHeader.after(activitySection);
const quickTitle=uiNode('h3','','Next conversation');
const quickLinks=uiNode('div','quick-lead-links');
quickLinks.append($('#call-lead'),$('#whatsapp'));
const quickFields=uiNode('div','fields quick-follow-up-fields');
function quickSelect(id,title,original){const label=uiNode('label','',title),select=uiNode('select');select.id=id;for(const option of profileForm.elements[original].options)select.append(new Option(option.text,option.value));label.append(select);quickFields.append(label);return select;}
const quickStage=quickSelect('quick-stage','Stage','stage');
const callbackLabel=uiNode('label','','Next callback · India time');
const quickCallback=uiNode('input');quickCallback.id='quick-next-follow-up';quickCallback.type='datetime-local';callbackLabel.append(quickCallback);quickFields.append(callbackLabel);
const quickAction=quickSelect('quick-next-action','Next action','next_action');
for(const [quick,original] of [[quickStage,'stage'],[quickCallback,'next_follow_up_at'],[quickAction,'next_action']]){quick.addEventListener('change',()=>{profileForm.elements[original].value=quick.value;});profileForm.elements[original].addEventListener('change',()=>{quick.value=profileForm.elements[original].value;});}
activityForm.querySelector('.hint').textContent='Log the outcome and set a callback here. This updates the lead and its conversation history.';
activityForm.querySelector('.fields').after(quickFields);
const history=uiNode('details','lead-history'),historySummary=uiNode('summary','','Conversation history');history.append(historySummary,activityList);
activitySection.replaceChildren(quickTitle,quickLinks,activityForm,history);
activitySection.classList.add('lead-quick-panel');
const profileTitle=uiNode('h3','profile-title','Lead profile');profileForm.prepend(profileTitle);
// Reusable WhatsApp-style previews use textContent for all submitted content.
function messagePreview(target,components,file){target.replaceChildren();target.className='message-preview';const phone=uiNode('div','wa-phone');phone.append(uiNode('div','wa-phone-title','NIA Hyderabad · 7997994495'));const bubble=uiNode('div','wa-bubble');phone.append(bubble);for(const c of components||[]){if(c.type==='HEADER'&&c.format!=='TEXT'){const media=uiNode('div','wa-media');if(file&&c.format==='IMAGE'){const img=uiNode('img');img.src=URL.createObjectURL(file);img.alt='Selected image header';img.onload=()=>URL.revokeObjectURL(img.src);media.append(img);}else if(file&&c.format==='VIDEO'){const video=uiNode('video');video.controls=true;video.src=URL.createObjectURL(file);video.onloadeddata=()=>URL.revokeObjectURL(video.src);media.append(video);}else media.textContent=c.format==='DOCUMENT'?'▤ '+(file?.name||'Document header'):(c.format==='VIDEO'?'▶ Video header':'▧ Image header');bubble.append(media);}if(c.text)bubble.append(uiNode(c.type==='FOOTER'?'small':'p',c.type==='HEADER'?'wa-header':'',c.text.replaceAll('{{1}}','Guest')));if(c.buttons)for(const b of c.buttons)bubble.append(uiNode('div','wa-message-button',b.text));}target.append(phone,uiNode('p','hint','Preview uses “Guest” as the example name. Final content follows the approved Meta template.'));}
function builderPreview(){const f=new FormData($('#wa-template-form')),kind=f.get('media_type'),cs=[];if(kind!=='TEXT')cs.push({type:'HEADER',format:kind});else if(f.get('header'))cs.push({type:'HEADER',format:'TEXT',text:f.get('header')});cs.push({type:'BODY',text:f.get('body')},{type:'FOOTER',text:f.get('footer')});if(f.get('url'))cs.push({type:'BUTTONS',buttons:[{text:f.get('button')}]});messagePreview($('#wa-template-preview'),cs,$('#wa-template-media').files[0]);}
$('#wa-template-preview-button').addEventListener('click',builderPreview);$('#wa-template-form').addEventListener('input',builderPreview);$('#wa-template-media').addEventListener('change',builderPreview);
function enhanceTemplateRows(){for(const row of $('#wa-template-rows').children){const td=row.children[4];if(!td.querySelector('.status-badge')){const value=td.textContent;td.replaceChildren(uiNode('span','status-badge badge-'+value.split(' ')[0].toLowerCase(),value));}const t=templateRows.find(t=>t.name===row.children[1].textContent&&t.language===row.children[2].textContent);const preview=row.querySelector('button');if(t&&preview&&!preview.dataset.visual){preview.dataset.visual='true';preview.addEventListener('click',()=>messagePreview($('#wa-selected-preview'),t.components));}const check=row.querySelector('input');if(t&&check&&!check.dataset.visual){check.dataset.visual='true';check.addEventListener('change',()=>{if(check.checked)messagePreview($('#wa-selected-preview'),t.components);updateWizardTemplates();});}}
 updateWizardTemplates();}
new MutationObserver(enhanceTemplateRows).observe($('#wa-template-rows'),{childList:true});
// Campaign wizard saves a draft only. Sending remains a separate reviewed action.
const campaignForm=$('#wa-campaign-form'),sourceLabel=$('#wa-recipient-source').closest('label'),nameLabel=campaignForm.querySelector('input[name=name]').closest('label'),saveButton=campaignForm.querySelector('button');
const wizard=uiNode('div','campaign-wizard'),steps=uiNode('ol','wizard-steps');for(const text of ['Template','Recipients','Review'])steps.append(uiNode('li','',text));campaignForm.prepend(wizard);wizard.append(steps);
const wizardPages=[0,1,2].map(()=>uiNode('div','wizard-page'));for(const p of wizardPages)wizard.append(p);
const chooserLabel=uiNode('label','','Approved template'),chooserSelect=uiNode('select');chooserSelect.id='wizard-template';chooserLabel.append(chooserSelect);wizardPages[0].append(uiNode('h3','','Choose your message'),chooserLabel);const templateLink=uiNode('button','','Browse or create templates');templateLink.type='button';templateLink.addEventListener('click',()=>showBroadcastSection('templates'));wizardPages[0].append(templateLink);
wizardPages[1].append(uiNode('h3','','Choose recipients'),nameLabel,sourceLabel);const contactsLink=uiNode('button','','Import or select contacts');contactsLink.type='button';contactsLink.addEventListener('click',()=>showBroadcastSection('contacts'));wizardPages[1].append(contactsLink,uiNode('p','hint','Flag individual leads in Guest pipeline, or select broadcast contacts. Only recorded marketing opt-ins enter the saved draft.'));
const review=uiNode('div');wizardPages[2].append(uiNode('h3','','Review your draft'),review,saveButton);saveButton.type='submit';saveButton.id='wa-save-campaign';saveButton.textContent='Save draft & verify recipients';
const wizardActions=uiNode('div','wizard-actions'),back=uiNode('button','','Back'),next=uiNode('button','primary','Continue');back.type=next.type='button';wizardActions.append(back,next);wizard.append(wizardActions);const wizardStatus=uiNode('p','hint');wizardStatus.setAttribute('role','status');wizard.append(wizardStatus);let wizardStep=0;
function updateWizardTemplates(){if(!chooserSelect)return;chooserSelect.replaceChildren(new Option('Select an approved template',''));for(const t of templateRows.filter(t=>t.status==='APPROVED'&&t.supported))chooserSelect.append(new Option(t.name+' · '+t.language,t.id));chooserSelect.value=selectedTemplate?.id||'';}
chooserSelect.addEventListener('change',()=>{selectedTemplate=templateRows.find(t=>t.id===chooserSelect.value&&t.status==='APPROVED'&&t.supported)||null;loadTemplates();});
function showWizard(){if(wizardStep===2&&!selectedTemplate)wizardStep=0;wizardPages.forEach((p,i)=>p.hidden=i!==wizardStep);[...steps.children].forEach((p,i)=>{p.className=i===wizardStep?'current':i<wizardStep?'complete':'';});back.hidden=wizardStep===0;next.hidden=wizardStep===2;if(wizardStep===2){const source=$('#wa-recipient-source').value;const audience=source==='contacts'?selectedContacts.size+' selected contacts':source==='flagged'?broadcastLeadIds.size+' flagged lead'+(broadcastLeadIds.size===1?'':'s'):'Filtered guest leads';review.replaceChildren(uiNode('p','','Campaign: '+campaignForm.elements.name.value),uiNode('p','','Template: '+selectedTemplate.name),uiNode('p','','Audience: '+audience),uiNode('p','hint','Only recipients with recorded marketing opt-in enter the draft. Review the actual recipient list below before launching.'));if(source==='flagged'){const chosen=leads.filter(l=>broadcastLeadIds.has(l.id));const list=uiNode('div','broadcast-review-list');list.textContent=chosen.map(l=>l.name+' · '+(l.phone||'No phone')).join('\n');review.append(list);}const preview=uiNode('div');review.append(preview);messagePreview(preview,selectedTemplate.components);}}
next.addEventListener('click',()=>{wizardStatus.textContent='';if(wizardStep===0&&!selectedTemplate){wizardStatus.textContent='Choose an approved template to continue.';return;}if(wizardStep===1&&!campaignForm.elements.name.reportValidity())return;if(wizardStep===1&&$('#wa-recipient-source').value==='contacts'&&!selectedContacts.size){wizardStatus.textContent='Select at least one opted-in contact in Contacts.';return;}if(wizardStep===1&&$('#wa-recipient-source').value==='flagged'){const numbers=new Set(leads.filter(l=>broadcastLeadIds.has(l.id)).map(l=>waNumber(l.phone)).filter(n=>/^[0-9]{8,15}$/.test(n)));if(!numbers.size){wizardStatus.textContent='Flag at least one lead with a valid WhatsApp number.';return;}if(numbers.size>500){wizardStatus.textContent='Choose no more than 500 unique recipients.';return;}}wizardStep++;showWizard();});back.addEventListener('click',()=>{wizardStep--;showWizard();});refreshWizard=()=>{wizardStep=0;showWizard();};showWizard();

// Lead data controls: display the original received date and offer practical sort choices.
const receivedAt=lead=>lead.attribution?.meta_received_at||lead.attribution?.meta_first_message_at||lead.created_at||'';
for(const [value,label] of [['oldest','Oldest received first'],['company','Business A–Z'],['phone','Phone number']])sort.append(new Option(label,value));
sort.options[0].text='Newest received first';
uiLeadSort=function(a,b){const mode=$('#lead-sort')?.value;if(mode==='name')return (a.name||'').localeCompare(b.name||'');if(mode==='company')return (a.company||'').localeCompare(b.company||'');if(mode==='phone')return (a.phone||'').localeCompare(b.phone||'');if(mode==='stage')return stages.indexOf(a.stage)-stages.indexOf(b.stage);if(mode==='followup')return (a.next_follow_up_at||a.follow_up||'9999').localeCompare(b.next_follow_up_at||b.follow_up||'9999');return mode==='oldest'?receivedAt(a).localeCompare(receivedAt(b)):receivedAt(b).localeCompare(receivedAt(a));};
const leadHeader=$('#rows').closest('table').querySelector('thead tr');const receivedHeader=uiNode('th','','Received');leadHeader.insertBefore(receivedHeader,leadHeader.children[3]);
const renderWithReceived=render;render=function(){renderWithReceived();const query=$('#search').value.toLowerCase(),stage=$('#stage-filter').value;const visible=leads.filter(l=>uiLeadMatches(l)&&queueMatches(l)&&(!stage||l.stage===stage)&&[l.name,l.company,l.category,l.phone,l.email].some(v=>(v||'').toLowerCase().includes(query))).sort(uiLeadSort);[...$('#rows').children].forEach((row,index)=>{const lead=visible[leadPage*LEAD_PAGE_SIZE+index],received=uiNode('td','',receivedAt(lead)?indiaTime(receivedAt(lead)):'—');received.dataset.label='Received';row.insertBefore(received,row.children[3]);for(const td of row.children){const content=td.textContent.trim();td.classList.toggle('empty-value',!content||content==='—');td.classList.toggle('quiet-value',(td.dataset.label==='Payment'&&content==='unpaid')||(td.dataset.label==='Disposition'&&['Open','Not set'].includes(content)));}});};
