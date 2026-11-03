-- One-to-one NIA Office meeting requests.
-- Apply after crm-schema.sql and intake-schema.sql in the Supabase SQL editor.
begin;

create table if not exists public.office_meetups (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 appointment_date date not null,
 slot_start time not null,
 slot_end time not null,
 calendar_event_id text unique,
 status text not null default 'holding' check (status in ('holding','requested','confirmed','declined','cancelled','completed')),
 staff_note text not null default '' check (char_length(staff_note) <= 1000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index office_meetups_one_active_slot on public.office_meetups(appointment_date,slot_start) where status in ('holding','requested','confirmed');

alter table public.office_meetups enable row level security;
revoke all on public.office_meetups from anon, authenticated;
grant select, update (status,staff_note,updated_at) on public.office_meetups to authenticated;
create policy "Staff read office meetups" on public.office_meetups for select to authenticated using (exists(select 1 from public.crm_staff where user_id=(select auth.uid())));
create policy "Staff update office meetups" on public.office_meetups for update to authenticated using (exists(select 1 from public.crm_staff where user_id=(select auth.uid()))) with check (exists(select 1 from public.crm_staff where user_id=(select auth.uid())));

create or replace function public.reserve_office_meetup(
 p_request_id uuid,
 p_bucket text,
 p_name text,
 p_phone text,
 p_company text,
 p_category text,
 p_email text,
 p_appointment_date date,
 p_slot_start time,
 p_attribution jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result uuid; meeting_id uuid; n int; slot_end time;
begin
 if p_phone !~ '^91[6-9][0-9]{9}$' then raise exception 'Invalid request'; end if;
 if extract(isodow from p_appointment_date) not between 1 and 6 or p_appointment_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'Choose a Monday–Saturday appointment date'; end if;
 if p_slot_start not in (time '10:00',time '11:00',time '12:00',time '13:00',time '14:00',time '15:00',time '16:00',time '17:00') then raise exception 'Choose an available one-hour slot'; end if;
 slot_end := p_slot_start + interval '1 hour';
 insert into public.intake_limits values(p_bucket,now(),1) on conflict(bucket) do update set hits=case when public.intake_limits.window_start<now()-interval '1 hour' then 1 else public.intake_limits.hits+1 end,window_start=case when public.intake_limits.window_start<now()-interval '1 hour' then now() else public.intake_limits.window_start end returning hits into n;
 if n>12 then raise exception 'Too many requests'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select lead_id into result from public.visitor_requests where request_id=p_request_id;
 if result is not null then return jsonb_build_object('lead_id',result); end if;
 if (select count(*) from public.leads where phone=p_phone and created_at>now()-interval '1 hour')>=3 then raise exception 'Too many requests'; end if;
 insert into public.leads(name,phone,company,category,email,source,notes) values(p_name,p_phone,p_company,p_category,p_email,'Guest landing page · Office meetup','Office 1-to-1 requested: '||to_char(p_appointment_date,'DD Mon YYYY')||' · '||to_char(p_slot_start,'HH12:MI AM')||'–'||to_char(slot_end,'HH12:MI AM')||' IST. Confirmation pending.') returning id into result;
 insert into public.office_meetups(lead_id,appointment_date,slot_start,slot_end) values(result,p_appointment_date,p_slot_start,slot_end) returning id into meeting_id;
 insert into public.visitor_requests(request_id,lead_id) values(p_request_id,result);
 return jsonb_build_object('lead_id',result,'meeting_id',meeting_id);
exception when unique_violation then
 raise exception 'That time is no longer available. Please choose another slot.';
end;$$;

create or replace function public.finalize_office_meetup(p_meeting_id uuid,p_calendar_event_id text)
returns void language sql security definer set search_path='' as $$
 update public.office_meetups set status='requested',calendar_event_id=p_calendar_event_id,updated_at=now() where id=p_meeting_id and status='holding';
$$;

create or replace function public.cancel_office_meetup_hold(p_meeting_id uuid)
returns void language sql security definer set search_path='' as $$
 update public.office_meetups set status='cancelled',staff_note='Calendar creation failed; slot released.',updated_at=now() where id=p_meeting_id and status='holding';
$$;

-- Allow the CRM administrator to rotate the two calendar settings through the
-- existing encrypted-configuration panel. Existing Meta/Razorpay settings are
-- retained unchanged.
create or replace function public.nia_config_save(p_name text,p_value text) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if not public.nia_config_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if not p_name = any(array['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_WABA_ID','WHATSAPP_VERIFY_TOKEN','META_APP_SECRET','META_PAGE_ACCESS_TOKEN','META_FACEBOOK_PAGE_ID','META_INSTAGRAM_ACCOUNT_ID','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET','GOOGLE_CALENDAR_ID','GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON']) or p_name is null then raise exception 'Unsupported setting'; end if;
 if p_value is null or length(trim(p_value))<8 or length(p_value)>8192 or p_value ~ '[\r\n]' then raise exception 'Check credential format'; end if;
 if p_name='RAZORPAY_KEY_ID' and p_value not like 'rzp_test_%' then raise exception 'Only test payment credentials are supported'; end if;
 if p_name in ('WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_WABA_ID','META_FACEBOOK_PAGE_ID','META_INSTAGRAM_ACCOUNT_ID') and p_value !~ '^[0-9]+$' then raise exception 'Use the numeric ID from Meta'; end if;
 if p_name='GOOGLE_CALENDAR_ID' and p_value !~ '^[^[:space:]]+@[^[:space:]]+$' then raise exception 'Use the Google Calendar ID'; end if;
 if p_name='GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON' and (p_value !~ '^\{' or p_value !~ '"private_key"') then raise exception 'Use the complete Google service-account JSON'; end if;
 perform pg_advisory_xact_lock(hashtext('nia_config:'||p_name));
 select id into sid from vault.secrets where name='nia_config:'||p_name;
 if sid is null then perform vault.create_secret(trim(p_value),'nia_config:'||p_name); else perform vault.update_secret(sid,trim(p_value)); end if;
 insert into public.nia_config_audit(actor,setting) values(auth.uid(),p_name);
end $$;

revoke all on function public.reserve_office_meetup(uuid,text,text,text,text,text,text,date,time,jsonb),public.finalize_office_meetup(uuid,text),public.cancel_office_meetup_hold(uuid) from public,anon,authenticated;
grant execute on function public.reserve_office_meetup(uuid,text,text,text,text,text,text,date,time,jsonb),public.finalize_office_meetup(uuid,text),public.cancel_office_meetup_hold(uuid) to service_role;
commit;
