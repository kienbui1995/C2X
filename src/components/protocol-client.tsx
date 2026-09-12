"use client";

import { useLanguage } from "@/components/language-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STATES = [
  ["INIT", "Codex / C2X mở task, gửi goal đã nén", "Codex / C2X opens the task with a packed goal"],
  ["PLAN", "Planner trả brief hữu hạn", "Planner returns a finite brief"],
  ["EXECUTING", "Codex sửa file, chạy test", "Codex edits files and runs tests"],
  ["EXECUTED", "Chỉ metadata: số file, test", "Metadata only: file count, tests"],
  ["REVIEW", "Planner đọc diff stats, không tin lời Codex", "Planner reads diff stats, does not trust Codex"],
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
              ? "Giữ mô hình XiaoDuoYa/codex-with-chatgpt: não nghĩ tách khỏi harness. Mở rộng planner sang ChatGPT web, Groq, Gemini, DeepSeek, OpenRouter, Ollama, OpenAI, Anthropic."
              : "Keeps the XiaoDuoYa/codex-with-chatgpt split: thinking brain away from the harness. Planners can be ChatGPT web, Groq, Gemini, DeepSeek, OpenRouter, Ollama, OpenAI, or Anthropic."}
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
          <CardTitle>{lang === "vi" ? "Quy tắc tiết kiệm" : "Savings rules"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            {lang === "vi"
              ? "Mặt điều khiển không chứa diff, log, hay thân file. Brief Codex thường dưới 1–2k token."
              : "The control plane never carries diffs, logs, or file bodies. The Codex brief usually stays under 1–2k tokens."}
          </p>
          <p>
            {lang === "vi"
              ? "File nhạy cảm (.env, khóa SSH) bị chặn từ lớp packer. Tag [C2C] vẫn parse được để tương thích repo gốc."
              : "Sensitive files (.env, SSH keys) are blocked in the packer. [C2C] tags still parse so the original repo stays compatible."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
