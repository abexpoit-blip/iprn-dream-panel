# Self-Hosted Migration Plan: Supabase → VPS

পুরো backend Supabase থেকে আপনার VPS (`x.nexus-x.site`) এ সরিয়ে আনব। Frontend code Lovable এ থাকবে (যেন আপনি easily edit করতে পারেন), কিন্তু সব data + auth + API VPS এ যাবে।

## Final Architecture

```
Browser → https://x.nexus-x.site (Nginx)
            ├── / → Frontend container (React SSR)
            └── /api/* → API container (Express + JWT)
                          └── Postgres (nexus_db, internal)
                          
Bot containers → Postgres direct (internal network)
```

## Phase 1: Database Schema on VPS Postgres

Port all 13 tables to plain Postgres (no RLS — auth handled at API layer):
`profiles, clients, bots, bot_settings, number_panels, number_pool, otp_audit_log, sms_cdr, sms_logs, sms_ranges, payouts, banned_keywords, active_rates`

- Replace `auth.users` foreign keys with own `users` table (id, email, password_hash, created_at)
- Add `users.role` column (`admin` | `agent`) instead of `profiles.is_admin`
- Indexes on hot lookup columns (user_id, bot_id, status, phone_number)
- Keep `update_updated_at_column` trigger, `current_client_id` becomes API context

## Phase 2: Data Migration Script

Node script that:
1. Connects to Lovable Cloud (using current credentials)
2. Exports each table → JSON
3. Connects to VPS Postgres
4. Bulk inserts in dependency order (users → profiles → clients → bots → settings → …)
5. Auth users: emails preserved, **passwords cannot be migrated** (Supabase hashes are different) — all existing users get a temporary password + forced reset email, OR you manually share a "set new password" link
6. Run once: `node migrate-from-supabase.js`

## Phase 3: API Container (Express + JWT)

New code under `deployment/api/src/`:

- `POST /api/auth/signup` — email+password, bcrypt hash, returns JWT
- `POST /api/auth/login` — verify, returns JWT (7-day expiry)
- `POST /api/auth/refresh` — silent token refresh
- `GET  /api/auth/me` — current user from JWT
- `POST /api/auth/logout` — clears refresh cookie

JWT middleware → attaches `req.user = { id, email, role }` to every protected route.

REST endpoints (mirroring current Supabase queries):
```
GET/POST/PATCH/DELETE  /api/admin/bots
GET/POST/PATCH         /api/admin/bot-settings
GET/POST/PATCH/DELETE  /api/admin/number-pool
GET/POST/PATCH/DELETE  /api/admin/number-panels
GET/POST               /api/admin/clients
GET                    /api/admin/sms-logs
GET                    /api/admin/otp-audit
GET                    /api/admin/payouts
GET/POST               /api/admin/active-rates
GET/POST/DELETE        /api/admin/banned-keywords

GET                    /api/agent/dashboard      (own client only)
GET                    /api/agent/sms-logs
GET                    /api/agent/numbers
POST                   /api/agent/reserve-number
GET                    /api/agent/payouts
```

Auth gating: `requireAuth` + `requireAdmin` middleware. RLS logic moved into SQL `WHERE user_id = $authUserId` clauses.

## Phase 4: Frontend Refactor

Replace `@/integrations/supabase/client.ts` with new `@/lib/api.ts`:

```ts
export const api = {
  get: (path) => fetch(`/api${path}`, { headers: authHeader() }).then(r => r.json()),
  post: (path, body) => fetch(...),
  // etc
}
```

- New `useAuth()` hook → stores JWT in localStorage + httpOnly refresh cookie
- All ~50 `supabase.from('table').select()` calls → `api.get('/admin/table')`
- All `supabase.from('table').insert/update/delete` → `api.post/patch/delete`
- Remove `src/integrations/supabase/` directory entirely
- Update `Auth.tsx`, `_authenticated` guard, `AdminPanel`, `BotsTab`, `RevenueTab`, etc.

## Phase 5: Realtime — Hybrid Approach (recommended)

For live OTP feed (most important) → **WebSocket** via `socket.io`:
- API container exposes `/socket.io/` 
- Bot containers emit `new_sms` event when they scrape an OTP
- Frontend subscribes per-client room

For everything else (bot status, payout updates) → **polling every 10s**.
This gives instant UX where it matters without over-engineering.

## Phase 6: Deployment Wiring

Update `deployment/docker-compose.yml`:
- Add API container with proper env (`JWT_SECRET`, `DATABASE_URL`)
- Wire Nginx to route `/api/*` → api:3000, `/socket.io/*` → api:3000 (with WebSocket upgrade headers)
- Bot containers already on internal network — no change needed

Update `deploy.sh` to run migrations on startup.

## Phase 7: Cutover & Verification

1. Run data migration script (local machine → VPS)
2. Push frontend changes to GitHub → `./deploy.sh` on VPS
3. Test: admin login, bot config save, agent dashboard, SMS feed
4. After 24h stability → disable Supabase project (or leave dormant)

## Technical Notes

- **JWT secret**: I'll generate one and store via `add_secret` for the API container
- **CORS**: API and frontend share `x.nexus-x.site`, so same-origin — no CORS headers needed
- **Cookies**: Refresh token in httpOnly, Secure, SameSite=Strict cookie
- **DB connection**: API uses `pg` pool, env var `DATABASE_URL=postgres://nexus:pass@db:5432/nexus`
- **Bot wire-up**: Bots already read from Postgres via `db.js` — just need to point them at the new `bot_settings` table (which mirrors Supabase schema)
- **Password reset**: Need SMTP credentials for forgot-password emails (or skip email and use admin-issued temp passwords initially)

## Estimated Scope

This is a **major refactor**: ~30-40 files changed, new API layer, full data migration, infrastructure changes. I'll do it in the phases above and ship deploy commands after each phase so you can verify on VPS incrementally.

## Questions Before Starting

1. **SMTP for password reset emails** — do you have an email service (Gmail SMTP, SendGrid, Mailgun)? Or skip emails and use admin-issued temp passwords?
2. **Existing user passwords** — confirm OK that all current users will need to reset their password after migration (Supabase password hashes can't be transferred)?
3. **Phase order** — should I do all phases in one go, or stop after each phase for you to verify on VPS before moving to the next?
