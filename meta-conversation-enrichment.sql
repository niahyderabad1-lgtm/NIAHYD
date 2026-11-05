-- Run in Supabase SQL editor. Only clearly labelled details in an inbound
-- message are copied into the linked lead; ambiguous chat text is left alone.
create or replace function public.meta_ingest_message(p_channel text,p_account text,p_participant text,p_name text,p_conversation text,p_message text,p_direction text,p_body text,p_at timestamptz)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare thread uuid; linked uuid; display_name text; phone_value text; email_value text; company_value text; category_value text; name_value text; raw_phone text;
begin
 if p_channel not in ('facebook','instagram') or p_account='' or p_participant='' or p_message='' or p_at>now()+interval '5 minutes' then raise exception 'Invalid message';end if;
 insert into meta_threads(channel,account_id,participant_id,participant_name,meta_conversation_id,latest_at)
 values(p_channel,p_account,p_participant,left(coalesce(p_name,''),200),p_conversation,p_at)
 on conflict(channel,account_id,participant_id) do update set latest_at=greatest(meta_threads.latest_at,excluded.latest_at),participant_name=case when excluded.participant_name<>'' then excluded.participant_name else meta_threads.participant_name end,meta_conversation_id=coalesce(excluded.meta_conversation_id,meta_threads.meta_conversation_id) returning id into thread;
 insert into meta_messages(thread_id,message_id,direction,body,event_at) values(thread,p_message,p_direction,left(coalesce(p_body,''),10000),p_at) on conflict(thread_id,message_id) do nothing;
 if p_direction='incoming' then
  raw_phone:=(regexp_match(coalesce(p_body,''),'(?i)(?:phone|mobile|whatsapp|contact)(?:\\s*(?:number|no))?\\s*[:=-]\\s*([+()0-9 .-]{10,24})'))[1];
  phone_value:=regexp_replace(coalesce(raw_phone,''),'\\D','','g');if length(phone_value)=10 then phone_value:='91'||phone_value;end if;if length(phone_value)<10 or length(phone_value)>18 then phone_value:=null;end if;
  email_value:=(regexp_match(coalesce(p_body,''),'(?i)(?:email|e-mail)\\s*[:=-]\\s*([a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,})'))[1];
  company_value:=nullif(left(trim((regexp_match(coalesce(p_body,''),'(?i)(?:company|business|organisation|organization)\\s*[:=-]\\s*([^\\n\\r]{2,150})'))[1]),150),'');
  category_value:=nullif(left(trim((regexp_match(coalesce(p_body,''),'(?i)(?:category|industry|profession)\\s*[:=-]\\s*([^\\n\\r]{2,100})'))[1]),100),'');
  name_value:=nullif(left(trim((regexp_match(coalesce(p_body,''),'(?i)(?:name|full name)\\s*[:=-]\\s*([^\\n\\r]{2,100})'))[1]),100),'');
  select lead_id into linked from meta_threads where id=thread;
  display_name:=coalesce(nullif(left(trim(p_name),100),''),name_value,initcap(p_channel)||' enquiry');
  if linked is null then
   insert into public.leads(name,phone,company,category,email,source,notes,attribution) values(display_name,coalesce(phone_value,''),coalesce(company_value,'Not yet supplied'),coalesce(category_value,'Not yet supplied'),coalesce(email_value,''),'Meta '||initcap(p_channel)||' conversation','New inbound Meta conversation. Contact details pending in CRM inbox.',jsonb_build_object('meta_thread_id',thread,'meta_channel',p_channel,'meta_participant_id',p_participant,'meta_first_message_at',p_at,'meta_received_at',p_at)) returning id into linked;
   update public.meta_threads set lead_id=linked where id=thread and lead_id is null;
  else
   update public.leads set name=case when (name=initcap(p_channel)||' enquiry' or name='') then display_name else name end,phone=case when (phone='' or phone is null) and phone_value is not null then phone_value else phone end,email=case when (email='' or email is null) and email_value is not null then email_value else email end,company=case when (company='Not yet supplied' or company='Not provided' or company='') and company_value is not null then company_value else company end,category=case when (category='Not yet supplied' or category='Not provided' or category='') and category_value is not null then category_value else category end,attribution=coalesce(attribution,'{}'::jsonb)||jsonb_build_object('meta_last_message_at',p_at) where id=linked;
  end if;
 end if;
 return thread;
end $$;
revoke all on function public.meta_ingest_message(text,text,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.meta_ingest_message(text,text,text,text,text,text,text,text,timestamptz) to service_role;
