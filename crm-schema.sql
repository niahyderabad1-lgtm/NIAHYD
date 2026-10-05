-- Apply to a NEW Supabase project. Review and test policies before collecting real leads.
create table public.crm_staff (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.crm_staff enable row level security;
revoke all on public.crm_staff from anon, authenticated;
grant select on public.crm_staff to authenticated;
create policy "Staff can see their own membership" on public.crm_staff for select to authenticated using (user_id = (select auth.uid()));
create table public.leads (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 name text not null check (char_length(name) between 1 and 100),
 phone text not null check (char_length(phone) between 10 and 18),
 company text not null check (char_length(company) between 1 and 150),
 category text not null check (char_length(category) between 1 and 100),
 email text not null default '',
 stage text not null default 'New enquiry' check (stage in ('New enquiry','Contacted','Qualified','Paid visitor','Attended','Membership discussion','Joined','Not proceeding')),
 payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
 payment_reference text,
 owner text not null default '',
 follow_up date,
 source text not null default 'Manual',
 notes text not null default '' check (char_length(notes)<=5000)
);
alter table public.leads enable row level security;
revoke all on public.leads from anon, authenticated;
grant select on public.leads to authenticated;
grant insert (name,phone,company,category,email,stage,owner,follow_up,source,notes) on public.leads to authenticated;
grant update (name,phone,company,category,email,stage,owner,follow_up,source,notes) on public.leads to authenticated;
create policy "Staff read leads" on public.leads for select to authenticated using (exists(select 1 from public.crm_staff where user_id=(select auth.uid())));
create policy "Staff add leads" on public.leads for insert to authenticated with check (exists(select 1 from public.crm_staff where user_id=(select auth.uid())));
create policy "Staff update leads" on public.leads for update to authenticated using (exists(select 1 from public.crm_staff where user_id=(select auth.uid()))) with check (exists(select 1 from public.crm_staff where user_id=(select auth.uid())));
-- Add authorised staff via the SQL editor after inviting them through Supabase Auth:
-- insert into public.crm_staff(user_id) values ('ACTUAL-STAFF-AUTH-UUID');
-- Anonymous users receive no access. No client can modify payment_status/reference.
-- Public landing-page intake must use a separately validated, rate-limited backend endpoint.
