# Edge Functions references

- LiveKit JS Server SDK: https://docs.livekit.io/reference/server-sdk-js/
  - The current v2 server SDK runs in Node.js, Deno, and Bun.
  - Access tokens are created server-side with `AccessToken`, `addGrant`, and async `toJwt()`.
  - API secrets must not be exposed to frontend clients; short-lived signed tokens are returned by the backend.
  - LiveKit webhooks can be verified with `WebhookReceiver` using the raw request body and Authorization header.

- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
  - Local secrets are read from `supabase/functions/.env` and production secrets can be set with the Dashboard or `supabase secrets set`.
  - Secret values must not be committed. Supabase injects project URL and key variables into functions.
  - Secret keys bypass RLS and must never be shipped to the mobile client.

- Supabase Edge Function authentication: https://supabase.com/docs/guides/functions/auth
  - User functions should use authenticated JWT mode and keep platform JWT verification enabled.
  - External webhooks use no Supabase auth and must verify the provider signature inside the function.
  - Service-to-service functions can use a secret key and privileged Supabase client only for the narrow operation required.

- Supabase Database Webhooks: https://supabase.com/docs/guides/database/webhooks
  - Database webhooks fire after INSERT, UPDATE, or DELETE and can invoke Edge Functions.
  - Webhook secrets should be kept outside migration files, for example in Vault or function secrets.
