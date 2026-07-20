import { ADL_VERBS, CMI5_TERMINAL_VERB_IDS } from "../xapi/cmi5-constants";

/**
 * Differentiated object.id validation (bestilling §5, point 3): cmi5-defined
 * terminal verbs must target exactly the launch activityId — this stops an
 * AU with a valid token from writing terminal statements against some other
 * activity. `answered` is allowed to target a sub-activity
 * (`{activityId}/interactions/{id}`) since Studio uses that for
 * interactions; don't reject those. Any other/unknown verb defaults to the
 * strict same-activity check.
 */
export function isValidObjectId(verbId: string, objectId: string, tokenActivityId: string): boolean {
  if (verbId === ADL_VERBS.answered) {
    return objectId === tokenActivityId || objectId.startsWith(`${tokenActivityId}/interactions/`);
  }
  return objectId === tokenActivityId;
}

export function isCmi5TerminalVerb(verbId: string): boolean {
  return CMI5_TERMINAL_VERB_IDS.includes(verbId);
}
