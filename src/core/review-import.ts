import { planToBriefs } from "@/core/brief";
import { extractControlBlock, parsePlannerOutput } from "@/core/planner";
import { messageToReview, parseControlMessage } from "@/core/protocol";
import { estimateSavings } from "@/core/savings";
import { applyPlan, reusedPack, touchSession } from "@/core/session";
import type { SessionRecord } from "@/core/types";

export function applyImportedReview(session: SessionRecord, raw: string): SessionRecord {
  if (session.state !== "EXECUTED" && session.state !== "REVIEW") {
    throw new Error("Review import needs EXECUTED or REVIEW.");
  }
  const message = parseControlMessage(extractControlBlock(raw));
  if (message.state === "DONE" || message.state === "BLOCKED") {
    const review = messageToReview(message);
    return touchSession({ ...session, review }, {
      state: review.state,
      actor: "user",
      note: review.summary || `Imported ${review.state} from a web chat.`,
    });
  }
  if (message.state === "PLAN") {
    const pack = reusedPack(session);
    const fallback = session.plan;
    if (!fallback) {
      throw new Error("Review PLAN import needs an existing PLAN.");
    }
    const plan = parsePlannerOutput(raw, fallback);
    const briefs = planToBriefs(plan);
    return applyPlan(
      touchSession(session, {
        state: "PLAN",
        actor: "user",
        note: "Imported next-iteration [C2X] PLAN from a web chat.",
      }),
      {
        plan,
        briefs,
        brief: briefs[0] ?? null,
        review: null,
        savings: estimateSavings({
          pack,
          brief: briefs[0] ?? null,
          briefs,
          planner: session.planner,
        }),
      },
    );
  }
  throw new Error(`Review import must be DONE, PLAN, or BLOCKED (got ${message.state}).`);
}
