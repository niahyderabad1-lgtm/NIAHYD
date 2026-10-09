# NIA Facebook and Instagram inbox

Route: Meta Messenger Conversations API with Facebook Login and a Page access token. This is separate from WhatsApp Cloud API and the advertising Conversions API.

Facebook Page: Network In Action - Hyderabad, ID `893624123830148`.
Instagram: @networkinaction.hyd, professional account ID must be verified from the linked Page.
App: Mavericks WA Broadcaster, `28360688760263698`.

## Deployment

1. Run `meta-conversations-schema.sql`: private, staff-readable threads/messages; service-only ingestion; manual lead linking.
2. Deploy `meta-conversations.ts` as `meta-conversations`, keeping the staff JWT check enabled.
3. Deploy `meta-conversations-webhook.ts` as `meta-conversations-webhook`. After explicit approval, disable the gateway JWT check only for this callback. It verifies GET challenges and POST HMAC signatures, filters account IDs and exposes no inbox read endpoint.
4. Set server-side Supabase secrets privately:
   - `META_FACEBOOK_PAGE_ID`: `893624123830148`
   - `META_INSTAGRAM_ACCOUNT_ID`: linked Instagram professional account ID
   - `META_PAGE_ACCESS_TOKEN`: Page token for this NIA Page with messaging permissions
   - existing `META_APP_SECRET` and `WHATSAPP_VERIFY_TOKEN` are reused for the same Meta app
5. Callback URL: `https://mtrfipelhvuvqkjwgiif.supabase.co/functions/v1/meta-conversations-webhook`.
6. Connect only the NIA Hyderabad Page/account. Configure Page and Instagram message subscriptions using Meta's setup UI. Verify both challenge and real incoming message delivery.
7. Required permissions for this route include `pages_messaging`, `pages_manage_metadata`, `instagram_basic`, `instagram_manage_messages`; Page discovery may require `pages_show_list`. Obtain only the permissions required by the actual setup. Advanced access/App Review is needed for general public messaging as shown by the app dashboard.
8. Staff CRM Conversations: select Facebook/Instagram, sync recent messages, choose a thread, manually link to lead if known. Send a test reply only after recipient and text are authorised.

## Limits and checks

- Sync uses ten conversations per page and at most twenty recent messages per conversation. The user can request the next conversation page. This does not promise a full historical import.
- Facebook and Instagram identifiers are scoped strings, not telephone numbers. No automatic lead creation or identity merging.
- Only standard text replies within 24 hours of the last incoming message are supported. No human-agent extension, unsolicited broadcasts, reactions or media replies in this phase.
- API acceptance is not a delivery/read receipt. Message echoes are ingested; delivery/read receipt UI is not yet implemented for Meta channels.
- Unknown send results are not automatically retried. A UUID reservation prevents duplicate CRM requests from sending twice.
- Existing WhatsApp enquiry routing remains 7997994493, broadcasts/API replies 7997994495.
- Tokens never go into GitHub, browser configuration or chat. “Configured” status indicates secret presence, not permission or webhook verification.

Official references:
- https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a
- https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api
