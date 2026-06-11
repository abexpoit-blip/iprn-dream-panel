
# Plan: IMS-Parity Tables + Admin Restructure + OTP Performance

## Goal
IMS panel-এর exact look & function (Search, Show Records dropdown, Copy/CSV/Excel/PDF/Print buttons, date range + range/client filters, server-side pagination) — সব agent+admin tables-এ apply. Admin panel "Clients" → "Agents" রূপান্তর। OTP page server-side pagination।

## Phase 1 — IMSDataTable Rebuild (Core)

`src/components/ims/IMSDataTable.tsx` সম্পূর্ণ রিবিল্ড — IMS layout match:

**Top bar layout (IMS dom):** `[Show Records: 25 ▼]  [Copy] [CSV] [Excel] [PDF] [Print]  [Search: ___]`

**Features:**
- "Show Records" dropdown (10/25/50/100/All) — left
- Export buttons row (center): **Copy** (to clipboard), **CSV**, **Excel** (.xlsx via SheetJS), **PDF** (jsPDF + autotable), **Print** (window.print of table)
- Global search input — right
- Per-column sort (click header)
- Pagination footer: `Showing X to Y of Z entries` + page buttons
- **Server-side mode**: optional `serverSide` prop — accepts `onFetch({page, pageSize, search, sort, filters}) → {rows, total}`
- Client-side mode (default) for small datasets
- Filter slot (`filterBar` prop) — for date range + select filters above table
- Footer slot (`tfoot` prop) — for IMS-style totals row
- Bootstrap-like styling: `table-bordered`, blue header `#0061f2`, card-header filter area

**New deps:** `xlsx`, `jspdf`, `jspdf-autotable` (bun add)

## Phase 2 — Apply to All Pages

Update these to use new IMSDataTable + add IMS filter bars:

| Route | IMS source | Filter bar | Server pagination |
|---|---|---|---|
| `_dashboard/sms/ranges.tsx` | SMSRanges | none | client (small) |
| `_dashboard/sms/numbers.tsx` | MySMSNumbers | range select | client |
| `_dashboard/sms/ratecard.tsx` | SMSRateCard | none | client |
| `_dashboard/stats/cdr.tsx` | SMSCDRReports | date1, date2, range, client, num, cli + Show/Export buttons + totals tfoot | **server** |
| `_dashboard/stats/sms.tsx` (OTP) | — | date range + search | **server** |
| `_dashboard/stats/client.tsx` | SMSClientStats | date range | client |
| `_dashboard/stats/range.tsx` | SMSRangeStats | date range | client |
| `_dashboard/stats/number.tsx` | SMSNumberStats | date range | client |
| `_dashboard/agent/otps.tsx` | — | date + search | **server** |
| `_dashboard/agent/numbers.tsx` | MySMSNumbers | range | client |

## Phase 3 — Admin = Agents View

- Admin nav: hide "Clients" menu → show "Agents" menu
- `_dashboard/stats/client.tsx` for admin role: aggregate **by agent_id** instead of client_id (column: Agent | SMS | Currency | My Payout | Agent Payout)
- Keep client-aggregation for agent role (current behavior)
- Role check via `profiles.is_admin` in component

## Phase 4 — OTP Server-Side Pagination

- `otp_audit_log` table query → server-side via Supabase: `range(from, to)` + `.ilike()` for search + `.gte/lte` for date
- Index check: `created_at DESC`, `phone_number`, `cli` — migration if missing
- Default page size 50, max 200

## Technical Notes

- Export buttons use vanilla `xlsx`, `jspdf-autotable` — exported data = currently-filtered rows (not just current page)
- Print uses hidden iframe with table HTML only
- Server-side mode: debounced search (300ms), Supabase queries via existing client (RLS auto-scopes)
- IMS visual: `bg-[#0061f2]` headers, `border-[#dee2e6]` borders, button colors match: Copy=gray, CSV=info-blue, Excel=success-green, PDF=danger-red, Print=secondary
- Loading spinner overlay on table during fetch
- Empty state preserved

## Files Touched
- `src/components/ims/IMSDataTable.tsx` (rewrite, ~400 lines)
- `src/components/ims/IMSFilterBar.tsx` (new — date/select chips)
- 10 route files (column updates + filter wiring)
- `src/routes/_dashboard.tsx` (nav: hide Clients for admin, add Agents)
- `package.json` (xlsx, jspdf, jspdf-autotable)
- 1 migration (OTP indexes if missing)

## Out of Scope
- Bot logic, RLS policy changes, auth flow
- Real-time subscriptions (manual refresh button instead)
