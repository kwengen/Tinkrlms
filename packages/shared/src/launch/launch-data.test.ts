import { describe, expect, it } from "vitest";
import { buildLaunchData } from "./launch-data";

describe("buildLaunchData", () => {
  it("writes a complete contextTemplate with the cmi5 category and grouping (bestilling §5)", () => {
    const doc = buildLaunchData({
      launchMode: "Normal",
      moveOn: "CompletedAndPassed",
      masteryScore: 0.8,
      registration: "reg-uuid",
      publisherGroupingId: "https://pub/au/0",
      sessionId: "session-uuid",
    });

    expect(doc.launchMode).toBe("Normal");
    expect(doc.moveOn).toBe("CompletedAndPassed");
    expect(doc.masteryScore).toBe(0.8);
    const ctx = doc.contextTemplate as Record<string, unknown>;
    expect(ctx.registration).toBe("reg-uuid");
    const activities = ctx.contextActivities as Record<string, unknown>;
    expect((activities.category as Array<{ id: string }>)[0]!.id).toBe(
      "https://w3id.org/xapi/cmi5/context/categories/cmi5",
    );
    expect((activities.grouping as Array<{ id: string }>)[0]!.id).toBe("https://pub/au/0");
    const extensions = ctx.extensions as Record<string, string>;
    expect(extensions["https://w3id.org/xapi/cmi5/context/extensions/sessionid"]).toBe("session-uuid");
  });

  it("omits masteryScore entirely when null (bestilling §4: utelates når move_on=NotApplicable)", () => {
    const doc = buildLaunchData({
      launchMode: "Normal",
      moveOn: "NotApplicable",
      masteryScore: null,
      registration: "reg-uuid",
      publisherGroupingId: "https://pub/au/0",
      sessionId: "session-uuid",
    });
    expect("masteryScore" in doc).toBe(false);
  });
});
