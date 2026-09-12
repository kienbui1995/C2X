import { ProvidersClient } from "@/components/providers-client";
import { getProviderRows, getPublicConfig } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const [providers, config] = await Promise.all([getProviderRows(), getPublicConfig()]);
  return <ProvidersClient initialProviders={providers} initialConfig={config} />;
}
