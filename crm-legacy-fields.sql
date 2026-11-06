-- Additive lead disposition and group routing for the current Supabase CRM.
begin;

create table if not exists public.crm_team_groups (
  id uuid primary key default gen_random_uuid(),
  legacy_id integer unique,
  name text not null unique check (char_length(name) between 1 and 150),
  description text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.crm_team_groups enable row level security;
revoke all on public.crm_team_groups from anon, authenticated;
grant select on public.crm_team_groups to authenticated;
drop policy if exists "Staff read team groups" on public.crm_team_groups;
create policy "Staff read team groups" on public.crm_team_groups for select to authenticated
using (exists(select 1 from public.crm_staff where user_id=(select auth.uid())));

insert into public.crm_team_groups(legacy_id,name) values
  (1,'Group 01'),(90001,'Group 02'),(90002,'Group 03'),(90003,'Group 04'),(90004,'Group 05')
on conflict (legacy_id) do nothing;

alter table public.leads add column if not exists disposition text;
alter table public.leads add column if not exists disposition_reason text not null default '';
alter table public.leads add column if not exists legacy_group_name text not null default '';
alter table public.leads add column if not exists legacy_source_id text;
alter table public.leads add column if not exists qualified_group_id uuid references public.crm_team_groups(id);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='leads_disposition_check' and conrelid='public.leads'::regclass) then
    alter table public.leads add constraint leads_disposition_check
      check (disposition in ('open','not_interested','not_suitable','non_responsive','follow_up',
        'to_attend_meeting','confirmed_for_meeting','final_discussions','joiner_to_pay',
        'paid_to_be_onboarded','lead_dropped')) not valid;
  end if;
end $$;
create unique index if not exists leads_legacy_source_id_unique on public.leads(legacy_source_id) where legacy_source_id is not null;
create index if not exists leads_qualified_group_idx on public.leads(qualified_group_id);
grant insert (disposition,disposition_reason,qualified_group_id) on public.leads to authenticated;
grant update (disposition,disposition_reason,qualified_group_id) on public.leads to authenticated;

create or replace function public.record_lead_changes() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_data jsonb; new_data jsonb; delta jsonb := '{}'::jsonb; field text;
begin
  old_data := to_jsonb(old); new_data := to_jsonb(new);
  foreach field in array array['name','phone','company','category','email','stage','owner','source','notes',
    'next_follow_up_at','next_action','website','business_address','years_in_business',
    'turnover_range','referred_by','qualification_notes','fit_status','payment_status',
    'disposition','disposition_reason','qualified_group_id'] loop
    if old_data -> field is distinct from new_data -> field then
      delta := delta || jsonb_build_object(field,jsonb_build_object('before',old_data -> field,'after',new_data -> field));
    end if;
  end loop;
  if delta <> '{}'::jsonb then
    insert into public.lead_change_history(lead_id,actor_id,actor_email,changes)
    values(new.id,auth.uid(),auth.jwt()->>'email',delta);
  end if;
  return new;
end;$$;
commit;
