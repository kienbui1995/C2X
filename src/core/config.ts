import { PROVIDER_CATALOG } from "@/core/providers/catalog";
import {
  DEFAULT_HARNESS_TEAM,
  isHarnessId,
  isPlannerChoice,
  isProviderId,
  resolveHarnessTeam,
  type AppConfig,
  type HarnessId,
  type PlannerChoice,
  type ProviderId,
} from "@/core/types";

export const DEFAULT_CONFIG: AppConfig = {
  enabledProviders: ["mock", "chatgpt-web", "claude-web", "gemini-web", "ollama"],
  defaultPlanner: "auto",
  defaultHarness: "codex",
  defaultHarnessTeam: [...DEFAULT_HARNESS_TEAM],
  defaultBudget: 4000,
  keys: {},
  openaiCompatibleBaseUrl: "http://127.0.0.1:11434/v1",
  openaiCompatibleModel: "custom-model",
  ollamaModel: "qwen2.5-coder:7b",
  openaiModel: "gpt-4.1-mini",
  anthropicModel: "claude-3-5-haiku-latest",
  geminiModel: "gemini-2.0-flash",
  groqModel: "llama-3.3-70b-versatile",
  openrouterModel: "openrouter/auto",
  deepseekModel: "deepseek-chat",
};

const ENV_BY_PROVIDER: Record<ProviderId, string | null> = {
  mock: null,
  "chatgpt-web": null,
  "claude-web": null,
  "gemini-web": null,
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  ollama: "OLLAMA_BASE_URL",
  "openai-compatible": "CUSTOM_OPENAI_API_KEY",
};

export function envKeyFor(id: ProviderId): string | null {
  return ENV_BY_PROVIDER[id];
}

export function mergeConfig(partial?: Partial<AppConfig> | null): AppConfig {
  const base: AppConfig = {
    ...DEFAULT_CONFIG,
    ...partial,
    keys: { ...DEFAULT_CONFIG.keys, ...partial?.keys },
    enabledProviders: normalizeEnabled(partial?.enabledProviders),
    defaultPlanner: normalizePlanner(partial?.defaultPlanner),
    defaultHarness: normalizeHarness(
      partial?.defaultHarness ??
        (partial?.defaultHarnessTeam && partial.defaultHarnessTeam[0]) ??
        DEFAULT_CONFIG.defaultHarness,
    ),
    defaultHarnessTeam: normalizeTeam(
      partial?.defaultHarnessTeam,
      partial?.defaultHarness,
    ),
    defaultBudget: Number(partial?.defaultBudget) || DEFAULT_CONFIG.defaultBudget,
  };
  return base;
}

function normalizeEnabled(value: ProviderId[] | undefined): ProviderId[] {
  if (!value?.length) {
    return [...DEFAULT_CONFIG.enabledProviders];
  }
  const unique = [...new Set(value.filter(isProviderId))];
  if (!unique.includes("mock")) {
    unique.unshift("mock");
  }
  return unique;
}

function normalizePlanner(value: PlannerChoice | undefined): PlannerChoice {
  if (value && isPlannerChoice(value)) {
    return value;
  }
  return "auto";
}

function normalizeHarness(value: HarnessId | undefined): HarnessId {
  if (value && isHarnessId(value)) {
    return value;
  }
  return "codex";
}

function normalizeTeam(
  team: HarnessId[] | undefined,
  harness: HarnessId | undefined,
): HarnessId[] {
  if (team && team.length > 0) {
    return resolveHarnessTeam({ harnessTeam: team });
  }
  if (harness && isHarnessId(harness) && team !== undefined) {
    return [harness];
  }
  return [...DEFAULT_CONFIG.defaultHarnessTeam];
}

export function keyFromEnv(id: ProviderId): string | undefined {
  const envName = envKeyFor(id);
  if (!envName) {
    return undefined;
  }
  const value = process.env[envName]?.trim();
  return value || undefined;
}

export function resolvedKey(config: AppConfig, id: ProviderId): string | undefined {
  return config.keys[id]?.trim() || keyFromEnv(id);
}

export function hasProviderKey(config: AppConfig, id: ProviderId): boolean {
  const entry = PROVIDER_CATALOG.find((item) => item.id === id);
  if (!entry?.needsKey) {
    return true;
  }
  return Boolean(resolvedKey(config, id));
}

export function maskSecret(value: string | undefined): string {
  if (!value) {
    return "";
  }
  if (value.length <= 8) {
    return "••••";
  }
  return `${value.slice(0, 3)}••••${value.slice(-2)}`;
}

export type PublicAppConfig = AppConfig & {
  configured: Record<ProviderId, boolean>;
};

export function toPublicConfig(config: AppConfig): PublicAppConfig {
  const keys = Object.fromEntries(
    PROVIDER_CATALOG.map((entry) => [entry.id, maskSecret(config.keys[entry.id])]),
  ) as AppConfig["keys"];
  return {
    ...config,
    keys,
    configured: Object.fromEntries(
      PROVIDER_CATALOG.map((entry) => [entry.id, hasProviderKey(config, entry.id)]),
    ) as Record<ProviderId, boolean>,
  };
}
