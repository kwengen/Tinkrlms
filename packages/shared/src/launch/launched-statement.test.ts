import { describe, expect, it } from "vitest";
import { buildLaunchedStatement, LAUNCHED_VERB_ID } from "./launched-statement";
import { statementHash } from "../xapi/statement-hash";

describe("buildLaunchedStatement", () => {
  const base = {
    statementId: "stmt-1",
    actorHomePage: "https://app.tinkrakademiet.no",
    actorAccountName: "user-123",
    activityId: "https://app.tinkrakademiet.no/xapi/activity/abc",
    registration: "reg-uuid",
    publisherGroupingId: "https://pub/au/0",
    sessionId: "session-uuid",
    timestamp: "2026-01-01T00:00:00.000Z",
  };

  it("uses the account IFI (not mbox/email) per bestilling §4", () => {
    const stmt = buildLaunchedStatement(base) as any;
    expect(stmt.actor.account).toEqual({
      homePage: "https://app.tinkrakademiet.no",
      name: "user-123",
    });
    expect(stmt.actor.mbox).toBeUndefined();
  });

  it("uses the ADL launched verb and Activity object with the runtime activityId", () => {
    const stmt = buildLaunchedStatement(base) as any;
    expect(stmt.verb.id).toBe(LAUNCHED_VERB_ID);
    expect(stmt.verb.id).toBe("http://adlnet.gov/expapi/verbs/launched");
    expect(stmt.object).toEqual({ objectType: "Activity", id: base.activityId });
  });

  it("is hashable and deterministic (feeds the same idempotency hash used at ingest)", () => {
    const stmt = buildLaunchedStatement(base);
    expect(statementHash(stmt)).toBe(statementHash(stmt));
  });
});
