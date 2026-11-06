-- Read-only overlap report after the confidential data SQL is staged.
-- Replace the checksum only if importing a different verified backup.
with source as (
  select source_id,payload,
    regexp_replace(coalesce(payload->>'phone',''),'[^0-9]','','g') raw_phone,
    lower(trim(coalesce(payload->>'email',''))) email
  from legacy_hub.records
  where backup_sha256='dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece'
    and source_table='crm_leads'
), normalized as (
  select source_id,payload,email,
    case when length(raw_phone)=10 then '91'||raw_phone else raw_phone end phone
  from source
), ranked as (
  select *,count(*) over(partition by phone) as source_phone_count,
    count(*) over(partition by email) as source_email_count
  from normalized
), current_leads as (
  select id,lower(trim(coalesce(email,''))) email,
    case when length(regexp_replace(phone,'[^0-9]','','g'))=10
      then '91'||regexp_replace(phone,'[^0-9]','','g')
      else regexp_replace(phone,'[^0-9]','','g') end phone
  from public.leads
), classified as (
  select r.*,(select count(*) from current_leads c where c.phone=r.phone) as phone_matches,
    (select count(*) from current_leads c where r.email<>'' and c.email=r.email) as email_matches
  from ranked r
)
select case
    when payload->>'groupId'='30001' then 'validation group (archive only)'
    when coalesce(payload->>'name','')='' or phone !~ '^[0-9]{10,15}$' then 'needs contact repair'
    when source_phone_count>1 or (email<>'' and source_email_count>1) then 'repeated in old database'
    when phone_matches>1 or email_matches>1 then 'multiple current matches'
    when phone_matches=1 then 'already in current CRM by phone'
    when email_matches=1 then 'email match; phone differs (review)'
    else 'eligible as new historical lead'
  end as result,
  count(*) as lead_count
from classified group by 1 order by 1;
