import { hasProviderKey } from "@/core/config";
import { HARNESS_CATALOG, PROVIDER_CATALOG, modelForProvider } from "@/core/providers/catalog";
import { loadConfig, loadSessions } from "@/core/store";
import type { AppConfig, HarnessId, ProviderId } from "@/core/types";

export type ProviderRow = {
  id: ProviderId;
  name: string;
  nameVi: string;
  kind: "local" | "subscription" | "api";
  blurb: string;
  blurbVi: string;
  enabled: boolean;
  configured: boolean;
  model: string;
  usdPerMillionIn: number;
  needsKey: boolean;
  envVar: string | null;
  quotaVi: string;
  quotaEn: string;
};

export type HarnessRow = {
  id: HarnessId;
  name: string;
  nameVi: string;
  blurb: string;
  blurbVi: string;
  quotaVi: string;
  quotaEn: string;
  selected: boolean;
};

export type PublicConfig = AppConfig & {
  configured: Record<ProviderId, boolean>;
};

export async function getPublicConfig(): Promise<PublicConfig> {
  const config = await loadConfig();
  return {
    ...config,
    configured: Object.fromEntries(
      PROVIDER_CATALOG.map((entry) => [entry.id, hasProviderKey(config, entry.id)]),
    ) as Record<ProviderId, boolean>,
  };
}

export async function getProviderRows(): Promise<ProviderRow[]> {
  const config = await loadConfig();
  return PROVIDER_CATALOG.map((entry) => ({
    ...entry,
    enabled: config.enabledProviders.includes(entry.id),
    configured: hasProviderKey(config, entry.id),
    model: modelForProvider(entry.id, config),
  }));
}

export async function getHarnessRows(): Promise<HarnessRow[]> {
  const config = await loadConfig();
  const team = config.defaultHarnessTeam ?? [config.defaultHarness];
  return HARNESS_CATALOG.map((entry) => ({
    ...entry,
    selected: team.includes(entry.id),
  }));
}

export { loadSessions };
