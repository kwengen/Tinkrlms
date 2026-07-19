import { CMI5_CATEGORY_ACTIVITY_ID, CMI5_SESSION_ID_EXTENSION } from "./launch-data";

export const LAUNCHED_VERB_ID = "http://adlnet.gov/expapi/verbs/launched";

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
  return {
    id: input.statementId,
    actor: {
      objectType: "Agent",
      account: { homePage: input.actorHomePage, name: input.actorAccountName },
    },
    verb: { id: LAUNCHED_VERB_ID, display: { "en-US": "launched" } },
    object: { objectType: "Activity", id: input.activityId },
    context: {
      registration: input.registration,
      contextActivities: {
        category: [{ id: CMI5_CATEGORY_ACTIVITY_ID }],
        grouping: [{ id: input.publisherGroupingId }],
      },
      extensions: {
        [CMI5_SESSION_ID_EXTENSION]: input.sessionId,
      },
    },
    timestamp: input.timestamp,
  };
}
