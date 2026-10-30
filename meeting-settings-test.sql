-- Permission and concurrency checks. All test changes roll back.
begin;
set local role anon;
do $$ begin
 if (select count(*) from public.meeting_settings) <> 1 then raise exception 'Public read failed'; end if;
 begin
  update public.meeting_settings set venue='QA' where id=1;
  raise exception 'Anonymous direct write was allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.update_meeting_settings('2026-11-18','18:00','21:00','QA','','',1);
  raise exception 'Anonymous RPC was allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true) is not null as test_claim_set;
set local role authenticated;
do $$ begin
 begin
  perform public.update_meeting_settings('2026-11-18','18:00','21:00','QA','','',1);
  raise exception 'Nonstaff RPC was allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select user_id::text from public.crm_staff limit 1),true) is not null as staff_fixture_set;
set local role authenticated;
do $$ declare original public.meeting_settings; saved public.meeting_settings; begin
 select * into original from public.meeting_settings where id=1;
 select * into saved from public.update_meeting_settings(original.meeting_date,original.start_time,original.end_time,'QA rollback venue','','Dinner',original.revision);
 if saved.venue <> 'QA rollback venue' or saved.revision <> original.revision+1 then raise exception 'Staff save failed'; end if;
 begin
  perform public.update_meeting_settings(original.meeting_date,original.start_time,original.end_time,'Stale','','',original.revision);
  raise exception 'Stale overwrite was allowed';
 exception when serialization_failure then null; end;
 begin
  perform public.update_meeting_settings(original.meeting_date,'21:00','18:00','QA','','',saved.revision);
  raise exception 'Invalid time range was allowed';
 exception when invalid_parameter_value then null; end;
 begin
  update public.meeting_settings set venue='Direct' where id=1;
  raise exception 'Direct staff write was allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: public read, anonymous/nonstaff denial, staff save, invalid times and stale revision protection; all test writes rolled back' as result;
