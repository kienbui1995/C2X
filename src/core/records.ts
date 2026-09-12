import { completeHarnessRun } from "@/core/session";
import type { ExecutionRecord, SessionRecord } from "@/core/types";

export function applyExecutionRecord(
  session: SessionRecord,
  record: ExecutionRecord,
): SessionRecord {
  const next = completeHarnessRun(session, record.owner, {
    changedFiles: record.changedFiles,
    tests: record.tests,
  });
  const records = [
    ...session.records.filter(
      (item) => !(item.owner === record.owner && item.iteration === record.iteration),
    ),
    record,
  ];
  return { ...next, records };
}
