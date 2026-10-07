# WhatsApp CRM integration

Enquiries: +91 7997994493. Broadcast sender: +91 7997994495.

The signed incoming webhook is deployed and a real incoming message was verified on 7 October 2026. Staff can load incoming messages and delivery events in the CRM. Free-text replies require a customer message within the last 24 hours; this is enforced on the server.

Broadcast workflow:
1. Sign in with approved staff access.
2. Record each contact's marketing opt-in with evidence. A visitor enquiry alone is not marketing consent.
3. Filter leads by search and stage, then create a draft. The server includes only opted-in contacts and removes duplicates.
4. Review the recipient preview and launch. The worker processes up to five recipients per action; use Process next 5 for remaining recipients.
5. Check incoming/status events for delivery. Meta acceptance alone does not confirm delivery.

Template is broadcast_update, en_US, using each recipient name. The current approved template is a generic update, not a detailed event invitation. A separate approved event template will be needed for campaign-specific copy.

Incoming STOP, UNSUBSCRIBE or OPT OUT suppress future queued sends. Uncertain attempts are not retried automatically. A permanent Meta token and a successful staff-authenticated outbound test remain to be confirmed before campaign launch.

Secrets belong only in Supabase. Never commit access tokens, app secrets or service-role keys. The campaign and reply functions validate signed-in staff and retain gateway JWT verification. The webhook uses raw-body HMAC signature validation.

Database setup files are one-time migrations. Do not rerun creation statements on an existing installation. Tables use staff-only read access; mutations pass through staff-validated functions.
