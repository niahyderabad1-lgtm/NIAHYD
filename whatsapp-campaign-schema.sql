begin;
create table public.wa_campaigns(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 100),template text not null default 'broadcast_update' check(template='broadcast_update'),state text not null default 'draft' check(state in ('draft','queued','complete')),created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create table public.wa_campaign_recipients(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references public.wa_campaigns(id),contact_id text not null,recipient_name text not null,state text not null default 'pending' check(state in ('pending','sending','accepted','failed','uncertain','skipped')),message_id text,error_code text,updated_at timestamptz not null default now(),unique(campaign_id,contact_id));
alter table public.wa_campaigns enable row level security;
alter table public.wa_campaign_recipients enable row level security;
revoke all on public.wa_campaigns,public.wa_campaign_recipients from anon,authenticated;
grant select on public.wa_campaigns,public.wa_campaign_recipients to authenticated;
create policy "Staff view campaigns" on public.wa_campaigns for select to authenticated using(exists(select 1 from public.crm_staff where user_id=auth.uid()));
create policy "Staff view campaign recipients" on public.wa_campaign_recipients for select to authenticated using(exists(select 1 from public.crm_staff where user_id=auth.uid()));
create function public.wa_record_consent(p_contact text,p_opted_in boolean,p_evidence text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from crm_staff where user_id=auth.uid()) then raise exception 'Staff access required';end if;
 if p_contact is null or p_opted_in is null or p_evidence is null or p_contact !~ '^[0-9]{8,15}$' or length(trim(p_evidence)) not between 1 and 1000 then raise exception 'Consent evidence required';end if;
 insert into wa_permissions(contact_id,opted_in,evidence,updated_by) values(p_contact,p_opted_in,p_evidence,auth.uid()) on conflict(contact_id) do update set opted_in=excluded.opted_in,evidence=excluded.evidence,updated_at=now(),updated_by=excluded.updated_by;
end;$$;
create function public.wa_create_campaign(p_name text,p_contacts text[]) returns uuid language plpgsql security definer set search_path=public as $$
declare campaign uuid;
begin
 if not exists(select 1 from crm_staff where user_id=auth.uid()) then raise exception 'Staff access required';end if;
 if p_contacts is null or cardinality(p_contacts) not between 1 and 500 then raise exception 'Select 1 to 500 recipients';end if;
 insert into wa_campaigns(name,created_by) values(p_name,auth.uid()) returning id into campaign;
 insert into wa_campaign_recipients(campaign_id,contact_id,recipient_name)
 select campaign,p.contact_id,coalesce((select l.name from leads l where (case when length(regexp_replace(l.phone,'[^0-9]','','g'))=10 then '91'||regexp_replace(l.phone,'[^0-9]','','g') else regexp_replace(l.phone,'[^0-9]','','g') end)=p.contact_id order by l.created_at desc limit 1),'NIA contact')
 from wa_permissions p where p.opted_in and p.contact_id=any(p_contacts);
 if not found then raise exception 'No recipients have recorded marketing opt-in';end if;
 return campaign;
end;$$;
create function public.wa_launch_campaign(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from crm_staff where user_id=auth.uid()) then raise exception 'Staff access required';end if;
 update wa_campaigns set state='queued' where id=p_id and state='draft';
end;$$;
create function public.wa_claim_batch(p_id uuid) returns setof public.wa_campaign_recipients language plpgsql security definer set search_path=public as $$
begin
 -- Backend service role only. Each recipient is claimed once; uncertain sends never auto-retry.
 update wa_campaign_recipients r set state='skipped',updated_at=now() where campaign_id=p_id and state='pending' and not exists(select 1 from wa_permissions p where p.contact_id=r.contact_id and p.opted_in);
 return query update wa_campaign_recipients r set state='sending',updated_at=now() where r.id in(select q.id from wa_campaign_recipients q join wa_campaigns c on c.id=q.campaign_id where q.campaign_id=p_id and q.state='pending' and c.state='queued' order by q.id for update of q skip locked limit 5) returning r.*;
end;$$;
revoke all on function public.wa_record_consent(text,boolean,text),public.wa_create_campaign(text,text[]),public.wa_launch_campaign(uuid),public.wa_claim_batch(uuid) from public,anon,authenticated;
grant execute on function public.wa_record_consent(text,boolean,text),public.wa_create_campaign(text,text[]),public.wa_launch_campaign(uuid) to authenticated;
grant execute on function public.wa_claim_batch(uuid) to service_role;
create function public.wa_finish_campaign(p_id uuid) returns void language sql security definer set search_path=public as $$
 update wa_campaigns c set state='complete' where c.id=p_id and c.state='queued' and not exists(select 1 from wa_campaign_recipients r where r.campaign_id=c.id and r.state in ('pending','sending'));
$$;
revoke all on function public.wa_finish_campaign(uuid) from public,anon,authenticated;
grant execute on function public.wa_finish_campaign(uuid) to service_role;
commit;
