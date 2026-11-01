# CRM meeting settings

Apply `meeting-settings.sql` once in Supabase SQL Editor before publishing the frontend. It seeds the existing 14 October 2026 event without changing future saves. Staff should replace the past meeting with the next confirmed event in CRM → Meeting settings.

The single published record contains only date, times, venue, address and after-meeting notes. Anyone may read those public details. Only existing `crm_staff` members can use the update RPC. Direct browser writes are denied; concurrent edits require reloading instead of silently overwriting another save. Times are IST; meetings must end later the same day.

The landing page, sticky form, CRM sidebar, new WhatsApp enquiries and newly opened template drafts use saved details. Existing approved templates, sent messages, historical leads and payment fees are not rewritten. Guest fee remains ₹2,600; live payments remain disabled. If public details fail to load, the page asks guests to confirm them with NIA. Past meetings display an ended notice.

Validation: `node meeting-test.cjs` checks public loading, safe rendering, invalid dates/times, past-event notice and failure fallback with mocked network. `meeting-settings-test.sql` validates anonymous/nonstaff denial, staff updates and stale revisions in a transaction that rolls back. Both passed on 30 October 2026; the SQL test ran in the configured Supabase project.

## Guest intake date correction

Deploy the updated `visitor-intake.ts` after the meeting table exists. New enquiries resolve the meeting on the server and store its date, times, venue and revision in lead attribution. If the lookup fails, intake returns 503 instead of storing the old date. Test-order notes use the original enquiry's stored meeting date, even if a later meeting is scheduled. Existing lead history is not rewritten. Run `node visitor-meeting-test.mjs`; it mocks every request and creates no real leads or payments.
