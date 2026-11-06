-- Additive upgrade for the existing NIA Hyderabad Supabase project.
begin;

alter table public.leads add column if not exists website text not null default '';
alter table public.leads add column if not exists business_address text not null default '';
alter table public.leads add column if not exists years_in_business text not null default '';
alter table public.leads add column if not exists turnover_range text not null default '';
alter table public.leads add column if not exists referred_by text not null default '';
alter table public.leads add column if not exists qualification_notes text not null default '';
alter table public.leads add column if not exists fit_status text not null default 'Not reviewed';
do $$ begin
  if not exists(select 1 from pg_constraint where conname='leads_member_fit_status_check' and conrelid='public.leads'::regclass) then
    alter table public.leads add constraint leads_member_fit_status_check
      check (fit_status in ('Not reviewed','Good fit','Needs discussion','Not a fit')) not valid;
  end if;
end $$;
grant insert (website,business_address,years_in_business,turnover_range,referred_by,qualification_notes,fit_status) on public.leads to authenticated;
grant update (website,business_address,years_in_business,turnover_range,referred_by,qualification_notes,fit_status) on public.leads to authenticated;

create table if not exists public.lead_change_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  changed_at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  changes jsonb not null
);
alter table public.lead_change_history enable row level security;
revoke all on public.lead_change_history from anon,authenticated;
grant select on public.lead_change_history to authenticated;
drop policy if exists "Staff read lead change history" on public.lead_change_history;
create policy "Staff read lead change history" on public.lead_change_history for select to authenticated
using (exists(select 1 from public.crm_staff where user_id=(select auth.uid())));

create or replace function public.record_lead_changes() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_data jsonb; new_data jsonb; delta jsonb := '{}'::jsonb; field text;
begin
  old_data := to_jsonb(old); new_data := to_jsonb(new);
  foreach field in array array['name','phone','company','category','email','stage','owner','source','notes',
    'next_follow_up_at','next_action','website','business_address','years_in_business',
    'turnover_range','referred_by','qualification_notes','fit_status','payment_status'] loop
    if old_data -> field is distinct from new_data -> field then
      delta := delta || jsonb_build_object(field,jsonb_build_object('before',old_data -> field,'after',new_data -> field));
    end if;
  end loop;
  if delta <> '{}'::jsonb then
    insert into public.lead_change_history(lead_id,actor_id,actor_email,changes)
    values(new.id,auth.uid(),auth.jwt()->>'email',delta);
  end if;
  return new;
end;$$;
drop trigger if exists record_lead_changes on public.leads;
create trigger record_lead_changes after update on public.leads
for each row execute function public.record_lead_changes();

-- A whole batch is transactional. Existing leads are never overwritten. Existing opt-outs stay opted out.
create or replace function public.crm_import_leads(p_rows jsonb,p_source text,p_consent_evidence text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare row_data jsonb; raw_phone text; contact text; clean_name text; clean_company text;
  lead_count integer; created_count integer := 0; duplicate_count integer := 0;
  ambiguous_count integer := 0; opted_out_count integer := 0;
begin
  if not exists(select 1 from public.crm_staff where user_id=auth.uid()) then raise exception 'Staff access required'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 100 then raise exception 'Import 1 to 100 leads per batch'; end if;
  if length(trim(coalesce(p_source,''))) not between 1 and 100 then raise exception 'Choose a source'; end if;
  if p_consent_evidence is not null and length(trim(p_consent_evidence)) not between 10 and 900 then raise exception 'Describe the marketing consent source and date'; end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    clean_name := trim(coalesce(row_data->>'name',''));
    clean_company := trim(coalesce(row_data->>'company',''));
    raw_phone := regexp_replace(coalesce(row_data->>'phone',''),'[^0-9]','','g');
    contact := case when length(raw_phone)=10 then '91'||raw_phone else raw_phone end;
    if length(clean_name) not between 1 and 100 or length(clean_company) not between 1 and 150
      or contact !~ '^[0-9]{10,15}$' or length(coalesce(row_data->>'category',''))>100
      or length(coalesce(row_data->>'email',''))>320 or length(coalesce(row_data->>'website',''))>500
      or length(coalesce(row_data->>'business_address',''))>500
      or length(coalesce(row_data->>'years_in_business',''))>60
      or length(coalesce(row_data->>'turnover_range',''))>100
      or length(coalesce(row_data->>'referred_by',''))>150
      or length(coalesce(row_data->>'qualification_notes',''))>2000
      or length(coalesce(row_data->>'consent_at',''))>40
      or (coalesce(row_data->>'email','')<>'' and row_data->>'email' !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
      raise exception 'Invalid lead row';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(contact,0));
    select count(*) into lead_count from public.leads l where
      (case when length(regexp_replace(l.phone,'[^0-9]','','g'))=10 then '91'||regexp_replace(l.phone,'[^0-9]','','g') else regexp_replace(l.phone,'[^0-9]','','g') end)=contact
      or (coalesce(row_data->>'email','')<>'' and lower(l.email)=lower(row_data->>'email'));
    if lead_count>1 then ambiguous_count:=ambiguous_count+1; continue; end if;
    if lead_count=1 then duplicate_count:=duplicate_count+1; continue; end if;
    if p_consent_evidence is not null and exists(select 1 from public.wa_permissions where contact_id=contact and not opted_in) then
      opted_out_count:=opted_out_count+1;
    end if;
    insert into public.leads(name,phone,company,category,email,stage,payment_status,source,
      website,business_address,years_in_business,turnover_range,referred_by,qualification_notes,fit_status)
    values(clean_name,contact,clean_company,coalesce(nullif(trim(row_data->>'category'),''),'Unspecified'),
      trim(coalesce(row_data->>'email','')),'New enquiry','unpaid',trim(p_source),
      coalesce(row_data->>'website',''),coalesce(row_data->>'business_address',''),
      coalesce(row_data->>'years_in_business',''),coalesce(row_data->>'turnover_range',''),
      coalesce(row_data->>'referred_by',''),coalesce(row_data->>'qualification_notes',''),'Not reviewed');
    created_count:=created_count+1;
    if p_consent_evidence is not null then
      insert into public.wa_contacts(contact_id,name,company,created_by) values(contact,clean_name,clean_company,auth.uid())
      on conflict(contact_id) do nothing;
      insert into public.wa_permissions(contact_id,opted_in,evidence,updated_by)
      values(contact,true,trim(p_consent_evidence)||' · Consent date: '||coalesce(nullif(row_data->>'consent_at',''),'not supplied'),auth.uid())
      on conflict(contact_id) do update set evidence=excluded.evidence,updated_at=now(),updated_by=excluded.updated_by
      where public.wa_permissions.opted_in;
    end if;
  end loop;
  return jsonb_build_object('created',created_count,'existing',duplicate_count,'ambiguous',ambiguous_count,'opted_out',opted_out_count);
end;$$;
revoke all on function public.crm_import_leads(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.crm_import_leads(jsonb,text,text) to authenticated;
commit;
