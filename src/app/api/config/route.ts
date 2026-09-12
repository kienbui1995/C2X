import { NextResponse } from "next/server";
import { hasProviderKey, maskSecret, mergeConfig } from "@/core/config";
import { PROVIDER_CATALOG } from "@/core/providers/catalog";
import { loadConfig, saveConfig } from "@/core/store";
import { isProviderId, type AppConfig, type ProviderId } from "@/core/types";

function publicConfig(config: AppConfig) {
  const keys = Object.fromEntries(
    PROVIDER_CATALOG.map((entry) => [entry.id, maskSecret(config.keys[entry.id])]),
  ) as Record<ProviderId, string>;
  return {
    ...config,
    keys,
    configured: Object.fromEntries(
      PROVIDER_CATALOG.map((entry) => [entry.id, hasProviderKey(config, entry.id)]),
    ) as Record<ProviderId, boolean>,
  };
}

export async function GET() {
  const config = await loadConfig();
  return NextResponse.json({ config: publicConfig(config) });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<AppConfig> & {
    keys?: Partial<Record<ProviderId, string>>;
  };
  const current = await loadConfig();
  const nextKeys = { ...current.keys };
  if (body.keys) {
    for (const [id, value] of Object.entries(body.keys)) {
      if (!isProviderId(id) || !value) {
        continue;
      }
      if (value.includes("••••")) {
        continue;
      }
      nextKeys[id] = value.trim();
    }
  }
  const saved = await saveConfig(
    mergeConfig({
      ...current,
      ...body,
      keys: nextKeys,
    }),
  );
  return NextResponse.json({ config: publicConfig(saved) });
}
