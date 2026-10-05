begin;
set local role service_role;
do $$ declare rid uuid:=gen_random_uuid(); a uuid; b uuid; begin
 a:=public.capture_visitor(rid,'fictional-test-bucket','Fictional validation','919999999998','Example','Test','','WhatsApp','{"utm_campaign":"fictional-test"}'::jsonb);
 b:=public.capture_visitor(rid,'fictional-test-bucket','Fictional validation','919999999998','Example','Test','','WhatsApp','{}'::jsonb);
 if a<>b or (select count(*) from public.visitor_requests where request_id=rid)<>1 then raise exception 'Duplicate submission'; end if;
 if not exists(select 1 from public.leads where id=a and payment_status='unpaid' and attribution->>'utm_campaign'='fictional-test') then raise exception 'Invalid saved lead'; end if;
end $$;
rollback;
select 'Visitor intake and retry checks passed; fictional rows rolled back' as result;
