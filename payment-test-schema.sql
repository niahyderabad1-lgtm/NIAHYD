begin;
create table public.visitor_test_orders (
 request_id uuid primary key references public.visitor_requests(request_id),
 order_id text unique not null check (order_id ~ '^order_[A-Za-z0-9]+$'),
 amount integer not null default 260000 check(amount=260000),
 currency text not null default 'INR' check(currency='INR'),
 payment_id text unique, verified_at timestamptz, created_at timestamptz not null default now()
);
alter table public.visitor_test_orders enable row level security;
revoke all on public.visitor_test_orders from public,anon,authenticated;
grant select,insert,update on public.visitor_test_orders to service_role;
commit;
