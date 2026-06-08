# Admin → Agent → Client Allocation Flow

## Goal

Numbers scraped from IMS/Shark panels arrive in `number_pool` with `panel_payout` (the rate the upstream panel pays *us* per OTP). Build a 3-tier distribution chain so:

- **Admin** assigns pool numbers (or whole ranges) to **Agents** with an **agent markup**
- **Agents** sub-assign their allocated numbers to **Clients** with a **client markup**
- When an OTP is billed, profit at each tier is recorded; client pays `panel_payout + agent_markup + client_markup`

## Data Model

Add one new table `number_allocations` (chain ledger) and 2 columns to `number_pool`:

```text
number_pool (existing + new):
  ├─ panel_payout     (rate from upstream, e.g. 0.30)
  ├─ assigned_agent   NEW  uuid → profiles(id) (the agent who owns this number)
  ├─ assigned_client  NEW  uuid → clients(id)  (the client currently using it)

number_allocations (new):
  id, number_pool_id, tier ('agent'|'client'),
  from_user_id, to_user_id (or to_client_id),
  rate_bdt (cumulative price at this tier),
  markup_bdt (this tier's added margin),
  status ('active'|'released'),
  created_at, released_at
```

`active_rates` already exists for country/provider base rates — we'll leave it alone and use `panel_payout` from the scrape as the actual cost basis.

## UI

### 1. Admin → Numbers page (existing)
- Add bulk-select checkboxes
- "Assign to Agent" button → dialog: pick agent + markup amount → updates `assigned_agent` + inserts agent-tier row in `number_allocations`
- New column **Assigned Agent** / **Agent Rate**

### 2. Agent Dashboard → new "My Numbers" page (`/_dashboard/agent/numbers`)
- Shows numbers where `assigned_agent = me`
- Bulk-select → "Assign to Client" → dialog: pick from agent's clients + markup → updates `assigned_client` + inserts client-tier row

### 3. Client view (existing client dashboard)
- Shows numbers where `assigned_client = my client_id`
- Shows the final rate they pay

## Billing Hook

Update the existing OTP audit trigger (`sync_number_pool_on_otp_success`) and add commission logic in `deployment/bot/commission.js`:
- On `outcome='billed'`, look up the active allocation chain for that number
- Credit each tier's profit (agent_markup → agent balance; client pays full rate)

## Server Functions

Three new `createServerFn` calls in `src/lib/allocations.functions.ts`:
- `assignNumbersToAgent({ numberIds, agentUserId, markup })`
- `assignNumbersToClient({ numberIds, clientId, markup })`
- `releaseAllocation({ allocationId })`

All gated with `requireSupabaseAuth` + role check (`is_admin` for tier-1, agent for tier-2).

## Files

- **Migration:** new table + 2 columns + RLS + GRANTs
- **New:** `src/lib/allocations.functions.ts`
- **New:** `src/routes/_dashboard/agent/numbers.tsx`
- **Edit:** `src/routes/_dashboard/sms/numbers.tsx` — add bulk-assign UI
- **Edit:** `deployment/bot/commission.js` — pay each tier on billed OTP
- **Edit:** `deployment/bot/imsBot.js` + `sharkBot.js` — already populate `panel_payout`; no change needed

## Out of Scope (next step)

- Agent invoicing / payouts UI
- Bulk range-level rules (e.g. "all UK numbers → agent X")
- Auto-release on client churn

## Confirm before I build

1. **Markup model** — is markup a flat add-on (e.g. +0.05 BDT) or a percentage? I assumed flat BDT.
2. **One agent per number** at a time, right? (Reassign releases the previous allocation.)
3. **Agent identity** — admin assigns to a `profiles.id` where role='agent', correct? Or to an `agents` table I'm missing?
