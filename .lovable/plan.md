I will build the IMS Agent panel as requested, focusing on the agent account functionality first while matching the design of the IMS platform.

### Phase 1: Foundation & Auth
- **Database Schema**: Create `profiles`, `sms_ranges`, `otp_numbers`, and `transactions` tables.
- **Authentication**: Build a custom login page inspired by the IMS login screen, including the security question pattern.

### Phase 2: Core Agent Features
- **Sidebar & Navigation**: Replicate the IMS sidebar with "Dashboard", "SMS Module", "Clients", and "Stats & Reports".
- **Dashboard View**: Implement stats cards for "Today SMS", "Yesterday SMS", "Last 7 Days", and "Money This Month".
- **SMS Module**:
  - **SMS Ranges**: Table displaying prefix, test numbers, and tiered payouts ($0.012 - $0.014).
  - **SMS Numbers**: View for active numbers providing OTPs.
- **Client Management**: Initial UI for agents to view and manage their clients.

### Phase 3: Functionality
- **Data Integration**: Connect the tables to the UI using TanStack Query.
- **Payout Logic**: Implement the "pay per successful OTP" model mentioned (default $0.01 earnings per hit).

### Technical Overview
- **UI**: Tailwind CSS with Shadcn/UI for a clean, professional finish.
- **Backend**: Lovable Cloud for secure data storage and real-time updates.
- **Icons**: Lucide React for matching the original navigation.

I'll start with the database setup and the login screen.
