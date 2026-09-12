"use client";

import { useLanguage } from "@/components/language-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STATES = [
  ["INIT", "C2X mở task, gửi goal đã nén sang planner chat web", "C2X opens the task and sends a packed goal to a web-chat planner"],
  ["PLAN", "Planner trả PLAN kèm work packet: mỗi harness một gói (file không chồng khi có thể)", "Planner returns a PLAN with work packets: one packet per harness (disjoint files when possible)"],
  ["EXECUTING", "Từng harness trong đội chạy packet của mình — không nghĩ lại, không thấy brief của teammate", "Each teammate executes only its packet — no re-planning, no other harness's brief"],
  ["EXECUTED", "Gộp metadata: file đổi + test từ mọi harness", "Merge metadata: changed files + tests from every harness"],
  ["REVIEW", "Planner chat web đọc diff stats đã gộp, không tin lời harness", "The web-chat planner reads merged diff stats, does not trust the harness"],
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
              ? "Giữ mô hình hai não: chat web nghĩ, đội harness chạy. Planner: chatgpt-web, claude-web, gemini-web (và API nếu cần). Execute: chọn Codex, Claude Code, Grok Build, OpenCode, Kiro CLI — một hoặc vài cái cùng phiên. Không bao giờ plan/review."
              : "Keeps the two-brain split: web chats think, the harness team runs. Planners: chatgpt-web, claude-web, gemini-web (and APIs if needed). Execute: pick Codex, Claude Code, Grok Build, OpenCode, Kiro CLI — any subset in one session. Never plan/review."}
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
              ? "Mặt điều khiển không chứa diff, log, hay thân file. Mỗi brief harness thường dưới 1–2k token và chỉ gồm packet của harness đó. Tag [C2X] và [C2C] đều nhận."
              : "The control plane never carries diffs, logs, or file bodies. Each harness brief usually stays under 1–2k tokens and includes only that harness's packet. Both [C2X] and [C2C] tags parse."}
          </p>
          <p>
            {lang === "vi"
              ? "Đừng đốt hạn mức Codex, Claude Code, Grok Build, OpenCode hay Kiro CLI cho plan hay review. Gộp chúng: web nghĩ, mỗi harness chạy một packet. File nhạy cảm (.env, khóa SSH) bị chặn từ lớp packer."
              : "Do not burn Codex, Claude Code, Grok Build, OpenCode, or Kiro CLI quota on plan or review. Combine them: web chats think, each harness runs one packet. Sensitive files (.env, SSH keys) are blocked in the packer."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
