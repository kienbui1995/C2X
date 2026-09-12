"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Copy, LoaderCircle } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { renderCodexBrief } from "@/core/brief";
import { planToMessage } from "@/core/protocol";
import { formatTokens } from "@/core/tokens";
import type { PlannerChoice, SessionRecord, WorkspaceSource } from "@/core/types";

const DEFAULT_GOAL =
  "Sửa createTask để việc mới thật sự được lưu, giữ bộ lọc status trên URL khi reload, và thêm test cho empty state.";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(json.error || `HTTP ${response.status}`);
  }
  return json;
}

export function StudioClient() {
  const { t, lang } = useLanguage();
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [plannerChoice, setPlannerChoice] = useState<PlannerChoice>("auto");
  const [budget, setBudget] = useState("4000");
  const [workspaceSource, setWorkspaceSource] = useState<WorkspaceSource>("demo");
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [busy, setBusy] = useState<"plan" | "review" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importRaw, setImportRaw] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const briefText = useMemo(
    () => (session?.brief ? renderCodexBrief(session.brief) : ""),
    [session],
  );
  const planText = useMemo(
    () => (session?.plan ? planToMessage(session.plan) : ""),
    [session],
  );

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function onPlan() {
    setBusy("plan");
    setError(null);
    try {
      const result = await postJson<{ session: SessionRecord }>("/api/plan", {
        goal,
        plannerChoice,
        budgetTokens: Number(budget),
        workspaceSource,
      });
      setSession(result.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(null);
    }
  }

  async function onImport() {
    if (!session || !importRaw.trim()) {
      return;
    }
    setBusy("import");
    setError(null);
    try {
      const result = await postJson<{ session: SessionRecord }>("/api/import-plan", {
        sessionId: session.id,
        raw: importRaw,
      });
      setSession(result.session);
      setImportRaw("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(null);
    }
  }

  async function onReview() {
    if (!session?.plan) {
      return;
    }
    setBusy("review");
    setError(null);
    try {
      const result = await postJson<{ session: SessionRecord }>("/api/review", {
        sessionId: session.id,
        changedFiles: session.plan.filesLikelyInvolved,
        tests: "12 passed",
      });
      setSession(result.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-primary/80 md:hidden">
              C2X · {t.product}
            </p>
            <h2 className="font-heading text-2xl tracking-tight">{t.navStudio}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{t.emptyBody}</p>
          </div>
          <Badge variant="outline" className="font-mono">
            {session ? session.state : "IDLE"}
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t.goalLabel}</CardTitle>
          <CardDescription>
            {lang === "vi"
              ? "Planner đọc bản nén. Codex không được nuốt cả repo."
              : "The planner reads the pack. Codex never swallows the repo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder={t.goalPlaceholder}
            className="min-h-28"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.planner}>
              <Select
                value={plannerChoice}
                onValueChange={(value) => {
                  if (value) {
                    setPlannerChoice(value as PlannerChoice);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t.auto}</SelectItem>
                  <SelectItem value="mock">Mock</SelectItem>
                  <SelectItem value="chatgpt-web">ChatGPT web</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                  <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.budget}>
              <Select
                value={budget}
                onValueChange={(value) => {
                  if (value) {
                    setBudget(value);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2000">2k</SelectItem>
                  <SelectItem value="4000">4k</SelectItem>
                  <SelectItem value="8000">8k</SelectItem>
                  <SelectItem value="12000">12k</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.workspace}>
              <Select
                value={workspaceSource}
                onValueChange={(value) => {
                  if (value) {
                    setWorkspaceSource(value as WorkspaceSource);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">{t.demoWorkspace}</SelectItem>
                  <SelectItem value="repo">{t.repoWorkspace}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void onPlan()} disabled={busy !== null || !goal.trim()}>
              {busy === "plan" ? <LoaderCircle className="animate-spin" /> : null}
              {busy === "plan" ? t.packing : t.runPlan}
            </Button>
            {session?.brief ? (
              <Button variant="outline" onClick={() => void copyText("brief", briefText)}>
                <Copy />
                {copied === "brief" ? t.copied : t.copyBrief}
              </Button>
            ) : null}
            {session?.plan ? (
              <Button variant="secondary" onClick={() => void onReview()} disabled={busy !== null}>
                {busy === "review" ? <LoaderCircle className="animate-spin" /> : null}
                {busy === "review" ? t.reviewing : t.simulate}
              </Button>
            ) : null}
          </div>
          {error ? (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : null}
          {session?.usedFallback ? (
            <p className="text-sm text-primary/90">
              {t.fallback}
              {session.fallbackReason ? ` — ${session.fallbackReason}` : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {session?.pack && session.savings ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label={t.rawTokens} value={formatTokens(session.pack.rawTokens)} hint={t.costHint} />
          <Metric
            label={t.packedTokens}
            value={formatTokens(session.pack.packedTokens)}
            hint={`${Math.round((1 - session.pack.compressionRatio) * 100)}%`}
          />
          <Metric
            label={t.savedCodex}
            value={`${Math.round(session.savings.savedCodexPercent * 100)}%`}
            hint={`${formatTokens(session.savings.savedCodexTokens)} tok`}
          />
        </div>
      ) : null}

      {!session ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{t.emptyTitle}</CardTitle>
            <CardDescription>{t.emptyBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{t.packTitle}</CardTitle>
              <CardDescription>
                {session.pack?.fileCount ?? 0} files · {session.planner}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="max-h-56 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
                {session.pack?.tree}
              </pre>
              <ul className="space-y-2">
                {session.pack?.excerpts.map((excerpt) => (
                  <li key={`${excerpt.path}:${excerpt.startLine}`} className="rounded-lg bg-muted/30 p-3">
                    <p className="font-mono text-xs text-primary">
                      {excerpt.path}:{excerpt.startLine}-{excerpt.endLine}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{excerpt.reason}</p>
                  </li>
                ))}
              </ul>
              {session.pack?.omittedFiles.length ? (
                <p className="text-xs text-muted-foreground">
                  {t.omitted}: {session.pack.omittedFiles.join(", ")}
                </p>
              ) : null}
              {session.pack?.skippedSensitive.length ? (
                <p className="text-xs text-muted-foreground">
                  {t.secrets}: {session.pack.skippedSensitive.join(", ")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{session.plan ? t.planTitle : t.pasteTitle}</CardTitle>
              <CardDescription>
                {session.brief
                  ? `${session.brief.tokenEstimate} tok → Codex`
                  : t.importPlan}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={session.plan ? "plan" : "paste"}>
                <TabsList>
                  <TabsTrigger value="plan">{t.planTitle}</TabsTrigger>
                  <TabsTrigger value="brief">{t.briefTitle}</TabsTrigger>
                  <TabsTrigger value="paste">{t.pasteTitle}</TabsTrigger>
                  <TabsTrigger value="review">{t.reviewTitle}</TabsTrigger>
                </TabsList>
                <TabsContent value="plan" className="mt-3 space-y-3">
                  {session.plan ? (
                    <>
                      <Section title={t.rationale} body={session.plan.rationale} />
                      <Section title={t.actions} items={session.plan.actions} />
                      <Section title={t.files} items={session.plan.filesLikelyInvolved} />
                      <Section title={t.tests} items={session.plan.tests} />
                      <Section title={t.criteria} items={session.plan.successCriteria} />
                      <Section title={t.risks} items={session.plan.risks} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t.importPlan}</p>
                  )}
                </TabsContent>
                <TabsContent value="brief" className="mt-3">
                  <pre className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
                    {briefText || planText || "—"}
                  </pre>
                </TabsContent>
                <TabsContent value="paste" className="mt-3 space-y-3">
                  <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
                    {session.pastePrompt || briefText || "—"}
                  </pre>
                  {session.pastePrompt ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void copyText("paste", session.pastePrompt || "")}
                    >
                      <Copy />
                      {copied === "paste" ? t.copied : t.copyPaste}
                    </Button>
                  ) : null}
                  <div className="space-y-2">
                    <Label>{t.importPlan}</Label>
                    <Textarea
                      value={importRaw}
                      onChange={(event) => setImportRaw(event.target.value)}
                      placeholder={t.importPlaceholder}
                      className="min-h-28 font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void onImport()}
                      disabled={busy !== null || !importRaw.trim()}
                    >
                      {t.applyImport}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="review" className="mt-3 space-y-2">
                  {session.review ? (
                    <>
                      <Badge>{session.review.state}</Badge>
                      <p className="text-sm">{session.review.summary}</p>
                      <Section title={t.risks} items={session.review.issues} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t.simulate}</p>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {session ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.timeline}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {session.events.map((event) => (
                <li key={`${event.at}-${event.state}-${event.note}`} className="flex gap-3 text-sm">
                  <Badge variant="outline" className="h-6 font-mono">
                    {event.state}
                  </Badge>
                  <div>
                    <p>{event.note}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{event.at}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-2xl">{value}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function Section({
  title,
  body,
  items,
}: {
  title: string;
  body?: string;
  items?: string[];
}) {
  if (!body && (!items || items.length === 0)) {
    return null;
  }
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {body ? <p className="mt-1 text-sm">{body}</p> : null}
      {items?.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
