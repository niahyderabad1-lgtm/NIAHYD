-- Admin-controlled guest payment availability. Public reads contain no private data.
begin;
create table if not exists public.guest_booking_settings (
 id smallint primary key default 1 check (id=1),
 accept_payments boolean not null default true,
 updated_at timestamptz not null default now()
);
insert into public.guest_booking_settings(id,accept_payments) values(1,true) on conflict(id) do nothing;
alter table public.guest_booking_settings enable row level security;
revoke all on public.guest_booking_settings from public,anon,authenticated;
grant select on public.guest_booking_settings to anon,authenticated;
drop policy if exists "Public reads booking availability" on public.guest_booking_settings;
create policy "Public reads booking availability" on public.guest_booking_settings for select to anon,authenticated using(true);
create or replace function public.set_guest_payment_acceptance(p_enabled boolean)
returns public.guest_booking_settings language plpgsql security definer set search_path='' as $$
declare result public.guest_booking_settings;
begin
 if not public.nia_config_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Choose on or off' using errcode='22023'; end if;
 update public.guest_booking_settings set accept_payments=p_enabled,updated_at=now() where id=1 returning * into result;
 return result;
end $$;
revoke all on function public.set_guest_payment_acceptance(boolean) from public,anon,authenticated;
grant execute on function public.set_guest_payment_acceptance(boolean) to authenticated;
commit;
