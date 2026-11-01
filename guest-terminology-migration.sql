-- Run once in Supabase SQL Editor after publishing the CRM wording update.
-- Keeps existing lead records valid while changing the pipeline label.
begin;

alter table public.leads drop constraint if exists leads_stage_check;

update public.leads
set stage = 'Paid guest'
where stage = 'Paid visitor';

alter table public.leads
  add constraint leads_stage_check check (
    stage in (
      'New enquiry', 'Contacted', 'Qualified', 'Paid guest', 'Attended',
      'Membership discussion', 'Joined', 'Not proceeding'
    )
  );

-- Only locally stored drafts are changed. Meta-approved, pending or sent
-- templates remain immutable historical records and must be replaced through
-- a new Meta submission if wording changes are required.
update public.wa_templates
set
  components = replace(replace(components::text, 'Visitor', 'Guest'), 'visitor', 'guest')::jsonb,
  updated_at = now()
where status = 'DRAFT'
  and components::text ilike '%visitor%';

update public.wa_templates as draft
set name = replace(draft.name, 'visitor', 'guest'), updated_at = now()
where draft.status = 'DRAFT'
  and draft.name like '%visitor%'
  and not exists (
    select 1 from public.wa_templates as existing
    where existing.name = replace(draft.name, 'visitor', 'guest')
      and existing.language = draft.language
  );

commit;
