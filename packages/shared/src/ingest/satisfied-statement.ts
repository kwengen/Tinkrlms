import { buildLmsAuthoredStatement, type LmsStatementInput } from "../xapi/lms-statement";
import { ADL_VERBS } from "../xapi/cmi5-constants";

export const SATISFIED_VERB_ID: string = ADL_VERBS.satisfied;

export type BuildSatisfiedStatementInput = Omit<LmsStatementInput, "verbId" | "verbDisplayEn">;

/**
 * `satisfied` is the LMS's to write, never the AU's (bestilling §5/§13):
 * emitted once moveOn's criteria are met, driving completion_state →
 * course_completion. Idempotency (don't double-write per registration/
 * activity) is enforced by the caller checking for an existing one first —
 * see ingest-statement.ts's satisfied handling.
 */
export function buildSatisfiedStatement(input: BuildSatisfiedStatementInput): Record<string, unknown> {
  return buildLmsAuthoredStatement({ ...input, verbId: SATISFIED_VERB_ID, verbDisplayEn: "satisfied" });
}
