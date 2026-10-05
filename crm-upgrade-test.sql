begin;
select set_config('request.jwt.claim.sub','9b64b470-d12f-4adb-9bbe-64db5b498e3f',true);
set local role authenticated;
do $$ declare lid uuid; begin
 insert into public.leads(name,phone,company,category) values('Fictional validation','919999999999','Example','Test') returning id into lid;
 perform public.log_lead_activity(lid,'Call','Interested','Fictional validation only','Contacted',now()+interval '1 day','Call');
 if not exists(select 1 from public.lead_activities where lead_id=lid) then raise exception 'Activity missing'; end if;
 if not exists(select 1 from public.leads where id=lid and stage='Contacted' and next_follow_up_at is not null) then raise exception 'Follow-up missing'; end if;
 if has_table_privilege('authenticated','public.lead_activities','UPDATE') or has_table_privilege('anon','public.lead_activities','SELECT') or has_function_privilege('anon','public.log_lead_activity(uuid,text,text,text,text,timestamptz,text)','EXECUTE') or has_function_privilege('anon','public.capture_visitor(uuid,text,text,text,text,text,text,text,jsonb)','EXECUTE') then raise exception 'Access too broad'; end if;
end $$;
rollback;
select 'CRM history, follow-up and access checks passed; fictional rows rolled back' as result;
