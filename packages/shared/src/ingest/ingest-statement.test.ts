import { describe, expect, it } from "vitest";
import {
  ingestOneStatement,
  type IngestPorts,
  type RegistrationContext,
  type StoredStatementRow,
} from "./ingest-statement";
import { ingestStatements } from "./ingest-statements";
import type { LaunchTokenClaims } from "../launch/token";
import { ADL_VERBS } from "../xapi/cmi5-constants";

const TOKEN: LaunchTokenClaims = {
  registration: "99999999-9999-9999-9999-999999999999",
  actor_account: "user-123",
  activity_id: "https://app.tinkrakademiet.no/xapi/activity/abc",
  session_id: "88888888-8888-8888-8888-888888888888",
  org_id: "11111111-1111-1111-1111-111111111111",
  launch_mode: "Normal",
  scope: ["statements:write", "state:read", "state:write:suspendData"],
};

function baseRegCtx(overrides: Partial<RegistrationContext> = {}): RegistrationContext {
  return {
    enrollmentId: "enrollment-1",
    orgId: TOKEN.org_id,
    currentSessionId: TOKEN.session_id,
    launchMode: "Normal",
    moveOn: "CompletedAndPassed",
    masteryScore: 0.8,
    publisherId: "https://pub/au/0",
    ...overrides,
  };
}

function fakePorts(regCtx: RegistrationContext) {
  const statements: StoredStatementRow[] = [];
  const satisfiedStatements: StoredStatementRow[] = [];
  let completionFields: { completion: string | null; success: string | null; score: number | null } | null = null;
  let satisfied = false;
  let recomputeCalls = 0;

  const ports: IngestPorts = {
    async getRegistrationContext() {
      return regCtx;
    },
    async findStatementHash(statementId) {
      const found = [...statements, ...satisfiedStatements].find((s) => s.statement_id === statementId);
      return found ? found.statement_hash : null;
    },
    async insertStatement(row) {
      statements.push(row);
    },
    async getCompletionFields() {
      return completionFields;
    },
    async upsertCompletionState(_registration, fields, sat) {
      completionFields = fields;
      satisfied = sat;
    },
    async hasSatisfiedStatement() {
      return satisfiedStatements.length > 0;
    },
    async insertSatisfiedStatement(row) {
      satisfiedStatements.push(row);
    },
    async recomputeCourseCompletion() {
      recomputeCalls++;
    },
  };

  return {
    ports,
    statements,
    satisfiedStatements,
    getCompletionFields: () => completionFields,
    isSatisfied: () => satisfied,
    getRecomputeCalls: () => recomputeCalls,
  };
}

function stmt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    actor: { objectType: "Agent", account: { homePage: "https://app.tinkrakademiet.no", name: TOKEN.actor_account } },
    verb: { id: ADL_VERBS.initialized, display: { "en-US": "initialized" } },
    object: { objectType: "Activity", id: TOKEN.activity_id },
    context: { registration: TOKEN.registration },
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const CONFIG = { appOrigin: "https://app.tinkrakademiet.no" };

describe("ingestOneStatement — core validation (bestilling §5)", () => {
  it("stores a valid statement", async () => {
    const { ports, statements } = fakePorts(baseRegCtx());
    const result = await ingestOneStatement(stmt(), TOKEN, ports, CONFIG);
    expect(result.status).toBe("stored");
    expect(statements).toHaveLength(1);
    expect(statements[0]!.activity_id).toBe(TOKEN.activity_id);
  });

  it("rejects actor mismatch (403)", async () => {
    const { ports } = fakePorts(baseRegCtx());
    const result = await ingestOneStatement(
      stmt({ actor: { objectType: "Agent", account: { homePage: "x", name: "someone-else" } } }),
      TOKEN,
      ports,
      CONFIG,
    );
    expect(result.status).toBe("forbidden");
  });

  it("rejects registration mismatch (403)", async () => {
    const { ports } = fakePorts(baseRegCtx());
    const result = await ingestOneStatement(
      stmt({ context: { registration: "00000000-0000-0000-0000-000000000000" } }),
      TOKEN,
      ports,
      CONFIG,
    );
    expect(result.status).toBe("forbidden");
  });

  it("rejects a superseded session for ANY verb (two-tabs scenario, bestilling §4/§16)", async () => {
    const { ports } = fakePorts(baseRegCtx({ currentSessionId: "some-other-session-id" }));
    const result = await ingestOneStatement(stmt(), TOKEN, ports, CONFIG);
    expect(result.status).toBe("forbidden");
    expect(result.message).toMatch(/superseded/i);
  });

  it("rejects a terminal verb whose object.id != token.activityId (403)", async () => {
    const { ports } = fakePorts(baseRegCtx());
    const result = await ingestOneStatement(
      stmt({ verb: { id: ADL_VERBS.completed }, object: { id: "https://app/xapi/activity/some-other-au" } }),
      TOKEN,
      ports,
      CONFIG,
    );
    expect(result.status).toBe("forbidden");
  });

  it("accepts `answered` targeting a sub-activity interaction id (bestilling §5/§10.8)", async () => {
    const { ports } = fakePorts(baseRegCtx());
    const result = await ingestOneStatement(
      stmt({
        id: "22222222-2222-2222-2222-222222222222",
        verb: { id: ADL_VERBS.answered },
        object: { id: `${TOKEN.activity_id}/interactions/q1` },
      }),
      TOKEN,
      ports,
      CONFIG,
    );
    expect(result.status).toBe("stored");
  });

  it("rejects void statements from an AU token (only the LMS voids)", async () => {
    const { ports } = fakePorts(baseRegCtx());
    const result = await ingestOneStatement(stmt({ verb: { id: ADL_VERBS.voided } }), TOKEN, ports, CONFIG);
    expect(result.status).toBe("forbidden");
  });

  it("rejects a malformed statement (400/invalid)", async () => {
    const { ports } = fakePorts(baseRegCtx());
    const result = await ingestOneStatement({ id: "not-even-close" }, TOKEN, ports, CONFIG);
    expect(result.status).toBe("invalid");
  });
});

describe("ingestOneStatement — idempotency (bestilling §5, KORREKTHETSKRAV)", () => {
  it("discards a verbatim resend of an already-stored statement", async () => {
    const { ports, statements } = fakePorts(baseRegCtx());
    const s = stmt();
    await ingestOneStatement(s, TOKEN, ports, CONFIG);
    const second = await ingestOneStatement(s, TOKEN, ports, CONFIG);
    expect(second.status).toBe("discarded_duplicate");
    expect(statements).toHaveLength(1); // not double-inserted
  });

  it("409s on same id with different content", async () => {
    const { ports } = fakePorts(baseRegCtx());
    await ingestOneStatement(stmt(), TOKEN, ports, CONFIG);
    const conflicting = await ingestOneStatement(
      stmt({ timestamp: "2026-06-01T00:00:00.000Z" }), // same id, different content
      TOKEN,
      ports,
      CONFIG,
    );
    expect(conflicting.status).toBe("conflict");
  });

  it("excludes stored/authority from the hash so a re-fetched statement (LRS fields added) still matches", async () => {
    const { ports } = fakePorts(baseRegCtx());
    const original = stmt();
    await ingestOneStatement(original, TOKEN, ports, CONFIG);
    const withLrsFields = { ...original, stored: "2026-01-01T00:00:01.000Z", authority: { foo: "bar" } };
    const result = await ingestOneStatement(withLrsFields, TOKEN, ports, CONFIG);
    expect(result.status).toBe("discarded_duplicate");
  });
});

describe("ingestOneStatement — completion derivation & satisfied roll-up (bestilling §4/§5/§13)", () => {
  it("derives satisfied only once BOTH completed and passed arrive for CompletedAndPassed", async () => {
    const state = fakePorts(baseRegCtx({ moveOn: "CompletedAndPassed" }));

    const passed = await ingestOneStatement(
      stmt({ id: "aaaaaaaa-0000-0000-0000-000000000001", verb: { id: ADL_VERBS.passed }, result: { score: { scaled: 0.9 } } }),
      TOKEN,
      state.ports,
      CONFIG,
    );
    expect(passed.status).toBe("stored");
    expect(state.isSatisfied()).toBe(false); // completed hasn't arrived yet
    expect(state.satisfiedStatements).toHaveLength(0);

    const completed = await ingestOneStatement(
      stmt({ id: "aaaaaaaa-0000-0000-0000-000000000002", verb: { id: ADL_VERBS.completed } }),
      TOKEN,
      state.ports,
      CONFIG,
    );
    expect(completed.status).toBe("stored");
    expect(state.isSatisfied()).toBe(true);
    expect(state.satisfiedStatements).toHaveLength(1);
    expect(state.getRecomputeCalls()).toBe(1);
  });

  it("does not write a second satisfied statement once already satisfied", async () => {
    const state = fakePorts(baseRegCtx({ moveOn: "Passed" }));
    await ingestOneStatement(
      stmt({ id: "bbbbbbbb-0000-0000-0000-000000000001", verb: { id: ADL_VERBS.passed }, result: { score: { scaled: 1 } } }),
      TOKEN,
      state.ports,
      CONFIG,
    );
    expect(state.satisfiedStatements).toHaveLength(1);

    // A second passed statement (e.g. resend on a different id) shouldn't add a second satisfied statement.
    await ingestOneStatement(
      stmt({ id: "bbbbbbbb-0000-0000-0000-000000000002", verb: { id: ADL_VERBS.passed }, result: { score: { scaled: 1 } } }),
      TOKEN,
      state.ports,
      CONFIG,
    );
    expect(state.satisfiedStatements).toHaveLength(1);
  });

  it("Browse launch_mode never derives completion or satisfied (bestilling §5/§10.9)", async () => {
    const state = fakePorts(baseRegCtx({ launchMode: "Browse", moveOn: "Completed" }));
    const browseToken: LaunchTokenClaims = { ...TOKEN, launch_mode: "Browse" };
    const result = await ingestOneStatement(
      stmt({ verb: { id: ADL_VERBS.completed } }),
      browseToken,
      state.ports,
      CONFIG,
    );
    expect(result.status).toBe("stored"); // the statement itself is still stored...
    expect(state.getCompletionFields()).toBeNull(); // ...but completion_state is never touched
    expect(state.isSatisfied()).toBe(false);
    expect(state.satisfiedStatements).toHaveLength(0);
    expect(state.getRecomputeCalls()).toBe(0);
  });

  it("does not derive completion from `answered` under any circumstances", async () => {
    const state = fakePorts(baseRegCtx({ moveOn: "Completed" }));
    await ingestOneStatement(
      stmt({ verb: { id: ADL_VERBS.answered }, object: { id: `${TOKEN.activity_id}/interactions/q1` } }),
      TOKEN,
      state.ports,
      CONFIG,
    );
    expect(state.getCompletionFields()).toBeNull();
  });
});

describe("ingestStatements — array/batch processing (bestilling §5/§10.7)", () => {
  it("processes a whole array of statements successfully", async () => {
    const { ports, statements } = fakePorts(baseRegCtx());
    const batch = [
      stmt({ id: "cccccccc-0000-0000-0000-000000000001", verb: { id: ADL_VERBS.initialized } }),
      stmt({
        id: "cccccccc-0000-0000-0000-000000000002",
        verb: { id: ADL_VERBS.answered },
        object: { id: `${TOKEN.activity_id}/interactions/q1` },
      }),
    ];
    const result = await ingestStatements(batch, TOKEN, ports, CONFIG);
    expect(result.status).toBe(200);
    expect(statements).toHaveLength(2);
  });

  it("fails the whole batch on the first forbidden element (403)", async () => {
    const { ports } = fakePorts(baseRegCtx());
    const batch = [
      stmt({ id: "dddddddd-0000-0000-0000-000000000001" }),
      stmt({ id: "dddddddd-0000-0000-0000-000000000002", actor: { account: { name: "attacker" } } }),
    ];
    const result = await ingestStatements(batch, TOKEN, ports, CONFIG);
    expect(result.status).toBe(403);
  });
});
