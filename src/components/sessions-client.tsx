"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTokens } from "@/core/tokens";
import type { SessionRecord } from "@/core/types";

export function SessionsClient({ initialSessions }: { initialSessions: SessionRecord[] }) {
  const { t } = useLanguage();

  if (initialSessions.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="font-heading text-2xl">{t.navSessions}</h2>
        </header>
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{t.emptyTitle}</CardTitle>
            <CardDescription>{t.sessionsEmpty}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="font-heading text-2xl">{t.navSessions}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.sessionsLead}</p>
      </header>
      <div className="space-y-3">
        {initialSessions.map((session) => (
          <Card key={session.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{session.goal}</CardTitle>
                  <CardDescription className="font-mono">
                    {session.id} · {session.planner} →{" "}
                    {(session.harnessTeam ?? [session.harness ?? "codex"]).join(" + ")} ·{" "}
                    {session.workspaceSource}
                  </CardDescription>
                </div>
                <Badge variant="outline">{session.state}</Badge>
              </div>
              {session.savings ? (
                <p className="text-sm text-muted-foreground">
                  {t.savedCodex}: {Math.round(session.savings.savedCodexPercent * 100)}% ·{" "}
                  {formatTokens(session.savings.savedCodexTokens)} tok
                  {typeof session.savings.savedHarnessTurns === "number"
                    ? ` · ${t.savedHarness}: ${session.savings.savedHarnessTurns}`
                    : ""}
                </p>
              ) : null}
              <Link
                href={`/?session=${session.id}`}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {t.resumeSession}
              </Link>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
