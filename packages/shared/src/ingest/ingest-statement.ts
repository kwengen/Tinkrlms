import { z } from "zod";
import { ADL_VERBS } from "../xapi/cmi5-constants";
import { statementHash } from "../xapi/statement-hash";
import { isValidObjectId } from "./object-id";
import { applyStatementToCompletionFields, deriveSatisfied, type CompletionFields } from "./completion";
import { buildSatisfiedStatement } from "./satisfied-statement";
import type { LaunchTokenClaims } from "../launch/token";
import type { LaunchModeType, MoveOnType } from "../types/database";

const statementSchema = z
  .object({
    id: z.string().uuid(),
    actor: z.object({ account: z.object({ name: z.string() }).passthrough() }).passthrough(),
    verb: z.object({ id: z.string() }).passthrough(),
    object: z.object({ id: z.string() }).passthrough(),
    context: z.object({ registration: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

export interface RegistrationContext {
  enrollmentId: string;
  orgId: string;
  currentSessionId: string | null;
  launchMode: LaunchModeType;
  moveOn: MoveOnType;
  masteryScore: number | null;
  /** au@id — for the satisfied statement's contextTemplate.grouping. */
  publisherId: string;
}

export interface StoredStatementRow {
  statement_id: string;
  registration: string;
  org_id: string;
  actor_account: string;
  verb_id: string;
  activity_id: string;
  statement: Record<string, unknown>;
  statement_hash: string;
}

/**
 * Side-effecting DB operations, injected so the whole validate → idempotency
 * → persist → derive-completion pipeline is unit-testable without a live
 * Supabase project (none reachable from this environment).
 */
export interface IngestPorts {
  getRegistrationContext(registrationUuid: string): Promise<RegistrationContext | null>;
  /** Returns the stored hash for this statement_id, or null if not seen before. */
  findStatementHash(statementId: string): Promise<string | null>;
  insertStatement(row: StoredStatementRow): Promise<void>;
  getCompletionFields(registrationUuid: string): Promise<CompletionFields | null>;
  upsertCompletionState(registrationUuid: string, fields: CompletionFields, satisfied: boolean): Promise<void>;
  hasSatisfiedStatement(registrationUuid: string, activityId: string): Promise<boolean>;
  insertSatisfiedStatement(row: StoredStatementRow): Promise<void>;
  recomputeCourseCompletion(enrollmentId: string): Promise<void>;
}

export interface IngestConfig {
  appOrigin: string;
  generateId?: () => string;
  now?: () => Date;
}

export type IngestElementStatus = "stored" | "discarded_duplicate" | "conflict" | "forbidden" | "invalid";

export interface IngestElementResult {
  status: IngestElementStatus;
  message?: string;
}

export async function ingestOneStatement(
  rawStatement: unknown,
  token: LaunchTokenClaims,
  ports: IngestPorts,
  config: IngestConfig,
): Promise<IngestElementResult> {
  const parsed = statementSchema.safeParse(rawStatement);
  if (!parsed.success) {
    return { status: "invalid", message: "Malformed xAPI statement" };
  }
  const statement = rawStatement as Record<string, unknown>;
  const actor = statement.actor as Record<string, unknown>;
  const account = actor.account as Record<string, unknown>;
  const verb = statement.verb as Record<string, unknown>;
  const object = statement.object as Record<string, unknown>;
  const context = (statement.context ?? {}) as Record<string, unknown>;

  const actorAccount = account.name as string;
  const verbId = verb.id as string;
  const objectId = object.id as string;
  const registration = context.registration as string | undefined;

  // 2. bestilling §5: enforce actor/registration match BEFORE any write.
  if (actorAccount !== token.actor_account) {
    return { status: "forbidden", message: "statement.actor does not match token" };
  }
  if (registration !== token.registration) {
    return { status: "forbidden", message: "statement.context.registration does not match token" };
  }

  const regCtx = await ports.getRegistrationContext(token.registration);
  if (!regCtx) {
    return { status: "forbidden", message: "Unknown registration" };
  }

  // 2b. supersede check: only the CURRENT session may write.
  if (regCtx.currentSessionId !== token.session_id) {
    return { status: "forbidden", message: "Session has been superseded" };
  }

  // Void-statements from an AU token are forbidden — only the LMS voids
  // (bestilling §5 scoped-token privileges).
  if (verbId === ADL_VERBS.voided) {
    return { status: "forbidden", message: "AU token may not write void statements" };
  }

  // 3. differentiated object.id validation.
  if (!isValidObjectId(verbId, objectId, token.activity_id)) {
    return { status: "forbidden", message: "object.id does not match token activityId" };
  }

  // 5. idempotency via canonical hash (bestilling §5 — a correctness
  // requirement, not an optimization: Studio's at-least-once retry relies on
  // a verbatim resend being silently discarded here).
  const statementId = statement.id as string;
  const hash = statementHash(statement);
  const existingHash = await ports.findStatementHash(statementId);
  if (existingHash !== null) {
    return existingHash === hash
      ? { status: "discarded_duplicate" }
      : { status: "conflict", message: "Same statement id, different content" };
  }

  // 4. write via service role (bypasses RLS by design).
  await ports.insertStatement({
    statement_id: statementId,
    registration: token.registration,
    org_id: regCtx.orgId,
    actor_account: actorAccount,
    verb_id: verbId,
    activity_id: objectId,
    statement,
    statement_hash: hash,
  });

  // 6. derive completion — Normal launch_mode ONLY (Browse/Review never
  // satisfy, bestilling §5).
  const isCompletionVerb =
    verbId === ADL_VERBS.completed || verbId === ADL_VERBS.passed || verbId === ADL_VERBS.failed;
  if (regCtx.launchMode === "Normal" && isCompletionVerb) {
    const current = (await ports.getCompletionFields(token.registration)) ?? {
      completion: null,
      success: null,
      score: null,
    };
    const updated = applyStatementToCompletionFields(current, verbId, statement);
    const satisfied = deriveSatisfied(regCtx.moveOn, updated);
    await ports.upsertCompletionState(token.registration, updated, satisfied);

    if (satisfied) {
      const already = await ports.hasSatisfiedStatement(token.registration, token.activity_id);
      if (!already) {
        const now = config.now?.() ?? new Date();
        const generateId = config.generateId ?? (() => crypto.randomUUID());
        const satisfiedStatement = buildSatisfiedStatement({
          statementId: generateId(),
          actorHomePage: config.appOrigin,
          actorAccountName: token.actor_account,
          activityId: token.activity_id,
          registration: token.registration,
          publisherGroupingId: regCtx.publisherId,
          sessionId: token.session_id,
          timestamp: now.toISOString(),
        });
        await ports.insertSatisfiedStatement({
          statement_id: satisfiedStatement.id as string,
          registration: token.registration,
          org_id: regCtx.orgId,
          actor_account: token.actor_account,
          verb_id: (satisfiedStatement.verb as { id: string }).id,
          activity_id: token.activity_id,
          statement: satisfiedStatement,
          statement_hash: statementHash(satisfiedStatement),
        });
      }
      await ports.recomputeCourseCompletion(regCtx.enrollmentId);
    }
  }

  return { status: "stored" };
}

export function ingestStatusToHttpStatus(status: IngestElementStatus): number {
  switch (status) {
    case "stored":
    case "discarded_duplicate":
      return 200;
    case "conflict":
      return 409;
    case "forbidden":
      return 403;
    case "invalid":
      return 400;
  }
}
