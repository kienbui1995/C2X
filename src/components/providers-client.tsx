"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ProviderRow, PublicConfig } from "@/lib/server-data";
import type { PlannerChoice, ProviderId } from "@/core/types";

export function ProvidersClient({
  initialProviders,
  initialConfig,
}: {
  initialProviders: ProviderRow[];
  initialConfig: PublicConfig;
}) {
  const { t, lang } = useLanguage();
  const [providers, setProviders] = useState(initialProviders);
  const [config, setConfig] = useState(initialConfig);
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledProviders: config.enabledProviders,
          defaultPlanner: config.defaultPlanner,
          openaiCompatibleBaseUrl: config.openaiCompatibleBaseUrl,
          openaiCompatibleModel: config.openaiCompatibleModel,
          ollamaModel: config.ollamaModel,
          keys,
        }),
      });
      const json = (await response.json()) as { config?: PublicConfig; error?: string };
      if (!response.ok) {
        throw new Error(json.error || t.error);
      }
      if (json.config) {
        setConfig(json.config);
        setProviders((current) =>
          current.map((row) => ({
            ...row,
            enabled: json.config!.enabledProviders.includes(row.id),
            configured: json.config!.configured[row.id],
          })),
        );
      }
      setKeys({});
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: ProviderId, enabled: boolean) {
    const next = enabled
      ? [...new Set([...config.enabledProviders, id])]
      : config.enabledProviders.filter((item) => item !== id);
    if (!next.includes("mock")) {
      next.unshift("mock");
    }
    setConfig({ ...config, enabledProviders: next });
    setProviders((current) =>
      current.map((row) => (row.id === id ? { ...row, enabled } : row)),
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-heading text-2xl">{t.navProviders}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.providersLead}</p>
      </header>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? t.saving : t.saveConfig}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{lang === "vi" ? provider.nameVi : provider.name}</CardTitle>
                  <CardDescription>{provider.model}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{provider.kind}</Badge>
                  <Switch
                    checked={config.enabledProviders.includes(provider.id)}
                    onCheckedChange={(checked) => toggle(provider.id, checked)}
                    disabled={provider.id === "mock"}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {lang === "vi" ? provider.blurbVi : provider.blurb}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                ${provider.usdPerMillionIn}/1M in
                {provider.envVar ? ` · ${provider.envVar}` : ""}
              </p>
              {provider.needsKey ? (
                <div className="space-y-1.5">
                  <Label>{t.keyLabel}</Label>
                  <Input
                    type="password"
                    placeholder={provider.configured ? "•••• already set" : "sk-…"}
                    value={keys[provider.id] ?? ""}
                    onChange={(event) =>
                      setKeys((current) => ({ ...current, [provider.id]: event.target.value }))
                    }
                  />
                </div>
              ) : null}
              {provider.id === "openai-compatible" ? (
                <div className="grid gap-2">
                  <Input
                    value={config.openaiCompatibleBaseUrl}
                    onChange={(event) =>
                      setConfig({ ...config, openaiCompatibleBaseUrl: event.target.value })
                    }
                    placeholder="https://host/v1"
                  />
                  <Input
                    value={config.openaiCompatibleModel}
                    onChange={(event) =>
                      setConfig({ ...config, openaiCompatibleModel: event.target.value })
                    }
                    placeholder="model-id"
                  />
                </div>
              ) : null}
              {provider.id === "ollama" ? (
                <Input
                  value={config.ollamaModel}
                  onChange={(event) => setConfig({ ...config, ollamaModel: event.target.value })}
                  placeholder="qwen2.5-coder:7b"
                />
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        default planner: {config.defaultPlanner as PlannerChoice}
      </p>
    </div>
  );
}
