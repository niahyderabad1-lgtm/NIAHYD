-- Personalised WhatsApp guest-message scheduling.
-- Apply after crm-schema.sql, meeting-settings.sql, whatsapp-schema.sql and
-- whatsapp-template-schema.sql. This migration only creates the queue; it
-- never sends a WhatsApp message by itself.
begin;

create table if not exists public.guest_message_rules (
  purpose text primary key check (purpose in ('payment_confirmation','venue_reminder','final_reminder')),
  template_id uuid references public.wa_templates(id),
  parameter_order jsonb not null default '[]'::jsonb,
  enabled boolean not null default false,
  send_time time without time zone not null default '10:00',
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(parameter_order) = 'array')
);

create table if not exists public.guest_message_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  purpose text not null check (purpose in ('payment_confirmation','venue_reminder','final_reminder')),
  template_id uuid not null references public.wa_templates(id),
  -- Revision zero is reserved for the one-time payment confirmation. Using a
  -- real value rather than NULL makes the unique key enforceable in Postgres.
  meeting_revision integer not null default 0,
  recipient_name text not null check (char_length(recipient_name) between 1 and 200),
  recipient_phone text not null check (recipient_phone ~ '^91[6-9][0-9]{9}$'),
  parameters jsonb not null default '{}'::jsonb,
  parameter_order jsonb not null default '[]'::jsonb,
  scheduled_for timestamptz not null,
  state text not null default 'scheduled' check (state in ('scheduled','sending','accepted','delivered','read','failed','uncertain','skipped','cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  error_code text,
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id,purpose,meeting_revision)
);
create index if not exists guest_message_jobs_dispatch on public.guest_message_jobs(state,scheduled_for)
  where state='scheduled';
create index if not exists guest_message_jobs_lead on public.guest_message_jobs(lead_id,created_at desc);

alter table public.guest_message_rules enable row level security;
alter table public.guest_message_jobs enable row level security;
revoke all on public.guest_message_rules,public.guest_message_jobs from anon,authenticated;
grant select on public.guest_message_rules,public.guest_message_jobs to authenticated;
grant all on public.guest_message_rules,public.guest_message_jobs to service_role;
create policy "Staff read guest message rules" on public.guest_message_rules for select to authenticated
  using (exists(select 1 from public.crm_staff where user_id=auth.uid()));
create policy "Staff read guest message jobs" on public.guest_message_jobs for select to authenticated
  using (exists(select 1 from public.crm_staff where user_id=auth.uid()));

insert into public.guest_message_rules(purpose)
values ('payment_confirmation'),('venue_reminder'),('final_reminder')
on conflict (purpose) do nothing;

-- A staff member selects approved templates and defines the order of their
-- Meta body variables. Allowed values are: name, meeting_date, meeting_time,
-- venue, address and fee.
create or replace function public.configure_guest_message_rule(
  p_purpose text, p_template uuid, p_parameter_order jsonb, p_enabled boolean,
  p_send_time time without time zone default '10:00'
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare template_ok boolean;
begin
  if not exists(select 1 from crm_staff where user_id=auth.uid()) then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if p_purpose not in ('payment_confirmation','venue_reminder','final_reminder')
     or jsonb_typeof(p_parameter_order) <> 'array' then
    raise exception 'Invalid message rule' using errcode='22023';
  end if;
  select status='APPROVED' and supported into template_ok from wa_templates where id=p_template;
  if coalesce(template_ok,false)=false then
    raise exception 'Choose a supported approved WhatsApp template' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements_text(p_parameter_order) as v
            where v not in ('name','meeting_date','meeting_time','venue','address','fee')) then
    raise exception 'Unsupported personalisation field' using errcode='22023';
  end if;
  update guest_message_rules set template_id=p_template,parameter_order=p_parameter_order,
    enabled=p_enabled,send_time=p_send_time,updated_at=now() where purpose=p_purpose;
end $$;

-- Server-only scheduling. Call it after a verified payment, and again after a
-- meeting update to replace outstanding T-2 and final reminders.
create or replace function public.schedule_paid_guest_messages(p_lead uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.leads; m public.meeting_settings; r public.guest_message_rules;
  phone text; when_to timestamptz; count_created integer:=0; purpose_date date;
begin
  select * into l from public.leads where id=p_lead and payment_status='paid';
  if not found then raise exception 'Paid guest not found' using errcode='22023'; end if;
  select * into m from public.meeting_settings where id=1;
  if not found then raise exception 'Meeting settings are unavailable'; end if;
  phone:=regexp_replace(l.phone,'[^0-9]','','g');
  if length(phone)=10 then phone:='91'||phone; end if;
  if phone !~ '^91[6-9][0-9]{9}$' then raise exception 'Guest phone is invalid'; end if;

  -- A new meeting revision supersedes unsent date-specific reminders.
  update public.guest_message_jobs set state='cancelled',updated_at=now()
   where lead_id=l.id and purpose in ('venue_reminder','final_reminder')
     and state='scheduled' and meeting_revision is distinct from m.revision;

  for r in select * from public.guest_message_rules where enabled and template_id is not null loop
    if r.purpose='payment_confirmation' then
      when_to:=now();
    elsif r.purpose='venue_reminder' then
      purpose_date:=m.meeting_date-2;
      when_to:=(purpose_date+r.send_time) at time zone 'Asia/Kolkata';
    else
      purpose_date:=m.meeting_date;
      when_to:=(purpose_date+r.send_time) at time zone 'Asia/Kolkata';
    end if;
    -- Do not create a past reminder for a late payment.
    if when_to < now() and r.purpose<>'payment_confirmation' then continue; end if;
    insert into public.guest_message_jobs(
      lead_id,purpose,template_id,meeting_revision,recipient_name,recipient_phone,
      parameters,parameter_order,scheduled_for
    ) values (
      l.id,r.purpose,r.template_id,
      case when r.purpose='payment_confirmation' then 0 else m.revision end,
      l.name,phone,
      jsonb_build_object('name',l.name,'meeting_date',to_char(m.meeting_date,'DD Mon YYYY'),
        'meeting_time',to_char(m.start_time,'HH12:MI AM')||'–'||to_char(m.end_time,'HH12:MI AM')||' IST',
        'venue',m.venue,'address',m.address,'fee','₹2,600'),r.parameter_order,when_to
    ) on conflict (lead_id,purpose,meeting_revision) do update
      set template_id=excluded.template_id,recipient_name=excluded.recipient_name,
          recipient_phone=excluded.recipient_phone,parameters=excluded.parameters,
          parameter_order=excluded.parameter_order,scheduled_for=excluded.scheduled_for,updated_at=now()
      where guest_message_jobs.state='scheduled';
    count_created:=count_created+1;
  end loop;
  return count_created;
end $$;

revoke all on function public.configure_guest_message_rule(text,uuid,jsonb,boolean,time) from public,anon;
grant execute on function public.configure_guest_message_rule(text,uuid,jsonb,boolean,time) to authenticated;
revoke all on function public.schedule_paid_guest_messages(uuid) from public,anon,authenticated;
grant execute on function public.schedule_paid_guest_messages(uuid) to service_role;

-- Jobs are claimed atomically. A worker must never automatically resend a job
-- left in sending state after a timeout: its actual delivery is unknowable.
create or replace function public.claim_due_guest_message_jobs(p_limit integer default 20)
returns setof public.guest_message_jobs language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_limit is null or p_limit not between 1 and 50 then raise exception 'Invalid batch size'; end if;
  update public.guest_message_jobs set state='uncertain',updated_at=now()
    where state='sending' and locked_at < now()-interval '15 minutes';
  return query
  update public.guest_message_jobs j set state='sending',attempts=j.attempts+1,
    locked_at=now(),updated_at=now()
  where j.id in (
    select q.id from public.guest_message_jobs q
     join public.wa_templates t on t.id=q.template_id
     where q.state='scheduled' and q.scheduled_for<=now() and t.status='APPROVED' and t.supported
     order by q.scheduled_for,q.created_at for update of q skip locked limit p_limit
  ) returning j.*;
end $$;

create or replace function public.finish_guest_message_job(
  p_job uuid,p_state text,p_message_id text default null,p_error text default null
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_state not in ('accepted','failed','uncertain','skipped') then raise exception 'Invalid completion state'; end if;
  update public.guest_message_jobs set state=p_state,provider_message_id=p_message_id,
    error_code=left(coalesce(p_error,''),500),sent_at=case when p_state='accepted' then now() else sent_at end,
    locked_at=null,updated_at=now()
  where id=p_job and state='sending';
  if not found then raise exception 'Message job is not claimed'; end if;
end $$;
revoke all on function public.claim_due_guest_message_jobs(integer),public.finish_guest_message_job(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_due_guest_message_jobs(integer),public.finish_guest_message_job(uuid,text,text,text) to service_role;
commit;
