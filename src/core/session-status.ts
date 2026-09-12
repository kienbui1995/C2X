import { nextExpectedStep } from "@/core/protocol";
import { assertNever, type ProtocolState, type SessionRecord } from "@/core/types";

export type SessionStatusView = {
  id: string;
  state: ProtocolState;
  planner: string;
  harnessTeam: string[];
  goal: string;
  iteration: number;
  nextEn: string;
  nextVi: string;
};

export function nextExpectedStepVi(state: ProtocolState): string {
  switch (state) {
    case "INIT":
      return "Đóng gói workspace và nhập [C2X] PLAN.";
    case "PLAN":
      return "Sao chép brief từng OWNER vào harness đó, rồi c2x record.";
    case "EXECUTING":
      return "Chạy nốt các làn harness còn lại, rồi c2x record.";
    case "EXECUTED":
      return "Chuẩn bị REVIEW (prompt dán hoặc mock) rồi nhập DONE|PLAN|BLOCKED.";
    case "REVIEW":
      return "Dán DONE, PLAN hoặc BLOCKED từ chat web.";
    case "DONE":
      return "Tuỳ chọn: phát HANDOFF rồi dừng.";
    case "BLOCKED":
      return "Xác nhận tiếp tục, hoặc nhập PLAN mới sau khi tăng iterationLimit.";
    case "ERROR":
      return "Xem sự kiện cuối, rồi khởi động lại từ INIT hoặc HANDOFF.";
    case "HANDOFF":
      return "Tiếp tục từ CURRENT_STATE trong chat mới.";
    default:
      return assertNever(state, `Unhandled protocol state: ${state}`);
  }
}

export function describeSessionStatus(session: SessionRecord): SessionStatusView {
  return {
    id: session.id,
    state: session.state,
    planner: session.planner,
    harnessTeam: [...session.harnessTeam],
    goal: session.goal,
    iteration: session.plan?.iteration ?? 0,
    nextEn: nextExpectedStep(session.state),
    nextVi: nextExpectedStepVi(session.state),
  };
}

export function formatSessionStatus(
  view: SessionStatusView,
  lang: "vi" | "en" = "vi",
): string {
  const next = lang === "en" ? view.nextEn : view.nextVi;
  return [
    `${view.id} ${view.state} ${view.planner}`,
    `team\t${view.harnessTeam.join(",")}`,
    `goal\t${view.goal}`,
    `next\t${next}`,
    "",
  ].join("\n");
}
