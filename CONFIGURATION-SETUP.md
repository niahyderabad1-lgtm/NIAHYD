# Configuration

Administrator: existing staff account amp.maverick@gmail.com. Vault values are write-only from the CRM. Database functions enforce admin membership and staff access; service-role backend alone can read overrides. Updates are audited without secret values. No test credentials remain.

Deployed consumers: visitor-intake (test Razorpay), whatsapp-reply, whatsapp-webhook. Broadcast/template and Facebook/Instagram consumers retain existing environment configuration pending approval. SMTP, OAuth and infrastructure credentials remain provider-managed. No provider connection tests or live sends have been performed.

Only the deployment migration should create admin membership; never grant every staff member access. To revoke, remove the user's nia_config_admins row. Original environment values remain fallback until an override is saved. Stored secrets are never returned by status RPC.
