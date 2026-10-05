# Combined NIA application status

Adapted the public membership explanation and protected lead workflows from nia-hyderabad-lead-dashboard into NIAHYD, with one Supabase database and email staff login. Existing Manus/MySQL leads have not been migrated.

Live backend: visitor-intake. This public endpoint validates consent and fields, enforces a honeypot and submission limits, records campaign attribution, and makes retries idempotent. It can create enquiries but exposes no CRM reads. Private staff tables remain protected by row-level security. Its source is visitor-intake.ts.

Applied migrations: crm-upgrade.sql and intake-schema.sql. Transactional tests: crm-upgrade-test.sql and intake-test.sql. Test records are rolled back.

Remaining for paid registration: add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Supabase Edge Functions Secrets, confirm cancellation/refund terms, create server-side INR orders for 260000 paise, verify Razorpay signatures, persist the order-to-lead mapping, and enable signed webhook handling. Update paid status only after confirmed capture and matching amount/currency/order. Test retries, failed/abandoned checkout and webhook replay before using live keys. Do not put secrets in chat or GitHub.

Remaining for live advertising: configure Meta Pixel/Conversions API and consent choices; use campaign-tagged URLs. The CRM's campaign summary reports stored leads and verified payments, not Meta ad spend or impressions.

Member directory content from nia-atlas-roster is a separate private module and is not published in this public visitor site. This project combines the two NIA landing/lead repositories specified by the user.
