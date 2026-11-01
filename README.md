# NIA Hyderabad — guest page and team CRM

Guest landing page and private staff CRM share one Supabase project. GitHub Pages serves the frontend. Supabase handles email login, protected records, conversation history and validated guest intake.

Features: right-side sticky guest form, WhatsApp handoff, campaign attribution, eight-stage pipeline, owner assignment, IST callback scheduling, overdue/today/upcoming queues, append-only conversations, CSV export and source conversion summaries.

Meeting date, times and venue are managed in CRM → Meeting settings and loaded from Supabase. The meeting was updated to 11 November 2026, 6–9 PM IST followed by dinner, Novotel HICC Hyderabad on 30 October 2026. Guest fee ₹2,600 including taxes and dinner. **Online payments remain disabled while Razorpay reviews the website.** A guest enquiry is not a booking.

Schema order for a new environment: crm-schema.sql, crm-upgrade.sql, intake-schema.sql. Invite staff and explicitly authorize their UUID in crm_staff. Deploy visitor-intake.ts; this is a public write-only endpoint. All staff tables remain protected by row-level security. Never commit a service key or Razorpay secret.

The CRM workflows from nia-hyderabad-lead-dashboard have been adapted to Supabase. Its MySQL runtime and Manus OAuth are not required by this app. Existing MySQL data has not been imported.


The public test-checkout route has been retired. The guest page collects a secure enquiry and hands the guest to the NIA WhatsApp team until Razorpay approves the website and live payment credentials are configured.

Guest cancellations are non-refundable. If NIA cancels, guests receive a full refund or a pass for the next event.
