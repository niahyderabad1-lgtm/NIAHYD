# NIA Hyderabad visitor landing page

Static landing page for the 14 October 2026 visitor event at Novotel HICC Hyderabad, 6–9 PM IST followed by dinner. Visitor fee: ₹2,600 including taxes and dinner.

## Hosting

In repository Settings → Pages, select Deploy from a branch, main, / (root). The site uses relative asset links and requires no build step.

## Current status

- NIA branding, event details and enquiry form are included.
- WhatsApp handoff targets +91 7997994493. Visitors must press Send.
- Form entries are not persisted. CRM integration is pending.
- Payment button displays a setup-pending notice; it does not take payment.
- Meta tracking, full privacy notice and cancellation/refund terms are pending.

## Security and integrations

GitHub Pages serves static files only. Razorpay secret keys, webhook verification and authenticated CRM requests must run in a separate server-side service. Never put secret keys in these files or commit them to this repository.

## Local preview

Run `python3 -m http.server 8080` from this folder and open http://localhost:8080.
