import { ADL_VERBS } from "../xapi/cmi5-constants";
import type { MoveOnType } from "../types/database";

export interface CompletionFields {
  completion: string | null; // xAPI completion: 'true' | 'false' | null
  success: string | null; // xAPI success: 'true' | 'false' | null
  score: number | null;
}

/**
 * Folds one incoming completed/passed/failed statement into the AU's
 * completion_state fields. Pure — no DB access. `completion` and `success`
 * are kept as SEPARATE fields per bestilling §4 (never merge them).
 */
export function applyStatementToCompletionFields(
  current: CompletionFields,
  verbId: string,
  statement: Record<string, unknown>,
): CompletionFields {
  const result = (statement.result ?? {}) as Record<string, unknown>;
  const score = (result.score as Record<string, unknown> | undefined)?.scaled;
  const scaledScore = typeof score === "number" ? score : current.score;

  if (verbId === ADL_VERBS.completed) {
    return { ...current, completion: "true" };
  }
  if (verbId === ADL_VERBS.passed) {
    return { ...current, success: "true", score: scaledScore };
  }
  if (verbId === ADL_VERBS.failed) {
    return { ...current, success: "false", score: scaledScore };
  }
  return current;
}

/**
 * cmi5 moveOn semantics (bestilling §4/§5). `NotApplicable` means this AU
 * never gates course-level rollup at all (cmi5 spec: it has no bearing on
 * moveOn criteria) — satisfied is trivially true and, correspondingly, this
 * AU is excluded from the course_completion AND check (see
 * recompute_course_completion) rather than actually being required.
 */
export function deriveSatisfied(moveOn: MoveOnType, fields: CompletionFields): boolean {
  switch (moveOn) {
    case "Passed":
      return fields.success === "true";
    case "Completed":
      return fields.completion === "true";
    case "CompletedOrPassed":
      return fields.completion === "true" || fields.success === "true";
    case "CompletedAndPassed":
      return fields.completion === "true" && fields.success === "true";
    case "NotApplicable":
      return true;
  }
}
