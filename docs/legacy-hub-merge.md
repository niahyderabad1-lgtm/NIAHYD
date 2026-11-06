# Member Operations Hub merge

The 7 November 2026 backup is a MySQL logical export. The active Hyderabad CRM is PostgreSQL on Supabase. The original dump must not be run directly against the active database.

## Verified source

- SHA-256: `dcac5421116d7fe0238244921708cdabc39352d285387c15a475587759f66ece`
- 13 source tables, 2,483 rows, including 1,152 leads, 756 lead changes and 493 callback reminders.
- Lead dispositions: 856 not interested, 261 follow up, 29 not suitable, 5 confirmed for meeting, 1 dropped.
- 83 repeated phone rows; 12 leads lack phone numbers; 3 leads belong to the marked validation group.
- 971 locally unique leads have a usable phone and are eligible for a live overlap check. This is **not** the number to import: existing CRM matches must be removed first.
- The backup contains no WhatsApp marketing consent evidence. Import must not grant campaign permission.

## Safe order

1. Keep a verified database backup and a Git checkpoint.
2. Run `crm-legacy-staging.sql` in the existing Supabase project. It creates a private archive schema and does not change current leads.
3. Generate the confidential data SQL with `tools/prepare_legacy_hub.py`. Keep the output outside Git. Run it in the same Supabase project, then verify the archived row count is 2,483.
4. Run `crm-legacy-preview.sql`. It reports aggregate invalid, repeated, current-match and new-candidate counts without exposing contacts.
5. Run `crm-legacy-fields.sql` and then `crm-legacy-promote.sql`. Promotion inserts only uniquely identified new historical leads, links exact phone matches to existing leads without editing them, and attaches earlier activity read-only. Validation-group records remain in the private archive.
6. Review unmatched or conflicting contacts separately. Do not auto-merge them or import old user credentials, WhatsApp templates, or consent into the live app.

## Field choices

- The old lead disposition is kept separately from the current guest stage.
- Closed dispositions map to `Not proceeding`; `follow_up` maps to `Contacted`; meeting dispositions map to `Qualified`; final discussion and joining dispositions map to `Membership discussion`.
- Imported guest payment status remains `unpaid` until verified by the current payment flow.
- Old source group names are preserved; qualifying groups 01–05 can be selected in the current CRM.
- Source timestamps are interpreted as UTC, then shown in India time by the CRM.
- Earlier changes, reminders and online checks remain read-only history.
