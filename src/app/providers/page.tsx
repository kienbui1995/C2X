import { ProvidersClient } from "@/components/providers-client";
import { getHarnessRows, getProviderRows, getPublicConfig } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const [providers, harnesses, config] = await Promise.all([
    getProviderRows(),
    getHarnessRows(),
    getPublicConfig(),
  ]);
  return (
    <ProvidersClient
      initialProviders={providers}
      initialHarnesses={harnesses}
      initialConfig={config}
    />
  );
}
