import { SavingsClient } from "@/components/savings-client";
import { loadSessions } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function SavingsPage() {
  const sessions = await loadSessions();
  return <SavingsClient initialSessions={sessions} />;
}
