import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { LaunchModeType } from "../types/database";

export const LAUNCH_TOKEN_SCOPES = [
  "statements:write",
  "state:read",
  "state:write:suspendData",
] as const;

const launchTokenClaimsSchema = z.object({
  registration: z.string().uuid(),
  actor_account: z.string().min(1),
  activity_id: z.string().min(1),
  session_id: z.string().uuid(),
  org_id: z.string().uuid(),
  launch_mode: z.enum(["Normal", "Browse", "Review"]),
  scope: z.array(z.string()),
});

export type LaunchTokenClaims = z.infer<typeof launchTokenClaimsSchema>;

export interface MintLaunchTokenInput {
  registration: string;
  actorAccount: string;
  activityId: string;
  sessionId: string;
  orgId: string;
  launchMode: LaunchModeType;
}

/** Scoped launch JWT (bestilling §5) — signed with LAUNCH_JWT_SECRET, NOT the Supabase auth JWT. */
export async function signLaunchToken(
  input: MintLaunchTokenInput,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const claims: LaunchTokenClaims = {
    registration: input.registration,
    actor_account: input.actorAccount,
    activity_id: input.activityId,
    session_id: input.sessionId,
    org_id: input.orgId,
    launch_mode: input.launchMode,
    scope: [...LAUNCH_TOKEN_SCOPES],
  };
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(key);
}

export interface VerifyLaunchTokenResult {
  ok: boolean;
  claims?: LaunchTokenClaims;
  error?: string;
}

export async function verifyLaunchToken(token: string, secret: string): Promise<VerifyLaunchTokenResult> {
  const key = new TextEncoder().encode(secret);
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const parsed = launchTokenClaimsSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, error: "Token payload does not match the expected launch-token shape" };
    }
    return { ok: true, claims: parsed.data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Extracts the raw JWT from an `Authorization: Bearer <jwt>` header value.
 * Bestilling §5: ingest MUST validate the scheme is exactly `Bearer`.
 */
export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer (.+)$/.exec(authorizationHeader);
  return match ? match[1]! : null;
}
