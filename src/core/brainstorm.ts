export function synthesizeBrainstormNotes(goal: string): string {
  const clipped = goal.trim().replace(/\s+/g, " ");
  return [
    `Nghiệp vụ: ${clipped}`,
    "Phạm vi: thay đổi nhỏ, kèm test. Không đụng CI/CD trừ khi goal yêu cầu.",
    "Ràng buộc: planner chat nghĩ / review; harness chỉ execute. Không OAuth, không Jira API.",
  ].join("\n");
}

export function buildBrainstormPastePrompt(goal: string, taskId: string): string {
  return `Bạn là planner chat-to-x (C2X). Đây là vòng hỏi nghiệp vụ — chưa viết PLAN.

TASK_ID: ${taskId}

MỤC TIÊU (nghiệp vụ):
${goal.trim()}

Hãy trả lời ngắn bằng tiếng Việt (hoặc ngôn ngữ của mục tiêu):
1. Ai dùng, làm gì, xong khi nào?
2. Phạm vi / không làm gì?
3. Ràng buộc (quota, CI, wiki)?

Không trả [C2X]. Không viết khối PLAN. Không PACKETS. Chỉ Q&A / ghi chú nghiệp vụ.`;
}

export function parseBrainstormReply(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 2000);
}

export function hasControlTag(text: string): boolean {
  return text.includes("[C2X]") || text.includes("[C2C]");
}
