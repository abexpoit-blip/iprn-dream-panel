I will enhance the IMS Agent platform by implementing a number pool system, OTP scraping, and improved financial/performance reporting. I will also ensure the system works correctly in the self-hosted environment by updating the data proxy and authentication logic.

### Number Pool & OTP Scraping
*   **Number Pool Management:** Implement a robust UI in the Admin Panel to manage the `number_pool` table, including adding, reserving, and expiring numbers.
*   **OTP Scraper Configuration:** Add a dedicated interface to manage IMS and Hadi scraper settings, using the provided credentials (`mamun99` / `mamun@12aa#`).
*   **Real-time Ingest Monitoring:** Update the Live OTP Audit tab to show real-time scraped messages from the ingest stream.

### Reporting & Stats Upgrades (Admin & Agent)
*   **Detailed CDR Reports:** Enhance SMS CDR with filtering by client, date range, and status.
*   **Client & Range Leaderboards:** Add visual leaderboards for clients and number ranges based on SMS volume and payout performance.
*   **Agent-specific Reporting:** Ensure agents can see their own clients' performance and their own payout history accurately.

### Technical Infrastructure
*   **Self-Hosted Data Proxy:** Update `src/integrations/supabase/client.ts` and the backend `deployment/server/index.ts` to support all necessary CRUD operations and relationship queries required for the new reporting features.
*   **Database Schema Updates:** Verify and apply any missing columns or indices to `profiles`, `number_pool`, and `sms_logs` to support the new features.
*   **Auth Reliability:** Fix the "Invalid credentials" and "Server authentication error" by ensuring the bcrypt comparison and seed admin fallback are perfectly aligned between the frontend and backend.

### Deployment
*   The changes will be applied to the codebase and then deployed to the VPS by running the standard deployment script.
