# NIA Hyderabad — visitor page and team CRM

Visitor landing page and private staff CRM share one Supabase project. GitHub Pages serves the frontend. Supabase handles email login, protected records, conversation history and validated visitor intake.

Features: right-side sticky visitor form, WhatsApp handoff, campaign attribution, eight-stage pipeline, owner assignment, IST callback scheduling, overdue/today/upcoming queues, append-only conversations, CSV export and source conversion summaries.

Event: 14 October 2026, 6–9 PM followed by dinner, Novotel HICC Hyderabad. Visitor fee ₹2,600 including taxes and dinner. **Online payments remain disabled** pending Razorpay keys, verified order/webhook integration and approved refund terms. A visitor enquiry is not a booking.

Schema order for a new environment: crm-schema.sql, crm-upgrade.sql, intake-schema.sql. Invite staff and explicitly authorize their UUID in crm_staff. Deploy visitor-intake.ts; this is a public write-only endpoint. All staff tables remain protected by row-level security. Never commit a service key or Razorpay secret.

The CRM workflows from nia-hyderabad-lead-dashboard have been adapted to Supabase. Its MySQL runtime and Manus OAuth are not required by this app. Existing MySQL data has not been imported.
