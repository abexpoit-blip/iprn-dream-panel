The user is experiencing issues with the Admin Panel, specifically the "Bot Config" section not loading and various bugs across admin/agent accounts. 

Based on exploration:
1. `src/components/admin/BotsTab.tsx` contains a "Bot Dashboard" under the "config" tab.
2. The code has hardcoded default values and uses `updateBotSetting` which calls `supabase.from('bot_settings').upsert(...)`.
3. Some UI buttons use `window.location.href = '/bot-dashboard'`, but no such route exists in `src/routes`.
4. The "Bot Config" link in the sidebar redirects to `/admin?tab=bots`.
5. Several pages like News and Clients are currently basic or have minor issues.

### Fix Bot Config & Dashboard
- Create the missing `/bot-dashboard` route and page.
- Fix the routing from Admin -> Bot Config to properly select the `bots` tab and specifically the configuration view.
- Ensure all bot types (Shark, IMS, Hadi) have consistent UI for credentials, cookie login, and session settings.
- Implement automatic polling (every 10s) for bot statuses on the dashboard.

### Fix Role-Based Access & Data Display
- Ensure Admin and Agent roles see the correct data.
- Fix the `Profiles` table access and ensure `is_admin` checks are robust.
- Standardize the look and feel across all pages (column layouts, text, buttons) to match the IMS theme.

### Verification & Reconciliation
- Implement a real data sync check for CDR totals (Scraped vs Displayed).
- Ensure CSV exports match visible columns and filters.
- Add pagination and status indicators to CDR reports.

### VPS Command Support
- Prepare a script/command to update the VPS with the latest changes.

**Technical Details:**
- Missing Route: `src/routes/bot-dashboard.tsx`
- File to Fix: `src/components/admin/BotsTab.tsx` (Add Shark/IMS/Hadi specific UI details)
- File to Fix: `src/routes/_dashboard/admin.tsx` (Ensure tab selection is handled correctly)
- File to Fix: `src/routes/_dashboard.tsx` (Fix sidebar links)
