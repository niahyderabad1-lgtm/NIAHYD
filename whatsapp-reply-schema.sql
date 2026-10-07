begin;
create table public.wa_outgoing (
 request_id uuid primary key,
 staff_id uuid not null references auth.users(id),
 contact_id text not null,
 body text not null check(char_length(body) between 1 and 4096),
 state text not null default 'sending' check(state in ('sending','accepted','failed','uncertain')),
 message_id text,
 created_at timestamptz not null default now()
);
alter table public.wa_outgoing enable row level security;
revoke all on public.wa_outgoing from anon,authenticated;
grant select on public.wa_outgoing to authenticated;
create policy "Staff read outgoing messages" on public.wa_outgoing for select to authenticated using(exists(select 1 from public.crm_staff where user_id=auth.uid()));
commit;
