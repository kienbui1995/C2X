import { SessionsClient } from "@/components/sessions-client";
import { loadSessions } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const sessions = await loadSessions();
  return <SessionsClient initialSessions={sessions} />;
}
