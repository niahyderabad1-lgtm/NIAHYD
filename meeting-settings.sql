-- Public meeting information only. Staff credentials and leads remain private.
begin;
create table if not exists public.meeting_settings (
 id smallint primary key default 1 check (id = 1),
 meeting_date date not null,
 start_time time without time zone not null,
 end_time time without time zone not null,
 venue text not null check (char_length(btrim(venue)) between 1 and 200),
 address text not null default '' check (char_length(address) <= 500),
 after_meeting text not null default 'Followed by dinner' check (char_length(after_meeting) <= 200),
 revision integer not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 check (end_time > start_time)
);
alter table public.meeting_settings enable row level security;
revoke all on public.meeting_settings from public, anon, authenticated;
grant select on public.meeting_settings to anon, authenticated;
drop policy if exists "Anyone reads published meeting" on public.meeting_settings;
create policy "Anyone reads published meeting" on public.meeting_settings for select to anon, authenticated using (true);
insert into public.meeting_settings (id,meeting_date,start_time,end_time,venue)
 values (1,'2026-10-14','18:00','21:00','Novotel HICC Hyderabad') on conflict (id) do nothing;
-- No browser role can write the table directly. The RPC checks staff membership
-- and revision, so an old browser cannot overwrite another staff member's edit.
create or replace function public.update_meeting_settings(
 p_date date, p_start time without time zone, p_end time without time zone,
 p_venue text, p_address text, p_after text, p_revision integer
) returns public.meeting_settings language plpgsql security definer set search_path = '' as $$
declare result public.meeting_settings;
begin
 if not exists(select 1 from public.crm_staff where user_id=auth.uid()) then
  raise exception 'Authorised staff sign-in required' using errcode='42501';
 end if;
 if p_date is null or p_start is null or p_end is null or p_end <= p_start or
    p_venue is null or char_length(btrim(p_venue)) not between 1 and 200 or
    p_address is null or char_length(p_address)>500 or
    p_after is null or char_length(p_after)>200 then
  raise exception 'Check the meeting date, times and venue' using errcode='22023';
 end if;
 update public.meeting_settings set meeting_date=p_date,start_time=p_start,end_time=p_end,
  venue=btrim(p_venue),address=btrim(p_address),after_meeting=btrim(p_after),
  revision=revision+1,updated_at=now()
 where id=1 and revision=p_revision returning * into result;
 if not found then raise exception 'Meeting changed in another session. Reload settings before saving.' using errcode='40001'; end if;
 return result;
end $$;
revoke all on function public.update_meeting_settings(date,time,time,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.update_meeting_settings(date,time,time,text,text,text,integer) to authenticated;
commit;
