begin;
alter table public.leads add column if not exists next_follow_up_at timestamptz;
alter table public.leads add column if not exists next_action text not null default 'Call';
alter table public.leads add column if not exists attribution jsonb not null default '{}'::jsonb;
grant insert (next_follow_up_at,next_action) on public.leads to authenticated;
grant update (next_follow_up_at,next_action) on public.leads to authenticated;
create table if not exists public.lead_activities (
 id uuid primary key default gen_random_uuid(),lead_id uuid not null references public.leads(id),
 created_at timestamptz not null default now(),actor_id uuid not null references auth.users(id),
 activity_type text not null check(activity_type in ('Call','WhatsApp','Email','Meeting','Note')),
 outcome text not null check(char_length(outcome) between 1 and 100),
 note text not null check(char_length(note) between 1 and 4000)
);
alter table public.lead_activities enable row level security;
revoke all on public.lead_activities from anon,authenticated;
grant select on public.lead_activities to authenticated;
create policy "Staff read activity history" on public.lead_activities for select to authenticated using(exists(select 1 from public.crm_staff where user_id=(select auth.uid())));
create or replace function public.log_lead_activity(p_lead_id uuid,p_type text,p_outcome text,p_note text,p_stage text,p_next timestamptz,p_action text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.crm_staff where user_id=auth.uid()) then raise exception 'Staff access required'; end if;
 if p_action not in ('Call','WhatsApp','Email','Meeting','None') then raise exception 'Invalid next action'; end if;
 if p_stage not in ('Joined','Not proceeding') and p_next is null then raise exception 'Schedule a next follow-up for an active lead'; end if;
 update public.leads set stage=p_stage,next_follow_up_at=p_next,next_action=p_action,follow_up=(p_next at time zone 'Asia/Kolkata')::date where id=p_lead_id;
 if not found then raise exception 'Lead not found'; end if;
 insert into public.lead_activities(lead_id,actor_id,activity_type,outcome,note) values(p_lead_id,auth.uid(),p_type,p_outcome,p_note);
end;$$;
revoke all on function public.log_lead_activity(uuid,text,text,text,text,timestamptz,text) from public,anon;
grant execute on function public.log_lead_activity(uuid,text,text,text,text,timestamptz,text) to authenticated;
commit;
