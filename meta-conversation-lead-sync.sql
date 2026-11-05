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

-- Backfill conversations received before automatic lead creation was enabled.
-- Unknown profile fields remain explicit for staff to complete in the CRM.
with pending as (
  select t.id, t.channel, t.participant_id, t.participant_name, t.latest_at,
         coalesce(nullif(left(trim(t.participant_name), 100), ''), initcap(t.channel) || ' enquiry') as display_name
  from public.meta_threads t
  where t.lead_id is null
), created as (
  insert into public.leads (name, phone, company, category, email, source, notes, attribution)
  select display_name, '', 'Not yet supplied', 'Not yet supplied', '',
         'Meta ' || initcap(channel) || ' conversation',
         'Historic Meta conversation imported. Contact details pending in CRM inbox.',
         jsonb_build_object('meta_thread_id', id, 'meta_channel', channel,
                            'meta_participant_id', participant_id,
                            'meta_first_message_at', latest_at)
  from pending
  returning id, attribution->>'meta_thread_id' as thread_id
)
update public.meta_threads t
set lead_id = c.id
from created c
where t.id::text = c.thread_id and t.lead_id is null;

create table if not exists public.meta_auto_replies (
  thread_id uuid primary key references public.meta_threads(id) on delete cascade,
  state text not null default 'reserved' check (state in ('reserved','accepted','unknown')),
  message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.meta_auto_replies enable row level security;
revoke all on public.meta_auto_replies from anon, authenticated;
grant all on public.meta_auto_replies to service_role;
create or replace function public.meta_claim_auto_reply(p_thread uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare claimed uuid;
begin
  insert into public.meta_auto_replies(thread_id)
  select p_thread
  where not exists (select 1 from public.meta_messages where thread_id=p_thread and direction='outgoing')
  on conflict do nothing
  returning thread_id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.meta_claim_auto_reply(uuid) from public, anon, authenticated;
grant execute on function public.meta_claim_auto_reply(uuid) to service_role;

commit;
