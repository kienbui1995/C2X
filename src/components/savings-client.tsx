"use client";

import { useMemo } from "react";
import { useLanguage } from "@/components/language-provider";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { emptyLedger, sumLedgers } from "@/core/savings";
import { formatTokens, formatUsd } from "@/core/tokens";
import type { SessionRecord } from "@/core/types";

export function SavingsClient({ initialSessions }: { initialSessions: SessionRecord[] }) {
  const { t } = useLanguage();
  const totals = useMemo(() => {
    const ledgers = initialSessions.map((session) => session.savings).filter((item) => item !== null);
    if (ledgers.length === 0) {
      return emptyLedger();
    }
    const sum = sumLedgers(ledgers);
    return {
      ...sum,
      savedCodexPercent: sum.naiveCodexTotal === 0 ? 0 : sum.savedCodexTokens / sum.naiveCodexTotal,
    };
  }, [initialSessions]);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-heading text-2xl">{t.navSavings}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.savingsLead}</p>
      </header>
      {initialSessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.sessionsEmpty}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>{t.savedCodex}</CardDescription>
            <CardTitle className="font-mono text-3xl">
              {Math.round(totals.savedCodexPercent * 100)}%
            </CardTitle>
            <CardDescription>
              {formatTokens(totals.savedCodexTokens)} / {formatTokens(totals.naiveCodexTotal)}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>USD</CardDescription>
            <CardTitle className="font-mono text-3xl">{formatUsd(totals.savedUsd)}</CardTitle>
            <CardDescription>
              {formatUsd(totals.c2xCostUsd)} vs {formatUsd(totals.naiveCostUsd)} · {t.costHint}
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Codex C2X</CardDescription>
            <CardTitle className="font-mono text-2xl">{formatTokens(totals.c2xCodexTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Planner</CardDescription>
            <CardTitle className="font-mono text-2xl">{formatTokens(totals.plannerTotal)}</CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
