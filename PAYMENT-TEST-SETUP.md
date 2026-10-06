# Razorpay test checkout

Open the visitor page with `?test_payment=1`. Normal visitor enquiries keep payments closed pending live setup and complete payment testing. This public test route uses only `rzp_test_` credentials; no real funds or event seats are involved.

Supabase secrets: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. Keep secrets exclusively in Supabase. The service refuses live keys. `payment-test-schema.sql` creates service-only test order storage; test payments never update live leads to paid.

The existing visitor-intake function validates the enquiry request identifier, creates an INR 260000-paise order, verifies the HMAC signature, then fetches Razorpay payment and order status to confirm captured/paid and the expected amount. Browser success alone is insufficient. Orders are reused for the same enquiry; duplicate inserts return the stored order. An abandoned duplicate API order cannot charge itself.

Before live launch: live orders kept separately from tests, signed webhook reconciliation for interrupted checkout and refunds, capture configuration, failed/cancelled/successful checkout tests, staff payment visibility and production secrets. Do not remove the test-key restriction until these are complete.

## Event cancellation terms supplied by NIA
Visitor cancellations are non-refundable. If NIA cancels the event, visitors receive a full refund or a pass for the next event. Displayed next to the form and in the footer.

## Test webhook
Set RAZORPAY_WEBHOOK_SECRET in Supabase. Configure Razorpay Test Mode webhook URL https://mtrfipelhvuvqkjwgiif.supabase.co/functions/v1/visitor-intake?webhook=razorpay with that same secret and events payment.captured and order.paid. Webhooks require valid raw-body HMAC and API payment/order confirmation. Unknown test orders are acknowledged without creating records. Duplicate verified notifications are idempotent. No staff table authentication settings change. Live keys are refused.
