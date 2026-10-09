-- Private staff inbox; external account and participant IDs are strings, never phone numbers.
create table if not exists public.meta_threads (
 id uuid primary key default gen_random_uuid(),
 channel text not null check(channel in ('facebook','instagram')),
 account_id text not null, participant_id text not null,
 participant_name text not null default '', meta_conversation_id text,
 lead_id uuid references public.leads(id), latest_at timestamptz,
 unique(channel,account_id,participant_id)
);
create table if not exists public.meta_messages (
 id uuid primary key default gen_random_uuid(),thread_id uuid not null references public.meta_threads(id),
 message_id text not null, direction text not null check(direction in ('incoming','outgoing')),
 body text not null default '',event_at timestamptz not null,
 unique(thread_id,message_id)
);
create index if not exists meta_messages_thread_time on public.meta_messages(thread_id,event_at);
create table if not exists public.meta_reply_attempts (
 request_id uuid primary key,thread_id uuid not null references public.meta_threads(id),
 body text not null,created_by uuid not null,state text not null default 'sending' check(state in ('sending','accepted','failed','unknown')),
 message_id text,error_code text,created_at timestamptz not null default now()
);
alter table public.meta_threads enable row level security;
alter table public.meta_messages enable row level security;
alter table public.meta_reply_attempts enable row level security;
revoke all on public.meta_threads,public.meta_messages,public.meta_reply_attempts from anon,authenticated;
grant select on public.meta_threads,public.meta_messages,public.meta_reply_attempts to authenticated;
grant all on public.meta_threads,public.meta_messages,public.meta_reply_attempts to service_role;
drop policy if exists meta_threads_staff on public.meta_threads;
create policy meta_threads_staff on public.meta_threads for select to authenticated using(exists(select 1 from public.crm_staff where user_id=auth.uid()));
drop policy if exists meta_messages_staff on public.meta_messages;
create policy meta_messages_staff on public.meta_messages for select to authenticated using(exists(select 1 from public.crm_staff where user_id=auth.uid()));
drop policy if exists meta_attempts_staff on public.meta_reply_attempts;
create policy meta_attempts_staff on public.meta_reply_attempts for select to authenticated using(exists(select 1 from public.crm_staff where user_id=auth.uid()));
create or replace function public.meta_ingest_message(p_channel text,p_account text,p_participant text,p_name text,p_conversation text,p_message text,p_direction text,p_body text,p_at timestamptz)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare thread uuid;
begin
 if p_channel not in ('facebook','instagram') or p_account='' or p_participant='' or p_message='' or p_at>now()+interval '5 minutes' then raise exception 'Invalid message';end if;
 insert into meta_threads(channel,account_id,participant_id,participant_name,meta_conversation_id,latest_at)
 values(p_channel,p_account,p_participant,left(coalesce(p_name,''),200),p_conversation,p_at)
 on conflict(channel,account_id,participant_id) do update set latest_at=greatest(meta_threads.latest_at,excluded.latest_at),
 participant_name=case when excluded.participant_name<>'' then excluded.participant_name else meta_threads.participant_name end,
 meta_conversation_id=coalesce(excluded.meta_conversation_id,meta_threads.meta_conversation_id) returning id into thread;
 insert into meta_messages(thread_id,message_id,direction,body,event_at) values(thread,p_message,p_direction,left(coalesce(p_body,''),10000),p_at) on conflict(thread_id,message_id) do nothing;
 return thread;
end $$;
revoke all on function public.meta_ingest_message(text,text,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.meta_ingest_message(text,text,text,text,text,text,text,text,timestamptz) to service_role;
create or replace function public.meta_link_lead(p_thread uuid,p_lead uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from crm_staff where user_id=auth.uid()) then raise exception 'Staff access required';end if;
 update meta_threads set lead_id=p_lead where id=p_thread;
 if not found then raise exception 'Conversation not found';end if;
end $$;
revoke all on function public.meta_link_lead(uuid,uuid) from public,anon;
grant execute on function public.meta_link_lead(uuid,uuid) to authenticated;
