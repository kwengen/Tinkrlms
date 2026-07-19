import { describe, expect, it } from "vitest";
import { extractBearerToken, signLaunchToken, verifyLaunchToken } from "./token";

const SECRET = "test-secret-at-least-32-bytes-long!!";
const BASE_INPUT = {
  registration: "99999999-9999-9999-9999-999999999999",
  actorAccount: "user-123",
  activityId: "https://app.tinkrakademiet.no/xapi/activity/abc",
  sessionId: "88888888-8888-8888-8888-888888888888",
  orgId: "11111111-1111-1111-1111-111111111111",
  launchMode: "Normal" as const,
};

describe("launch token sign/verify", () => {
  it("round-trips valid claims", async () => {
    const token = await signLaunchToken(BASE_INPUT, SECRET, 3600);
    const result = await verifyLaunchToken(token, SECRET);
    expect(result.ok).toBe(true);
    expect(result.claims).toMatchObject({
      registration: BASE_INPUT.registration,
      actor_account: BASE_INPUT.actorAccount,
      activity_id: BASE_INPUT.activityId,
      session_id: BASE_INPUT.sessionId,
      org_id: BASE_INPUT.orgId,
      launch_mode: "Normal",
    });
    expect(result.claims!.scope).toEqual(["statements:write", "state:read", "state:write:suspendData"]);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signLaunchToken(BASE_INPUT, SECRET, 3600);
    const result = await verifyLaunchToken(token, "a-completely-different-secret-value");
    expect(result.ok).toBe(false);
  });

  it("rejects an expired token", async () => {
    const token = await signLaunchToken(BASE_INPUT, SECRET, -10); // already expired
    const result = await verifyLaunchToken(token, SECRET);
    expect(result.ok).toBe(false);
  });

  it("rejects a tampered token", async () => {
    const token = await signLaunchToken(BASE_INPUT, SECRET, 3600);
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "b" : "a");
    const result = await verifyLaunchToken(tampered, SECRET);
    expect(result.ok).toBe(false);
  });
});

describe("extractBearerToken", () => {
  it("extracts the JWT from a Bearer header", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });
  it("returns null for a bare token (no scheme)", () => {
    expect(extractBearerToken("abc.def.ghi")).toBeNull();
  });
  it("returns null for null input", () => {
    expect(extractBearerToken(null)).toBeNull();
  });
});
