# CRM setup

The CRM screen is at `crm.html` alongside the visitor page. Until Supabase is configured, only an in-memory fictional sample is available. No real lead records are stored in GitHub.

## Supabase setup

1. Create a Supabase account and a new Free-plan project, choosing an appropriate region. Account terms and database password must be handled by the owner.
2. Apply `crm-schema.sql` to the new database.
3. Disable public account signup. Invite staff through Supabase Auth, and add their Auth UUIDs to `crm_staff` through the SQL editor. There is no client-side staff-enrolment path.
4. Set the public project URL and publishable key in `config.js`. Never add a service-role key or database password to GitHub.
5. Test: signed-out users cannot read, insert or edit leads; a signed-in non-staff user cannot access records; authorised staff can add/edit leads; staff cannot modify payment status/reference or delete records.
6. Verify staff login and expiry behaviour. Tokens are held in browser memory; reloading requires signing in again.

## Before campaign launch

- Add a server-side public lead-intake endpoint with validation, rate limits and bot protection. Save the lead before redirecting to WhatsApp or payment.
- Integrate Razorpay orders and verified payment webhooks. Only the backend updates payment status and references.
- Finalise privacy notice, cancellation/refund terms and retention rules.
- Add campaign source capture and Meta conversion tracking.

The CRM does not yet receive landing-page enquiries automatically. WhatsApp conversations are not synced automatically; staff can record notes manually after secure setup.
