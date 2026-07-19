import type { LaunchModeType, MoveOnType } from "../types/database";
import { CMI5_CATEGORY_ACTIVITY_ID, CMI5_SESSION_ID_EXTENSION } from "../xapi/cmi5-constants";

// Re-exported for backward compatibility — callers that imported these two
// constants from this module (rather than xapi/cmi5-constants directly)
// keep working.
export { CMI5_CATEGORY_ACTIVITY_ID, CMI5_SESSION_ID_EXTENSION };

export interface BuildLaunchDataInput {
  launchMode: LaunchModeType;
  moveOn: MoveOnType;
  masteryScore: number | null;
  registration: string; // registration_uuid
  /** assignable_units.publisher_id — au@id, NOT the runtime activity_id (bestilling §5). */
  publisherGroupingId: string;
  sessionId: string;
}

/**
 * The `LMS.LaunchData` document the LMS MUST write before launch (cmi5
 * requirement, bestilling §5). `contextTemplate` is written COMPLETE, never
 * with empty grouping/category — the cmi5 category activity is what makes
 * Studio's statements "cmi5 defined", and grouping preserves the publisher
 * identity link without leaking it into `object.id`.
 */
export function buildLaunchData(input: BuildLaunchDataInput): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    launchMode: input.launchMode,
    moveOn: input.moveOn,
    contextTemplate: {
      registration: input.registration,
      contextActivities: {
        category: [{ id: CMI5_CATEGORY_ACTIVITY_ID }],
        grouping: [{ id: input.publisherGroupingId }],
      },
      extensions: {
        [CMI5_SESSION_ID_EXTENSION]: input.sessionId,
      },
    },
  };
  if (input.masteryScore !== null) {
    doc.masteryScore = input.masteryScore;
  }
  return doc;
}
