begin;
create table public.intake_limits (bucket text primary key, window_start timestamptz not null,hits int not null);
create table public.visitor_requests (request_id uuid primary key,lead_id uuid not null references public.leads(id),created_at timestamptz not null default now());
alter table public.intake_limits enable row level security;
alter table public.visitor_requests enable row level security;
revoke all on public.intake_limits,public.visitor_requests from anon,authenticated;
create function public.capture_visitor(p_request_id uuid,p_bucket text,p_name text,p_phone text,p_company text,p_category text,p_email text,p_route text,p_attribution jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; n int;
begin
 if p_route not in ('WhatsApp','Payment') or p_phone !~ '^91[6-9][0-9]{9}$' then raise exception 'Invalid request'; end if;
 insert into public.intake_limits values(p_bucket,now(),1) on conflict(bucket) do update set hits=case when public.intake_limits.window_start<now()-interval '1 hour' then 1 else public.intake_limits.hits+1 end,window_start=case when public.intake_limits.window_start<now()-interval '1 hour' then now() else public.intake_limits.window_start end returning hits into n;
 if n>12 then raise exception 'Too many requests'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select lead_id into result from public.visitor_requests where request_id=p_request_id;
 if result is not null then return result; end if;
 if (select count(*) from public.leads where phone=p_phone and created_at>now()-interval '1 hour')>=3 then raise exception 'Too many requests'; end if;
 insert into public.leads(name,phone,company,category,email,source,attribution) values(p_name,p_phone,p_company,p_category,p_email,'Visitor landing page · '||p_route,p_attribution) returning id into result;
 insert into public.visitor_requests(request_id,lead_id) values(p_request_id,result);
 return result;
end;$$;
revoke all on function public.capture_visitor(uuid,text,text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.capture_visitor(uuid,text,text,text,text,text,text,text,jsonb) to service_role;
commit;
