-- Run once in the Supabase SQL editor before deploying the matching webhook.
-- Incoming Facebook/Instagram conversations become CRM leads without inventing
-- phone, company or category data that Meta does not provide for DMs.
begin;

alter table public.leads
  add column if not exists attribution jsonb not null default '{}'::jsonb;

alter table public.leads
  alter column phone set default '',
  alter column company set default 'Not yet supplied',
  alter column category set default 'Not yet supplied';

alter table public.leads drop constraint if exists leads_phone_check;
alter table public.leads
  add constraint leads_phone_check
  check (phone = '' or char_length(phone) between 10 and 18);

create index if not exists meta_threads_lead_id on public.meta_threads(lead_id)
  where lead_id is not null;

commit;
