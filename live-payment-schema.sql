-- Live Razorpay order ledger for paid NIA Hyderabad guest bookings.
-- Apply after crm-schema.sql, intake-schema.sql and guest-message-schedule.sql.
begin;

create table if not exists public.guest_payment_orders (
  request_id uuid primary key references public.visitor_requests(request_id) on delete restrict,
  order_id text unique not null check (order_id ~ '^order_[A-Za-z0-9]+$'),
  amount integer not null default 260000 check (amount=260000),
  currency text not null default 'INR' check (currency='INR'),
  payment_id text unique,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.guest_payment_orders enable row level security;
revoke all on public.guest_payment_orders from public, anon, authenticated;
grant select, insert, update on public.guest_payment_orders to service_role;

commit;
