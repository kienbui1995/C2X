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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { renderCodexBrief } from "@/core/brief";
import type { HarnessDetectResult } from "@/core/harness";
import { HARNESS_CATALOG, getHarness, isPastePlanner, PROVIDER_CATALOG } from "@/core/providers/catalog";
import { planToMessage } from "@/core/protocol";
import { formatTokens } from "@/core/tokens";
import {
  assertNever,
  DEFAULT_HARNESS_TEAM,
  isHarnessId,
  isPlannerChoice,
  isWorkspaceSource,
  toggleHarnessInTeam,
  type HarnessId,
  type HarnessPacketRole,
  type HarnessRunState,
  type PlannerChoice,
  type SessionRecord,
  type WorkspaceSource,
} from "@/core/types";

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

function packetRoleLabel(
  role: HarnessPacketRole,
  t: { packetRoleImplement: string; packetRoleTest: string; packetRoleGeneral: string },
): string {
  switch (role) {
    case "implement":
      return t.packetRoleImplement;
    case "test":
      return t.packetRoleTest;
    case "general":
      return t.packetRoleGeneral;
    default:
      return assertNever(role, `Unknown packet role: ${role}`);
  }
}

function runStateLabel(
  state: HarnessRunState,
  t: { harnessPending: string; harnessExecuting: string; harnessExecuted: string },
): string {
  switch (state) {
    case "pending":
      return t.harnessPending;
    case "executing":
      return t.harnessExecuting;
    case "executed":
      return t.harnessExecuted;
    default:
      return assertNever(state, `Unknown harness run state: ${state}`);
  }
}

export function StudioClient({ doctor = [] }: { doctor?: HarnessDetectResult[] }) {
  const { t, lang } = useLanguage();
  const doctorById = useMemo(
    () => Object.fromEntries(doctor.map((item) => [item.id, item])),
    [doctor],
  );
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [plannerChoice, setPlannerChoice] = useState<PlannerChoice>("auto");
  const [harnessTeam, setHarnessTeam] = useState<HarnessId[]>([...DEFAULT_HARNESS_TEAM]);
  const [budget, setBudget] = useState("4000");
  const [workspaceSource, setWorkspaceSource] = useState<WorkspaceSource>("demo");
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [busy, setBusy] = useState<"plan" | "review" | "import" | "execute" | "record" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importRaw, setImportRaw] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const briefs = useMemo(
    () =>
      session?.briefs?.length
        ? session.briefs
        : session?.brief
          ? [session.brief]
          : [],
    [session],
  );
  const packets = session?.plan?.packets ?? [];
  const teamLabel = (session?.harnessTeam ?? harnessTeam).join(" + ");

  const briefTexts = useMemo(() => {
    return Object.fromEntries(briefs.map((brief) => [brief.owner, renderCodexBrief(brief)])) as Record<
      string,
      string
    >;
  }, [briefs]);
  const planText = useMemo(
    () => (session?.plan ? planToMessage(session.plan) : ""),
    [session],
  );

  function toggleHarness(id: HarnessId, enabled: boolean) {
    if (!enabled && harnessTeam.length === 1) {
      setError(t.teamNeedOne);
      return;
    }
    setError(null);
    setHarnessTeam(toggleHarnessInTeam(harnessTeam, id));
  }

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
        harnessTeam,
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

  async function onExecute(owner?: HarnessId) {
    if (!session?.plan) {
      return;
    }
    setBusy("execute");
    setError(null);
    try {
      const executed = await postJson<{ session: SessionRecord }>("/api/execute", {
        sessionId: session.id,
        all: !owner,
        harness: owner,
      });
      setSession(executed.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(null);
    }
  }

  async function onRecord(owner: HarnessId) {
    if (!session) {
      return;
    }
    setBusy("record");
    setError(null);
    try {
      const recorded = await postJson<{ session: SessionRecord }>("/api/record", {
        sessionId: session.id,
        owner,
      });
      let next = recorded.session;
      if (next.harnessRuns.every((run) => run.state === "executed")) {
        const result = await postJson<{ session: SessionRecord }>("/api/review", {
          sessionId: next.id,
          changedFiles: next.harnessRuns.flatMap((run) => run.changedFiles),
          tests: next.harnessRuns.map((run) => `${run.owner}: ${run.tests || "not run"}`).join("\n"),
        });
        next = result.session;
      }
      setSession(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(null);
    }
  }

  async function onPrepareReview() {
    if (!session) {
      return;
    }
    setBusy("review");
    setError(null);
    try {
      const files = session.plan?.packets.flatMap((packet) => packet.files) ?? [];
      const result = await postJson<{ session: SessionRecord }>("/api/review", {
        sessionId: session.id,
        changedFiles: files,
        tests: session.harnessRuns.map((run) => `${run.owner}: ${run.tests || "not run"}`).join("\n") || "not run",
      });
      setSession(result.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(null);
    }
  }

  async function onSimulateAll() {
    if (!session?.plan) {
      return;
    }
    setBusy("review");
    setError(null);
    try {
      await postJson<{ session: SessionRecord }>("/api/execute", {
        sessionId: session.id,
        all: true,
      });
      const files = session.plan.packets.flatMap((packet) => packet.files);
      const result = await postJson<{ session: SessionRecord }>("/api/review", {
        sessionId: session.id,
        changedFiles: files.length > 0 ? files : session.plan.filesLikelyInvolved,
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
          <CardDescription>{t.harnessTeamLead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder={t.goalPlaceholder}
            className="min-h-28"
          />
          <div className="space-y-2" data-testid="harness-team">
            <Label>{t.harnessTeam}</Label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {HARNESS_CATALOG.map((entry) => {
                const checked = harnessTeam.includes(entry.id);
                const detect = doctorById[entry.id];
                return (
                  <label
                    key={entry.id}
                    data-harness-id={entry.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/70 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{lang === "vi" ? entry.nameVi : entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {lang === "vi" ? entry.blurbVi : entry.blurb}
                      </p>
                      {detect ? (
                        <p
                          className="mt-1 font-mono text-[11px]"
                          data-doctor-id={entry.id}
                          data-doctor-ok={detect.ok ? "true" : "false"}
                        >
                          {t.doctorTitle}: {detect.ok ? t.doctorReady : t.doctorMissing}
                          {detect.ok && detect.binary ? ` · ${detect.binary}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <Switch
                      checked={checked}
                      aria-label={entry.name}
                      onCheckedChange={(enabled) => {
                        if (isHarnessId(entry.id)) {
                          toggleHarness(entry.id, enabled);
                        }
                      }}
                    />
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{t.skillInstallHint}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label={t.planner}>
              <Select
                value={plannerChoice}
                onValueChange={(value) => {
                  if (value && isPlannerChoice(value)) {
                    setPlannerChoice(value);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t.auto}</SelectItem>
                  {PROVIDER_CATALOG.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {lang === "vi" ? entry.nameVi : entry.name}
                    </SelectItem>
                  ))}
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
                  if (value && isWorkspaceSource(value)) {
                    setWorkspaceSource(value);
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
            {session?.plan ? (
              <Button variant="secondary" onClick={() => void onSimulateAll()} disabled={busy !== null}>
                {busy === "review" ? <LoaderCircle className="animate-spin" /> : null}
                {busy === "review" ? t.reviewing : t.simulate}
              </Button>
            ) : null}
          </div>
          {error ? (
            <div className="flex flex-wrap items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void onPlan()} disabled={busy !== null}>
                {t.retry}
              </Button>
            </div>
          ) : null}
          {session?.usedFallback ? (
            <p className="text-sm text-primary/90">
              {t.fallback}
              {session.fallbackReason ? ` — ${session.fallbackReason}` : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {busy === "plan" && !session ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" />
              {t.packing}
            </CardTitle>
            <CardDescription>{t.loadingPlan}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

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

      {session?.savings ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Metric
            label={t.savedHarness}
            value={`${session.savings.savedHarnessTurns}`}
            hint={`${session.savings.c2xHarnessTurns} / ${session.savings.naiveHarnessTurns} · ${t.quotaHint}`}
          />
          <Metric
            label={t.webTurns}
            value={`${session.savings.webChatTurns}`}
            hint={
              lang === "vi"
                ? "Plan + review trên ChatGPT / Claude / Gemini web khi planner là subscription."
                : "Plan + review on ChatGPT / Claude / Gemini web when the planner is a subscription."
            }
          />
        </div>
      ) : null}

      {!session && busy !== "plan" ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{t.emptyTitle}</CardTitle>
            <CardDescription>{t.emptyBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {session ? (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{t.packTitle}</CardTitle>
              <CardDescription>
                {session.pack?.fileCount ?? 0} files · {session.planner} → {teamLabel}
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
                {briefs.length
                  ? `${briefs.length} brief · ${teamLabel}`
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
                <TabsContent value="brief" className="mt-3 space-y-3">
                  {briefs.length ? (
                    briefs.map((brief) => (
                      <div key={brief.owner} className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{getHarness(brief.owner).name}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void copyText(`brief:${brief.owner}`, briefTexts[brief.owner] ?? "")}
                          >
                            <Copy />
                            {copied === `brief:${brief.owner}` ? t.copied : `${t.copyBrief} ${getHarness(brief.owner).name}`}
                          </Button>
                        </div>
                        <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
                          {briefTexts[brief.owner]}
                        </pre>
                      </div>
                    ))
                  ) : (
                    <pre className="max-h-80 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
                      {planText || "—"}
                    </pre>
                  )}
                </TabsContent>
                <TabsContent value="paste" className="mt-3 space-y-3">
                  <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
                    {session.pastePrompt || "—"}
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
                    <Label>{t.importAny}</Label>
                    <Textarea
                      value={importRaw}
                      onChange={(event) => setImportRaw(event.target.value)}
                      placeholder={t.importAnyPlaceholder}
                      className="min-h-28 font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void onImport()}
                      disabled={busy !== null || !importRaw.trim()}
                    >
                      {t.importAny}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="review" className="mt-3 space-y-3">
                  {session.reviewPastePrompt ? (
                    <>
                      <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
                        {session.reviewPastePrompt}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void copyText("review", session.reviewPastePrompt || "")}
                      >
                        <Copy />
                        {copied === "review" ? t.copied : t.copyReview}
                      </Button>
                    </>
                  ) : null}
                  {session.review ? (
                    <>
                      <Badge>{session.review.state}</Badge>
                      <p className="text-sm">{session.review.summary}</p>
                      <Section title={t.risks} items={session.review.issues} />
                    </>
                  ) : null}
                  {!session.review &&
                  isPastePlanner(session.planner) &&
                  (session.state === "EXECUTED" || session.state === "REVIEW") ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t.waitingWebReview}</p>
                      {!session.reviewPastePrompt ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy !== null}
                          onClick={() => void onPrepareReview()}
                        >
                          {busy === "review" ? <LoaderCircle className="animate-spin" /> : null}
                          {busy === "review" ? t.reviewing : t.prepareReview}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {!session.review && !session.reviewPastePrompt && !isPastePlanner(session.planner) ? (
                    <p className="text-sm text-muted-foreground">{t.simulate}</p>
                  ) : null}
                  <div className="space-y-2">
                    <Label>{t.importAny}</Label>
                    <Textarea
                      value={importRaw}
                      onChange={(event) => setImportRaw(event.target.value)}
                      placeholder={t.importAnyPlaceholder}
                      className="min-h-28 font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void onImport()}
                      disabled={busy !== null || !importRaw.trim()}
                    >
                      {t.importAny}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {session ? (
        <Card data-testid="work-packets">
          <CardHeader>
            <CardTitle>{t.packetsTitle}</CardTitle>
            <CardDescription>
              {packets.length
                ? `${packets.length} packet · ${teamLabel}`
                : t.waitingPackets}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {packets.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.waitingPackets}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {packets.map((packet) => {
                  const run = session.harnessRuns.find((item) => item.owner === packet.owner);
                  const harness = getHarness(packet.owner);
                  const briefText = briefTexts[packet.owner] ?? "";
                  return (
                    <div
                      key={packet.id}
                      className="space-y-3 rounded-xl border border-border/70 p-3"
                      data-packet-owner={packet.owner}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{lang === "vi" ? harness.nameVi : harness.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {packetRoleLabel(packet.role, t)}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {run ? runStateLabel(run.state, t) : t.harnessPending}
                        </Badge>
                      </div>
                      <Section title={t.actions} items={packet.actions} />
                      <Section title={t.files} items={packet.files} />
                      <Section title={t.tests} items={packet.tests} />
                      <Section title={t.criteria} items={packet.successCriteria} />
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {t.briefCliHint
                          .replace("{session}", session.id)
                          .replace("{owner}", packet.owner)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!briefText}
                          onClick={() => void copyText(`lane:${packet.owner}`, briefText)}
                        >
                          <Copy />
                          {copied === `lane:${packet.owner}`
                            ? t.copied
                            : `${t.copyBrief} ${harness.name}`}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy !== null}
                          onClick={() => void onRecord(packet.owner)}
                        >
                          {busy === "record" ? <LoaderCircle className="animate-spin" /> : null}
                          {busy === "record" ? t.executing : t.recordFromGit}
                        </Button>
                        {run?.state !== "executed" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy !== null}
                            onClick={() => void onExecute(packet.owner)}
                          >
                            {busy === "execute" ? <LoaderCircle className="animate-spin" /> : null}
                            {busy === "execute" ? t.executing : `${t.simulateOne} · ${harness.name}`}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {session.harnessRuns.some((run) => run.state === "executed") ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t.mergeTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  {session.harnessRuns
                    .map((run) => `${run.owner}: ${run.changedFiles.length} files · ${run.tests || "—"}`)
                    .join(" · ")}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
