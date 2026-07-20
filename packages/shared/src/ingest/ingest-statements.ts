import {
  ingestOneStatement,
  ingestStatusToHttpStatus,
  type IngestConfig,
  type IngestElementResult,
  type IngestPorts,
} from "./ingest-statement";
import type { LaunchTokenClaims } from "../launch/token";

export interface IngestStatementsResult {
  status: number;
  results: IngestElementResult[];
}

/**
 * Bestilling §5: /statements MUST accept a JSON array, processed per
 * element. Sequential + fail-fast on the first forbidden/conflict/invalid
 * element — elements already written before that point stay durably
 * stored, which is exactly what makes Studio's at-least-once resend of the
 * same batch safe (the idempotency check discards what's already there).
 */
export async function ingestStatements(
  rawStatements: unknown[],
  token: LaunchTokenClaims,
  ports: IngestPorts,
  config: IngestConfig,
): Promise<IngestStatementsResult> {
  const results: IngestElementResult[] = [];
  for (const raw of rawStatements) {
    const result = await ingestOneStatement(raw, token, ports, config);
    results.push(result);
    if (result.status !== "stored" && result.status !== "discarded_duplicate") {
      return { status: ingestStatusToHttpStatus(result.status), results };
    }
  }
  return { status: 200, results };
}
