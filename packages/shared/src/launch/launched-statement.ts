import { buildLmsAuthoredStatement } from "../xapi/lms-statement";
import { ADL_VERBS } from "../xapi/cmi5-constants";

export const LAUNCHED_VERB_ID: string = ADL_VERBS.launched;

export interface BuildLaunchedStatementInput {
  statementId: string; // LMS-generated (the LMS is the author of this statement, not the AU)
  actorHomePage: string; // APP_ORIGIN
  actorAccountName: string; // opaque internal user id (bestilling §4 — never email)
  activityId: string;
  registration: string;
  publisherGroupingId: string;
  sessionId: string;
  timestamp: string; // ISO-8601
}

/**
 * `launched` is sent by the LMS itself, before the AU's `initialized`
 * (bestilling §5 statement lifecycle). Carries the same cmi5 category +
 * grouping contextActivities as LMS.LaunchData's contextTemplate.
 */
export function buildLaunchedStatement(input: BuildLaunchedStatementInput): Record<string, unknown> {
  return buildLmsAuthoredStatement({ ...input, verbId: LAUNCHED_VERB_ID, verbDisplayEn: "launched" });
}
