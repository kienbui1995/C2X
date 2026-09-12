import { NextResponse } from "next/server";
import { hasProviderKey } from "@/core/config";
import { HARNESS_CATALOG, PROVIDER_CATALOG, modelForProvider } from "@/core/providers/catalog";
import { loadConfig } from "@/core/store";

export async function GET() {
  const config = await loadConfig();
  const providers = PROVIDER_CATALOG.map((entry) => ({
    ...entry,
    enabled: config.enabledProviders.includes(entry.id),
    configured: hasProviderKey(config, entry.id),
    model: modelForProvider(entry.id, config),
  }));
  const harnesses = HARNESS_CATALOG.map((entry) => ({
    ...entry,
    selected: config.defaultHarness === entry.id,
  }));
  return NextResponse.json({
    providers,
    harnesses,
    defaultPlanner: config.defaultPlanner,
    defaultHarness: config.defaultHarness,
  });
}
