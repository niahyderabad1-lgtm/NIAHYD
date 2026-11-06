-- Run only after crm-legacy-preview.sql has been reviewed.
-- Idempotent: imports uniquely identified historical leads, links exact matches,
-- and keeps original activity read-only. It never changes current lead records.
begin;
set local time zone 'UTC';

create table if not exists legacy_hub.lead_links (
  backup_sha256 text not null,
  source_id text not null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (backup_sha256,source_id)
);
revoke all on legacy_hub.lead_links from public,anon,authenticated;

create table if not exists public.crm_legacy_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  backup_sha256 text not null,
  source_table text not null,
  source_id text not null,
  occurred_at timestamptz not null,
  summary text not null,
  details jsonb not null,
  unique (backup_sha256,source_table,source_id)
);
create index if not exists crm_legacy_events_lead_date_idx on public.crm_legacy_events(lead_id,occurred_at desc);
alter table public.crm_legacy_events enable row level security;
revoke all on public.crm_legacy_events from anon,authenticated;
grant select on public.crm_legacy_events to authenticated;
drop policy if exists "Staff read legacy activity" on public.crm_legacy_events;
create policy "Staff read legacy activity" on public.crm_legacy_events for select to authenticated
using (exists(select 1 from public.crm_staff where user_id=(select auth.uid())));

with source as (
  select source_id,payload,
    regexp_replace(coalesce(payload->>'phone',''),'[^0-9]','','g') raw_phone,
    lower(trim(coalesce(payload->>'email',''))) email
  from legacy_hub.records
  where backup_sha256='dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece'
    and source_table='crm_leads'
), normalized as (
  select source_id,payload,email,
    case when length(raw_phone)=10 then '91'||raw_phone else raw_phone end phone
  from source
), ranked as (
  select *,count(*) over(partition by phone) source_phone_count,
    count(*) over(partition by email) source_email_count
  from normalized
)
insert into public.leads(created_at,name,phone,company,category,email,stage,payment_status,owner,
  follow_up,next_follow_up_at,source,notes,website,business_address,years_in_business,
  turnover_range,referred_by,qualification_notes,fit_status,disposition,disposition_reason,
  legacy_group_name,legacy_source_id,qualified_group_id)
select
  coalesce(nullif(r.payload->>'createdAt','')::timestamp at time zone 'UTC',now()),
  left(trim(r.payload->>'name'),100),r.phone,
  left(coalesce(nullif(trim(r.payload->>'company'),''),'Not provided'),150),
  left(coalesce(nullif(trim(r.payload->>'category'),''),'Unspecified'),100),
  left(coalesce(r.payload->>'email',''),320),
  case
    when r.payload->>'leadStatus' in ('not_interested','not_suitable','non_responsive','lead_dropped') then 'Not proceeding'
    when r.payload->>'leadStatus'='follow_up' then 'Contacted'
    when r.payload->>'leadStatus' in ('to_attend_meeting','confirmed_for_meeting') then 'Qualified'
    when r.payload->>'leadStatus' in ('final_discussions','joiner_to_pay','paid_to_be_onboarded') then 'Membership discussion'
    else 'New enquiry' end,
  'unpaid',
  left(coalesce(staff.payload->>'name',''),100),
  case when nullif(r.payload->>'nextCallAt','') is not null
    then ((r.payload->>'nextCallAt')::timestamp at time zone 'UTC' at time zone 'Asia/Kolkata')::date end,
  case when nullif(r.payload->>'nextCallAt','') is not null
    then (r.payload->>'nextCallAt')::timestamp at time zone 'UTC' end,
  left(coalesce(nullif(r.payload->>'campaignSource',''),'Member Operations Hub'),100),
  left(coalesce(r.payload->>'notes',''),5000),
  left(coalesce(r.payload->>'website',''),500),
  left(coalesce(r.payload->>'businessAddress',''),500),
  left(coalesce(r.payload->>'experienceYears',''),60),
  left(coalesce(r.payload->>'annualTurnoverRange',''),100),
  left(coalesce(r.payload->>'referrer',''),150),
  left(concat_ws(E'\n',nullif(r.payload->>'lastCallNotes',''),nullif(r.payload->>'bio','')),2000),
  case when r.payload->>'leadStatus'='not_suitable' then 'Not a fit' else 'Not reviewed' end,
  r.payload->>'leadStatus',
  left(coalesce(r.payload->>'noLongerNeededReason',''),120),
  left(coalesce(group_record.payload->>'name',''),150),r.source_id,target_group.id
from ranked r
left join legacy_hub.records group_record
  on group_record.backup_sha256='dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece'
  and group_record.source_table='crm_groups' and group_record.source_id=r.payload->>'groupId'
left join legacy_hub.records staff
  on staff.backup_sha256='dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece'
  and staff.source_table='users' and staff.source_id=r.payload->>'updatedBy'
left join public.crm_team_groups target_group
  on target_group.legacy_id=nullif(r.payload->>'qualifiedGroupId','')::integer
where r.phone ~ '^[0-9]{10,15}$'
  and coalesce(r.payload->>'groupId','')<>'30001'
  and length(trim(coalesce(r.payload->>'name',''))) between 1 and 100
  and r.source_phone_count=1 and (r.email='' or r.source_email_count=1)
  and not exists (select 1 from public.leads current_lead where
    (case when length(regexp_replace(current_lead.phone,'[^0-9]','','g'))=10
      then '91'||regexp_replace(current_lead.phone,'[^0-9]','','g')
      else regexp_replace(current_lead.phone,'[^0-9]','','g') end)=r.phone
    or (r.email<>'' and lower(trim(current_lead.email))=r.email))
on conflict do nothing;

with source as (
  select source_id,payload,
    regexp_replace(coalesce(payload->>'phone',''),'[^0-9]','','g') raw_phone,
    lower(trim(coalesce(payload->>'email',''))) email
  from legacy_hub.records
  where backup_sha256='dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece'
    and source_table='crm_leads'
), normalized as (
  select source_id,payload,email,case when length(raw_phone)=10 then '91'||raw_phone else raw_phone end phone
  from source
), ranked as (
  select *,count(*) over(partition by phone) source_phone_count,
    count(*) over(partition by email) source_email_count
  from normalized
), matches as (
  select r.source_id,l.id,count(*) over(partition by r.source_id) match_count
  from ranked r join public.leads l on
    (case when length(regexp_replace(l.phone,'[^0-9]','','g'))=10
      then '91'||regexp_replace(l.phone,'[^0-9]','','g')
      else regexp_replace(l.phone,'[^0-9]','','g') end)=r.phone
  where r.phone ~ '^[0-9]{10,15}$' and coalesce(r.payload->>'groupId','')<>'30001' and r.source_phone_count=1
    and (r.email='' or r.source_email_count=1)
)
insert into legacy_hub.lead_links(backup_sha256,source_id,lead_id)
select 'dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece',source_id,id
from matches where match_count=1
on conflict do nothing;

insert into public.crm_legacy_events(lead_id,backup_sha256,source_table,source_id,occurred_at,summary,details)
select link.lead_id,record.backup_sha256,record.source_table,record.source_id,
  coalesce(nullif(record.payload->>'createdAt','')::timestamp at time zone 'UTC',now()),
  case record.source_table
    when 'crm_lead_changes' then 'Previous CRM change'
    when 'crm_callback_reminders' then 'Previous CRM callback'
    when 'crm_in_app_notifications' then 'Previous CRM reminder'
    else 'Previous CRM online check' end,
  record.payload
from legacy_hub.records record
join legacy_hub.lead_links link
  on link.backup_sha256=record.backup_sha256
  and link.source_id=record.payload->>'leadId'
where record.backup_sha256='dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece'
  and record.source_table in ('crm_lead_changes','crm_callback_reminders','crm_in_app_notifications','crm_basic_online_checks')
on conflict do nothing;

commit;

select
  (select count(*) from legacy_hub.records where backup_sha256='dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece') as archived_rows,
  (select count(*) from legacy_hub.lead_links where backup_sha256='dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece') as linked_leads,
  (select count(*) from public.leads where legacy_source_id is not null) as new_historical_leads,
  (select count(*) from public.crm_legacy_events where backup_sha256='dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece') as linked_history_items;
