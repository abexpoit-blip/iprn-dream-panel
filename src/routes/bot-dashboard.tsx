import { createFileRoute } from "@tanstack/react-router";
import BotDashboard from "@/pages/bot-dashboard";

export const Route = createFileRoute("/bot-dashboard")({
  component: BotDashboard,
});
