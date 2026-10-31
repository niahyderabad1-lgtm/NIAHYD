# NIA Hyderabad Gateway

This Cloudflare Worker is the independent, secure integration layer for the NIA Hyderabad landing page and CRM. It keeps Meta and payment secrets out of GitHub Pages and avoids depending on Supabase Edge Functions for WhatsApp operations.

## Initial scope

- `GET /health` — non-sensitive health check.
- `POST /whatsapp/templates` — authenticated template status sync and draft submission to Meta.

The existing Supabase database remains the source of truth for staff access and CRM records. The Worker verifies the signed-in Supabase user and checks `crm_staff` before it performs a WhatsApp action.

## Required Cloudflare secrets

Add these under **Worker → Settings → Variables and Secrets**. Never put values in GitHub or client-side JavaScript.

| Secret | Purpose |
| --- | --- |
| `SUPABASE_URL` | `https://mtrfipelhvuvqkjwgiif.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase database access |
| `WHATSAPP_ACCESS_TOKEN` | Long-lived Meta system-user token |
| `WHATSAPP_WABA_ID` | `28487797780889906` |

`ALLOWED_ORIGIN` is a non-secret setting already present in `wrangler.toml`.

## Deploy

1. Create a Cloudflare account and log in to the dashboard.
2. Go to **Workers & Pages → Create → Worker** and name it `nia-hyderabad-gateway`.
3. Connect this GitHub repository, or deploy the `cloudflare-worker` folder with Wrangler.
4. Add the four secrets above in the Worker dashboard, then deploy.
5. Open `https://<worker-subdomain>/health`; it should return `{"ok":true,"service":"nia-hyderabad-gateway"}`.
6. Add the Worker URL to the CRM configuration before switching template sync to it.

## Next migration steps

1. Point CRM template sync/submission to this Worker and test with a draft.
2. Migrate WhatsApp replies and campaign processing.
3. Add Meta and Razorpay webhook endpoints, verifying their signatures before any database write.
