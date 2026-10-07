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

## WA Broadcast tab
Template builder supports English US marketing templates, one name variable {{1}}, optional footer and static website button. Header types: text, JPG/PNG image, MP4 video, PDF document; maximum upload5MB. Upload creates Meta example handle and phone-number media ID. Stored media IDs may expire; attach a fresh file before resending an older media template. No approval is implied by saving a draft. Sync Meta statuses; only approved supported templates are selectable. One template is chosen per campaign using table checkboxes. Current Meta approval and template content are checked again before recipient claims.
CSV/XLSX/XLS import reads the first worksheet locally using vendoredSheetJS0.20.3. RequiredName/Phone, optionalCompany. Maximum2,000rows/5MB; ten-digitIndian numbers normalize to91; previewflagsinvalid/duplicates. Saving isupsertedbyphone in100-recordbatches. Consentisrecordedseparately;importdoesnotoptincontacts. Checked opted-in contacts or pipelinefilteredleads canbe selected.
One-time migrations after campaign schema: whatsapp-template-schema.sql, whatsapp-broadcast-upgrade.sql. Deploy whatsapp-templates.ts and latestwhatsapp-campaign.ts withgatewayJWT ON. Secrets remainserveronly.
