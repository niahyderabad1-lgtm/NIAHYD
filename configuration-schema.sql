
create table public.nia_config_admins(user_id uuid primary key references auth.users(id));
alter table public.nia_config_admins enable row level security;
revoke all on public.nia_config_admins from anon,authenticated;
insert into public.nia_config_admins(user_id) select u.id from auth.users u join public.crm_staff s on s.user_id=u.id where lower(u.email)='amp.maverick@gmail.com';
create table public.nia_config_audit(id bigint generated always as identity primary key,actor uuid not null,setting text not null,changed_at timestamptz not null default now());
alter table public.nia_config_audit enable row level security;
revoke all on public.nia_config_audit from anon,authenticated;
create function public.nia_config_is_admin() returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.nia_config_admins a join public.crm_staff s using(user_id) where a.user_id=auth.uid())
$$;
revoke all on function public.nia_config_is_admin() from public,anon;
grant execute on function public.nia_config_is_admin() to authenticated;
create function public.nia_config_status() returns jsonb language plpgsql security definer set search_path='' as $$
begin
if not public.nia_config_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
return jsonb_build_object('settings',(select coalesce(jsonb_agg(jsonb_build_object('name',substring(name from 12),'updated_at',updated_at)),'[]'::jsonb) from vault.secrets where name like 'nia_config:%'),'history',(select coalesce(jsonb_agg(t),'[]'::jsonb) from (select setting,changed_at from public.nia_config_audit order by changed_at desc limit 30)t));
end $$;
create function public.nia_config_save(p_name text,p_value text) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
if not public.nia_config_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
if not p_name = any(array['WHATSAPP_ACCESS_TOKEN','WHATSAPP_VERIFY_TOKEN','META_APP_SECRET','META_PAGE_ACCESS_TOKEN','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET']) or p_name is null then raise exception 'Unsupported setting'; end if;
if p_value is null or length(trim(p_value))<8 or length(p_value)>8192 or p_value ~ '[\r\n]' then raise exception 'Check credential format'; end if;
if p_name='RAZORPAY_KEY_ID' and p_value not like 'rzp_test_%' then raise exception 'Only test payment credentials are supported'; end if;
perform pg_advisory_xact_lock(hashtext('nia_config:'||p_name));
select id into sid from vault.secrets where name='nia_config:'||p_name;
if sid is null then perform vault.create_secret(trim(p_value),'nia_config:'||p_name); else perform vault.update_secret(sid,trim(p_value)); end if;
insert into public.nia_config_audit(actor,setting) values(auth.uid(),p_name);
end $$;
create function public.nia_config_read(p_name text) returns text language sql security definer set search_path='' as $$
select decrypted_secret from vault.decrypted_secrets where name='nia_config:'||p_name
$$;
revoke all on function public.nia_config_status(),public.nia_config_save(text,text),public.nia_config_read(text) from public,anon,authenticated;
grant execute on function public.nia_config_status(),public.nia_config_save(text,text) to authenticated;
grant execute on function public.nia_config_read(text) to service_role;
