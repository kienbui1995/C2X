import { NextResponse } from "next/server";
import { hasProviderKey } from "@/core/config";
import { PROVIDER_CATALOG } from "@/core/providers/catalog";
import { loadConfig } from "@/core/store";
import { assertNever, type AppConfig, type ProviderId } from "@/core/types";

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

export async function GET() {
  const config = await loadConfig();
  const providers = PROVIDER_CATALOG.map((entry) => ({
    ...entry,
    enabled: config.enabledProviders.includes(entry.id),
    configured: hasProviderKey(config, entry.id),
    model: modelFor(entry.id, config),
  }));
  return NextResponse.json({ providers, defaultPlanner: config.defaultPlanner });
}
