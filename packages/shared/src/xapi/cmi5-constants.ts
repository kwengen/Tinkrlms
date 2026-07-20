export const CMI5_CATEGORY_ACTIVITY_ID = "https://w3id.org/xapi/cmi5/context/categories/cmi5";
export const CMI5_SESSION_ID_EXTENSION = "https://w3id.org/xapi/cmi5/context/extensions/sessionid";
export const CMI5_MASTERYSCORE_EXTENSION = "https://w3id.org/xapi/cmi5/context/extensions/masteryscore";

export const ADL_VERBS = {
  launched: "http://adlnet.gov/expapi/verbs/launched",
  initialized: "http://adlnet.gov/expapi/verbs/initialized",
  answered: "http://adlnet.gov/expapi/verbs/answered",
  passed: "http://adlnet.gov/expapi/verbs/passed",
  failed: "http://adlnet.gov/expapi/verbs/failed",
  completed: "http://adlnet.gov/expapi/verbs/completed",
  terminated: "http://adlnet.gov/expapi/verbs/terminated",
  satisfied: "http://adlnet.gov/expapi/verbs/satisfied",
  voided: "http://adlnet.gov/expapi/verbs/voided",
} as const;

/** cmi5-defined terminal verbs the AU itself emits (bestilling §5 object.id validation). */
export const CMI5_TERMINAL_VERB_IDS: readonly string[] = [
  ADL_VERBS.initialized,
  ADL_VERBS.completed,
  ADL_VERBS.passed,
  ADL_VERBS.failed,
  ADL_VERBS.terminated,
];
