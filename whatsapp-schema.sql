-- Additive messaging storage. Apply after crm-schema.sql.
begin;
create table if not exists public.wa_events (
 event_key text primary key,
 phone_number_id text not null,
 kind text not null check(kind in ('incoming','status')),
 message_id text not null,
 contact_id text not null,
 event_at timestamptz not null,
 body text not null default '',
 status text not null default '',
 received_at timestamptz not null default now()
);
create index if not exists wa_events_contact on public.wa_events(contact_id,event_at desc);
alter table public.wa_events enable row level security;
revoke all on public.wa_events from anon,authenticated;
grant select on public.wa_events to authenticated;
create policy "Staff read WhatsApp events" on public.wa_events for select to authenticated using(exists(select 1 from public.crm_staff where user_id=(select auth.uid())));
-- Consent belongs to a normalized recipient, so duplicates cannot bypass opt-out.
create table if not exists public.wa_permissions (
 contact_id text primary key check(contact_id ~ '^[0-9]{8,15}$'),
 opted_in boolean not null default false,
 evidence text not null check(char_length(evidence) between 1 and 1000),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
alter table public.wa_permissions enable row level security;
revoke all on public.wa_permissions from anon,authenticated;
grant select on public.wa_permissions to authenticated;
create policy "Staff read WhatsApp consent" on public.wa_permissions for select to authenticated using(exists(select 1 from public.crm_staff where user_id=(select auth.uid())));
-- Writes and campaign sending will be added through staff-validated server actions.
commit;
