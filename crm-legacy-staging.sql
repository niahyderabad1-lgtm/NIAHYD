-- Private, additive archive for the Member Operations Hub database export.
-- Run before the generated data SQL. This does not change live leads.
begin;
create schema if not exists legacy_hub;
revoke all on schema legacy_hub from public, anon, authenticated;
create table if not exists legacy_hub.records (
  backup_sha256 text not null,
  source_table text not null,
  source_id text not null,
  payload jsonb not null,
  imported_at timestamptz not null default now(),
  primary key (backup_sha256, source_table, source_id)
);
create index if not exists legacy_hub_records_table_idx on legacy_hub.records (source_table);
revoke all on legacy_hub.records from public, anon, authenticated;
commit;
