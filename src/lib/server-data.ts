import { hasProviderKey } from "@/core/config";
import { PROVIDER_CATALOG } from "@/core/providers/catalog";
import { loadConfig, loadSessions } from "@/core/store";
import { assertNever, type AppConfig, type ProviderId } from "@/core/types";

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
};

export type PublicConfig = AppConfig & {
  configured: Record<ProviderId, boolean>;
};

function modelFor(id: ProviderId, config: AppConfig): string {
  switch (id) {
    case "openai":
      return config.openaiModel;
    case "anthropic":
      return config.anthropicModel;
    case "gemini":
      return config.geminiModel;
    case "groq":
      return config.groqModel;
    case "openrouter":
      return config.openrouterModel;
    case "deepseek":
      return config.deepseekModel;
    case "ollama":
      return config.ollamaModel;
    case "openai-compatible":
      return config.openaiCompatibleModel;
    case "mock":
    case "chatgpt-web":
      return PROVIDER_CATALOG.find((entry) => entry.id === id)?.defaultModel ?? id;
    default:
      return assertNever(id, `Unknown provider: ${id}`);
  }
}

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
    model: modelFor(entry.id, config),
  }));
}

export { loadSessions };
