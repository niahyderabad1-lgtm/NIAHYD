# Staff sign-in update

Supabase client v2.57.4 is vendored from npm CDN for PKCE OAuth, email verification and refresh-token rotation.

- Sign-in remains restricted by crm_staff + database RLS. Public signups stay disabled.
- Sessions default to sessionStorage and survive tab refreshes. An explicit Keep me signed in checkbox opts into localStorage. Sign out clears both session stores and loaded records.
- Google button checks Supabase provider availability; disabled until configured.
- Google Cloud OAuth web client: origin https://niahyderabad1-lgtm.github.io and redirect https://mtrfipelhvuvqkjwgiif.supabase.co/auth/v1/callback. Set only email/profile/openid scopes. Paste client secret privately in Supabase Google provider, keep nonce checks ON, require email.
- Supabase redirect allowlist must include https://niahyderabad1-lgtm.github.io/NIAHYD/crm.html.
- Existing staff email amp.maverick@gmail.com should sign into its already-invited account. Never add staff access automatically for arbitrary Google accounts.
- Email OTP verification code is implemented but UI remains hidden until SMTP/template setup is complete. Supabase free default currently sends links and disables template editing. Preserve working link login until SMTP is ready.
- When custom SMTP is configured, update magic-link template to display {{ .Token }} (optionally keep {{ .ConfirmationURL }} as fallback). Then change login button/status to email code and reveal otp-form after successful signInWithOtp.
- Google OAuth and SMTP credentials are entered by the user, never committed.
- Supabase built-in email rate limits and session policy still apply. Long-lived session option does not bypass revoked tokens or staff RLS.
