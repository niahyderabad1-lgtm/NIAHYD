begin;
create table public.wa_templates(id uuid primary key default gen_random_uuid(),meta_id text,name text not null,language text not null,category text not null,status text not null,components jsonb not null default '[]',supported boolean not null default false,updated_at timestamptz not null default now(),created_by uuid references auth.users(id),unique(name,language));
alter table public.wa_templates enable row level security;
revoke all on public.wa_templates from anon,authenticated;
grant select on public.wa_templates to authenticated;
create policy "Staff read templates" on public.wa_templates for select to authenticated using(exists(select 1 from crm_staff where user_id=auth.uid()));
alter table public.wa_campaigns drop constraint wa_campaigns_template_check;
alter table public.wa_campaigns add column language text not null default 'en_US', add column template_definition jsonb;
create function public.wa_create_template_campaign(p_name text,p_contacts text[],p_template uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid; t wa_templates;
begin
 if not exists(select 1 from crm_staff where user_id=auth.uid()) then raise exception 'Staff access required';end if;
 select * into t from wa_templates where id=p_template and status='APPROVED' and supported;
 if not found then raise exception 'Choose a supported approved template';end if;
 c:=wa_create_campaign(p_name,p_contacts);
 update wa_campaigns set template=t.name,language=t.language,template_definition=t.components where id=c;
 return c;
end;$$;
revoke all on function public.wa_create_template_campaign(text,text[],uuid) from public,anon,authenticated;
grant execute on function public.wa_create_template_campaign(text,text[],uuid) to authenticated;
commit;
