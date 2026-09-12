"use client";

import { useLanguage } from "@/components/language-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STATES = [
  ["INIT", "C2X mở task, gửi goal đã nén sang planner chat web", "C2X opens the task and sends a packed goal to a web-chat planner"],
  ["PLAN", "Planner (ChatGPT / Claude / Gemini web hoặc API) trả brief hữu hạn", "Planner (ChatGPT / Claude / Gemini web or an API) returns a finite brief"],
  ["EXECUTING", "Codex hoặc Claude Code sửa file, chạy test — không nghĩ lại", "Codex or Claude Code edits files and runs tests — no re-planning"],
  ["EXECUTED", "Chỉ metadata: số file, test", "Metadata only: file count, tests"],
  ["REVIEW", "Planner chat web đọc diff stats, không tin lời harness", "The web-chat planner reads diff stats, does not trust the harness"],
  ["DONE / BLOCKED", "Khép vòng hoặc hỏi thêm", "Close the loop or ask for help"],
] as const;

export function ProtocolClient() {
  const { t, lang } = useLanguage();
  return (
    <div className="space-y-5">
      <header>
        <h2 className="font-heading text-2xl">{t.navProtocol}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.protocolLead}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>C2C → C2X</CardTitle>
          <CardDescription>
            {lang === "vi"
              ? "Giữ mô hình hai não: chat web nghĩ, harness chạy. Planner: chatgpt-web, claude-web, gemini-web (và API nếu cần). Execute: codex hoặc claude-code — không bao giờ plan/review."
              : "Keeps the two-brain split: web chats think, the harness runs. Planners: chatgpt-web, claude-web, gemini-web (and APIs if needed). Execute: codex or claude-code — never plan/review."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {STATES.map(([state, vi, en]) => (
            <div key={state} className="grid gap-1 border-b border-border/60 py-2 last:border-0 md:grid-cols-[140px_1fr]">
              <p className="font-mono text-sm text-primary">{state}</p>
              <p className="text-sm text-muted-foreground">{lang === "vi" ? vi : en}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{lang === "vi" ? "Quy tắc hạn mức" : "Quota rules"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            {lang === "vi"
              ? "Mặt điều khiển không chứa diff, log, hay thân file. Brief harness thường dưới 1–2k token. Tag [C2X] và [C2C] đều nhận."
              : "The control plane never carries diffs, logs, or file bodies. The harness brief usually stays under 1–2k tokens. Both [C2X] and [C2C] tags parse."}
          </p>
          <p>
            {lang === "vi"
              ? "Đừng đốt hạn mức Codex/Claude Code cho plan hay review. Dàn phần nghĩ sang lượt chat web đã trả. File nhạy cảm (.env, khóa SSH) bị chặn từ lớp packer."
              : "Do not burn Codex/Claude Code quota on plan or review. Spread thinking across the web-chat allowances you already pay for. Sensitive files (.env, SSH keys) are blocked in the packer."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
