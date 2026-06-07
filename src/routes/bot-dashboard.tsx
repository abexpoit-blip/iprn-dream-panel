import { createFileRoute } from "@tanstack/react-router";
import BotDashboard from "@/pages/bot-dashboard";

export const Route = createFileRoute("/bot-dashboard" as any)({
  component: BotDashboard,
});
