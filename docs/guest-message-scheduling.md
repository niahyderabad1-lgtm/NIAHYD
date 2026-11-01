# Personalised guest WhatsApp schedule

This adds three individual messages for every paid guest. It is deliberately
separate from marketing broadcasts and requires a supported, Meta-approved
template for each message.

| Purpose | Timing | Personalisation available |
| --- | --- | --- |
| Payment confirmation | Immediately after verified payment | Name, meeting date/time, venue, fee |
| Venue reminder | Two days before the meeting, 10:00 AM IST by default | Name, meeting date/time, venue, address |
| Final reminder | Meeting day, 10:00 AM IST by default | Name, meeting date/time, venue, address |

## Safe rollout

1. Apply `guest-message-schedule.sql` in the Supabase SQL editor.
2. Use the CRM to select one approved WhatsApp template for each purpose. The
   template’s body variables must match the configured parameter order.
3. Deploy a server-side dispatcher that claims only due `scheduled` jobs and
   sends them with the WhatsApp Cloud API. It must mark timeouts as
   `uncertain`, not retry them automatically.
4. After Razorpay verifies a payment, the payment webhook calls
   `schedule_paid_guest_messages(lead_id)` with the service role.
5. Run a controlled test with one internal paid guest before enabling any rule.

The SQL migration only stores rules and jobs. It cannot send a message and all
rules start disabled, so applying it is safe before templates are approved.
