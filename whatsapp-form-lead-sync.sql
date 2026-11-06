-- Run once in the Supabase SQL editor. Structured WhatsApp Instant Form
-- replies become CRM leads; other chats, status receipts and test messages do not.
begin;

alter table public.wa_events
  add column if not exists lead_id uuid references public.leads(id) on delete set null;
create index if not exists wa_events_lead_id on public.wa_events(lead_id)
  where lead_id is not null;

create or replace function public.nia_sync_wa_form_lead(p_event_key text)
returns uuid language plpgsql set search_path = public, pg_temp as $$
declare
  event_row public.wa_events%rowtype;
  full_name text;
  category_name text;
  email_address text;
  form_phone text;
  phone_digits text;
  matched_id uuid;
  metadata jsonb;
begin
  select * into event_row from public.wa_events where event_key = p_event_key;
  if not found or event_row.kind <> 'incoming'
     or event_row.body not ilike '%I filled in your form%'
     or event_row.body not ilike '%Full name:%'
     or event_row.body not ilike '%Phone number:%' then
    return null;
  end if;

  full_name := left(trim((regexp_match(event_row.body, '(?im)^Full name:[[:blank:]]*([^\r\n]+)'))[1]), 100);
  category_name := left(trim((regexp_match(event_row.body, '(?im)^Which business category best describes you\?:[[:blank:]]*([^\r\n]+)'))[1]), 100);
  email_address := left(trim((regexp_match(event_row.body, '(?im)^Email:[[:blank:]]*([^\r\n]+)'))[1]), 254);
  form_phone := trim((regexp_match(event_row.body, '(?im)^Phone number:[[:blank:]]*([^\r\n]+)'))[1]);
  phone_digits := regexp_replace(coalesce(form_phone, ''), '[^0-9]', '', 'g');
  if full_name is null or full_name = '' or phone_digits !~ '^[0-9]{10,15}$'
     or right(phone_digits, 10) <> right(regexp_replace(event_row.contact_id, '[^0-9]', '', 'g'), 10) then
    return null;
  end if;
  if length(phone_digits) = 10 then phone_digits := '91' || phone_digits; end if;
  if category_name is null or category_name = '' then category_name := 'Not yet supplied'; end if;
  if email_address is null or email_address !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then email_address := ''; end if;

  -- Serialise concurrent deliveries from the same sender before matching.
  perform pg_advisory_xact_lock(hashtextextended(right(phone_digits, 10), 0));
  select id into matched_id from public.leads
   where right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = right(phone_digits, 10)
   order by (regexp_replace(phone, '[^0-9]', '', 'g') = phone_digits) desc, created_at
   limit 1;
  metadata := jsonb_build_object('wa_event_key', event_row.event_key,
                                 'wa_contact_id', event_row.contact_id,
                                 'wa_form_received_at', event_row.event_at);
  if matched_id is null then
    insert into public.leads
      (created_at, name, phone, company, category, email, source, notes, attribution)
    values
      (event_row.event_at, full_name, '+' || phone_digits, 'Not yet supplied',
       category_name, email_address, 'Meta WhatsApp Instant Form',
       'WhatsApp Instant Form enquiry. Asked to know more about the business.', metadata)
    returning id into matched_id;
  else
    update public.leads
       set name = case when name in ('WhatsApp enquiry', 'Unknown') then full_name else name end,
           category = case when category in ('', 'Not yet supplied') then category_name else category end,
           email = case when email = '' then email_address else email end,
           attribution = coalesce(attribution, '{}'::jsonb) || metadata
     where id = matched_id;
  end if;
  update public.wa_events set lead_id = matched_id where event_key = p_event_key;
  return matched_id;
end $$;
revoke all on function public.nia_sync_wa_form_lead(text) from public, anon, authenticated;
grant execute on function public.nia_sync_wa_form_lead(text) to service_role;

create or replace function public.nia_wa_form_lead_after_insert()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  perform public.nia_sync_wa_form_lead(new.event_key);
  return new;
end $$;
drop trigger if exists nia_wa_form_lead_insert on public.wa_events;
create trigger nia_wa_form_lead_insert after insert on public.wa_events
  for each row when (new.kind = 'incoming')
  execute function public.nia_wa_form_lead_after_insert();

-- Apply the same rules to messages already received. Existing matching leads
-- retain their stage, payment status and owner.
do $$
declare item record;
begin
  for item in
    select event_key from public.wa_events
     where kind = 'incoming' and lead_id is null
       and body ilike '%I filled in your form%'
     order by event_at
  loop
    perform public.nia_sync_wa_form_lead(item.event_key);
  end loop;
end $$;

-- Keep the visible lead date aligned with the first form submission.
with first_form as (
  select lead_id, min(event_at) as received_at from public.wa_events
  where lead_id is not null and body ilike '%I filled in your form%'
  group by lead_id
)
update public.leads l set created_at = f.received_at
from first_form f
where l.id = f.lead_id and l.source = 'Meta WhatsApp Instant Form'
  and l.created_at > f.received_at;

commit;
