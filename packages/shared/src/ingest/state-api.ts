import type { LaunchTokenClaims } from "../launch/token";

export const STATE_ID_WHITELIST = ["LMS.LaunchData", "suspendData"] as const;
export type WhitelistedStateId = (typeof STATE_ID_WHITELIST)[number];

export const MAX_STATE_DOCUMENT_BYTES = 64 * 1024;

export interface StateRequestContext {
  method: "GET" | "PUT" | "DELETE";
  stateId: string;
  activityId: string;
  actorAccount: string;
  registration: string;
}

export interface StateValidationResult {
  ok: boolean;
  status?: 403 | 400;
  reason?: string;
}

/**
 * bestilling §5 "State API-policy (v1)": whitelist stateId (only
 * LMS.LaunchData — GET-only for the AU token — and suspendData, r/w only on
 * an exact actor+activity+registration match). The supersede check is our
 * own extension of the same principle §4 establishes for /statements — a
 * superseded (stale second-tab) session shouldn't be able to read/write
 * suspendData either, even though its token hasn't expired yet.
 */
export function validateStateRequest(
  ctx: StateRequestContext,
  token: LaunchTokenClaims,
  currentSessionId: string | null,
): StateValidationResult {
  if (
    ctx.activityId !== token.activity_id ||
    ctx.actorAccount !== token.actor_account ||
    ctx.registration !== token.registration
  ) {
    return { ok: false, status: 403, reason: "actor/activity/registration mismatch with token" };
  }
  if (currentSessionId !== token.session_id) {
    return { ok: false, status: 403, reason: "session has been superseded" };
  }
  if (!STATE_ID_WHITELIST.includes(ctx.stateId as WhitelistedStateId)) {
    return { ok: false, status: 403, reason: `stateId "${ctx.stateId}" is not whitelisted in v1` };
  }
  if (ctx.stateId === "LMS.LaunchData" && ctx.method !== "GET") {
    return { ok: false, status: 403, reason: "LMS.LaunchData is read-only for the AU (only the LMS writes it)" };
  }
  return { ok: true };
}

export function validateStateDocumentSize(raw: string): StateValidationResult {
  const size = Buffer.byteLength(raw, "utf-8");
  if (size > MAX_STATE_DOCUMENT_BYTES) {
    return { ok: false, status: 400, reason: `document is ${size} bytes, exceeds the ${MAX_STATE_DOCUMENT_BYTES}-byte limit` };
  }
  return { ok: true };
}

export function parseStateDocumentJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}
