import { CMI5_CATEGORY_ACTIVITY_ID, CMI5_SESSION_ID_EXTENSION } from "./cmi5-constants";

export interface LmsStatementInput {
  statementId: string;
  verbId: string;
  verbDisplayEn: string;
  actorHomePage: string;
  actorAccountName: string;
  activityId: string;
  registration: string;
  publisherGroupingId: string;
  sessionId: string;
  timestamp: string;
}

/**
 * Shape shared by every xAPI statement the LMS itself authors (`launched`,
 * `satisfied`) — same actor/context pattern the AU's own statements use, so
 * they're indistinguishable as "cmi5 defined" in the LRS.
 */
export function buildLmsAuthoredStatement(input: LmsStatementInput): Record<string, unknown> {
  return {
    id: input.statementId,
    actor: {
      objectType: "Agent",
      account: { homePage: input.actorHomePage, name: input.actorAccountName },
    },
    verb: { id: input.verbId, display: { "en-US": input.verbDisplayEn } },
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
