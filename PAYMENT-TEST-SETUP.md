# Razorpay test checkout

Open the visitor page with `?test_payment=1`. Normal visitor enquiries keep payments closed pending live setup and cancellation terms. This public test route uses only `rzp_test_` credentials; no real funds or event seats are involved.

Supabase secrets: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. Keep secrets exclusively in Supabase. The service refuses live keys. `payment-test-schema.sql` creates service-only test order storage; test payments never update live leads to paid.

The existing visitor-intake function validates the enquiry request identifier, creates an INR 260000-paise order, verifies the HMAC signature, then fetches Razorpay payment and order status to confirm captured/paid and the expected amount. Browser success alone is insufficient. Orders are reused for the same enquiry; duplicate inserts return the stored order. An abandoned duplicate API order cannot charge itself.

Before live launch: final refund/cancellation policy, live orders kept separately from tests, signed webhook reconciliation for interrupted checkout and refunds, capture configuration, failed/cancelled/successful checkout tests, staff payment visibility and production secrets. Do not remove the test-key restriction until these are complete.
