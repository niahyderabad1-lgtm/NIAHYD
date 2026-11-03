-- Meta Instant Form lead intake. Apply after crm-upgrade.sql.
begin;

create table if not exists public.meta_instant_form_leads (
 meta_lead_id text primary key check (meta_lead_id ~ '^[0-9]+$'),
 lead_id uuid references public.leads(id) on delete set null,
 page_id text not null check (page_id ~ '^[0-9]+$'),
 form_id text not null check (form_id ~ '^[0-9]+$'),
 ad_id text check (ad_id is null or ad_id ~ '^[0-9]+$'),
 adgroup_id text check (adgroup_id is null or adgroup_id ~ '^[0-9]+$'),
 submitted_at timestamptz,
 field_data jsonb not null default '{}'::jsonb,
 status text not null default 'received' check (status in ('received','imported','needs_review','failed')),
 error text not null default '' check (char_length(error)<=500),
 received_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists meta_instant_form_leads_form_received on public.meta_instant_form_leads(form_id,received_at desc);

alter table public.meta_instant_form_leads enable row level security;
revoke all on public.meta_instant_form_leads from anon,authenticated;
grant select on public.meta_instant_form_leads to authenticated;
create policy "Staff read Meta instant form leads" on public.meta_instant_form_leads
 for select to authenticated using (exists(select 1 from public.crm_staff where user_id=(select auth.uid())));
commit;
