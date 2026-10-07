begin;
create table public.wa_media(id uuid primary key default gen_random_uuid(),meta_media_id text not null,handle text not null,kind text not null check(kind in ('IMAGE','VIDEO','DOCUMENT')),filename text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
alter table public.wa_media enable row level security;
revoke all on public.wa_media from anon,authenticated;
grant select on public.wa_media to authenticated;
create policy "Staff read media" on public.wa_media for select to authenticated using(exists(select 1 from crm_staff where user_id=auth.uid()));
alter table public.wa_templates add column media_id uuid references public.wa_media(id);
create table public.wa_contacts(contact_id text primary key check(contact_id ~ '^[0-9]{8,15}$'),name text not null check(length(name) between 1 and 200),company text not null default '',created_by uuid references auth.users(id),updated_at timestamptz not null default now());
alter table public.wa_contacts enable row level security;
revoke all on public.wa_contacts from anon,authenticated;
grant select on public.wa_contacts to authenticated;
create policy "Staff read broadcast contacts" on public.wa_contacts for select to authenticated using(exists(select 1 from crm_staff where user_id=auth.uid()));
create function public.wa_import_contacts(p_rows jsonb) returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if not exists(select 1 from crm_staff where user_id=auth.uid()) then raise exception 'Staff access required';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 100 then raise exception 'Import 1 to 100 contacts per batch';end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as x(contact_id text,name text,company text) where contact_id is null or contact_id !~ '^[0-9]{8,15}$' or name is null or length(trim(name)) not between 1 and 200 or length(coalesce(company,''))>200) then raise exception 'Invalid contact row';end if;
 insert into wa_contacts(contact_id,name,company,created_by) select distinct on(contact_id) contact_id,trim(name),coalesce(company,''),auth.uid() from jsonb_to_recordset(p_rows) as x(contact_id text,name text,company text) on conflict(contact_id) do update set name=excluded.name,company=excluded.company,updated_at=now();
 get diagnostics n=row_count;return n;
end;$$;
revoke all on function public.wa_import_contacts(jsonb) from public,anon,authenticated;
grant execute on function public.wa_import_contacts(jsonb) to authenticated;
create or replace function public.wa_create_template_campaign(p_name text,p_contacts text[],p_template uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid; t wa_templates;
begin
 if not exists(select 1 from crm_staff where user_id=auth.uid()) then raise exception 'Staff access required';end if;
 select * into t from wa_templates where id=p_template and status='APPROVED' and supported;
 if not found then raise exception 'Choose a supported approved template';end if;
 c:=wa_create_campaign(p_name,p_contacts);
 update wa_campaigns set template=t.name,language=t.language,template_definition=t.components where id=c;
 update wa_campaign_recipients q set recipient_name=b.name from wa_contacts b where q.campaign_id=c and q.contact_id=b.contact_id;
 return c;
end;$$;
commit;
