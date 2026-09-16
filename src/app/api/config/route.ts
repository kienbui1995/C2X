import { NextResponse } from "next/server";
import { mergeConfig, toPublicConfig } from "@/core/config";
import { loadConfig, saveConfig } from "@/core/store";
import { isProviderId, type AppConfig, type ProviderId } from "@/core/types";

export async function GET() {
  const config = await loadConfig();
  return NextResponse.json({ config: toPublicConfig(config) });
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
  return NextResponse.json({ config: toPublicConfig(saved) });
}
