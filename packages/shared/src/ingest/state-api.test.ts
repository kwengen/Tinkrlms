import { describe, expect, it } from "vitest";
import { parseStateDocumentJson, validateStateDocumentSize, validateStateRequest } from "./state-api";
import type { LaunchTokenClaims } from "../launch/token";

const TOKEN: LaunchTokenClaims = {
  registration: "reg-uuid",
  actor_account: "user-123",
  activity_id: "https://app/xapi/activity/abc",
  session_id: "session-uuid",
  org_id: "org-uuid",
  launch_mode: "Normal",
  scope: ["statements:write", "state:read", "state:write:suspendData"],
};

function ctx(overrides: Partial<Parameters<typeof validateStateRequest>[0]> = {}) {
  return {
    method: "GET" as const,
    stateId: "suspendData",
    activityId: TOKEN.activity_id,
    actorAccount: TOKEN.actor_account,
    registration: TOKEN.registration,
    ...overrides,
  };
}

describe("validateStateRequest — whitelist and scoping (bestilling §5)", () => {
  it("allows GET on suspendData with matching actor/activity/registration", () => {
    const result = validateStateRequest(ctx(), TOKEN, TOKEN.session_id);
    expect(result.ok).toBe(true);
  });

  it("allows PUT/DELETE on suspendData", () => {
    expect(validateStateRequest(ctx({ method: "PUT" }), TOKEN, TOKEN.session_id).ok).toBe(true);
    expect(validateStateRequest(ctx({ method: "DELETE" }), TOKEN, TOKEN.session_id).ok).toBe(true);
  });

  it("allows GET on LMS.LaunchData", () => {
    const result = validateStateRequest(ctx({ stateId: "LMS.LaunchData" }), TOKEN, TOKEN.session_id);
    expect(result.ok).toBe(true);
  });

  it("rejects PUT on LMS.LaunchData — the AU token may never write it", () => {
    const result = validateStateRequest(
      ctx({ stateId: "LMS.LaunchData", method: "PUT" }),
      TOKEN,
      TOKEN.session_id,
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("rejects DELETE on LMS.LaunchData", () => {
    const result = validateStateRequest(
      ctx({ stateId: "LMS.LaunchData", method: "DELETE" }),
      TOKEN,
      TOKEN.session_id,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects any non-whitelisted stateId", () => {
    const result = validateStateRequest(ctx({ stateId: "some.other.state" }), TOKEN, TOKEN.session_id);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("rejects a mismatched activityId/actor/registration", () => {
    expect(validateStateRequest(ctx({ activityId: "other" }), TOKEN, TOKEN.session_id).ok).toBe(false);
    expect(validateStateRequest(ctx({ actorAccount: "other" }), TOKEN, TOKEN.session_id).ok).toBe(false);
    expect(validateStateRequest(ctx({ registration: "other" }), TOKEN, TOKEN.session_id).ok).toBe(false);
  });

  it("rejects a superseded session even for a whitelisted, matching request", () => {
    const result = validateStateRequest(ctx(), TOKEN, "some-other-current-session-id");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/superseded/i);
  });
});

describe("state document size/JSON guards (bestilling §5)", () => {
  it("accepts a small document", () => {
    expect(validateStateDocumentSize(JSON.stringify({ a: 1 })).ok).toBe(true);
  });

  it("rejects a document over 64KB", () => {
    const big = JSON.stringify({ blob: "x".repeat(70 * 1024) });
    const result = validateStateDocumentSize(big);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it("parses valid JSON", () => {
    const result = parseStateDocumentJson('{"a":1}');
    expect(result.ok).toBe(true);
  });

  it("rejects invalid JSON", () => {
    const result = parseStateDocumentJson("{not json");
    expect(result.ok).toBe(false);
  });
});
