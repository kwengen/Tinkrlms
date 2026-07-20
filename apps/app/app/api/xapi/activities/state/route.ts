import { NextResponse, type NextRequest } from "next/server";
import {
  extractBearerToken,
  verifyLaunchToken,
  validateStateRequest,
  validateStateDocumentSize,
  parseStateDocumentJson,
  type LaunchTokenClaims,
  type Json,
} from "@tinkr/shared";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { corsHeaders, corsPreflightResponse } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflightResponse();
}

function logRejectedStateAttempt(reason: string, ctx: Record<string, unknown>) {
  // bestilling §5: "Logg alle avviste State-forsøk (actor, registration,
  // stateId, grunn)". Vercel captures console output as function logs; a
  // dedicated table isn't warranted for this (audit_log is scoped to
  // lawful training-completion records, a different concern — bestilling §4/§9).
  console.warn("[xapi/state] rejected", { reason, ...ctx });
}

interface ParsedStateQuery {
  activityId: string;
  actorAccount: string;
  registration: string;
  stateId: string;
}

/** Returns null (with a 400 response already sent by the caller) if required params are missing/malformed. */
function parseQuery(request: NextRequest): ParsedStateQuery | null {
  const params = request.nextUrl.searchParams;
  const activityId = params.get("activityId");
  const agentRaw = params.get("agent");
  const registration = params.get("registration");
  const stateId = params.get("stateId");
  if (!activityId || !agentRaw || !registration || !stateId) return null;

  let actorAccount: string | undefined;
  try {
    const agent = JSON.parse(agentRaw);
    actorAccount = agent?.account?.name;
  } catch {
    return null;
  }
  if (!actorAccount) return null;

  return { activityId, actorAccount, registration, stateId };
}

async function authenticate(
  request: NextRequest,
): Promise<{ ok: true; token: LaunchTokenClaims } | { ok: false; response: NextResponse }> {
  const rawToken = extractBearerToken(request.headers.get("authorization"));
  if (!rawToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing Authorization: Bearer <jwt>" }, { status: 401, headers: corsHeaders() }),
    };
  }
  const verified = await verifyLaunchToken(rawToken, process.env.LAUNCH_JWT_SECRET!);
  if (!verified.ok || !verified.claims) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers: corsHeaders() }),
    };
  }
  return { ok: true, token: verified.claims };
}

async function currentSessionIdFor(registrationUuid: string): Promise<string | null> {
  const admin = getServiceRoleSupabaseClient();
  const { data } = await admin
    .from("registrations")
    .select("current_session_id")
    .eq("registration_uuid", registrationUuid)
    .maybeSingle();
  return data?.current_session_id ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { token } = auth;

  const query = parseQuery(request);
  if (!query) {
    return NextResponse.json({ error: "Missing/invalid activityId, agent, registration, or stateId" }, { status: 400, headers: corsHeaders() });
  }

  const currentSessionId = await currentSessionIdFor(token.registration);
  const validation = validateStateRequest({ method: "GET", ...query }, token, currentSessionId);
  if (!validation.ok) {
    logRejectedStateAttempt(validation.reason!, { actor: query.actorAccount, registration: query.registration, stateId: query.stateId });
    return NextResponse.json({ error: validation.reason }, { status: validation.status, headers: corsHeaders() });
  }

  const admin = getServiceRoleSupabaseClient();
  const { data } = await admin
    .from("xapi_state")
    .select("document")
    .eq("actor_account", query.actorAccount)
    .eq("activity_id", query.activityId)
    .eq("registration", query.registration)
    .eq("state_id", query.stateId)
    .maybeSingle();

  if (!data) {
    // xAPI spec: GET on a non-existent state document is 404.
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders() });
  }
  return NextResponse.json(data.document, { status: 200, headers: corsHeaders() });
}

export async function PUT(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { token } = auth;

  const query = parseQuery(request);
  if (!query) {
    return NextResponse.json({ error: "Missing/invalid activityId, agent, registration, or stateId" }, { status: 400, headers: corsHeaders() });
  }

  const currentSessionId = await currentSessionIdFor(token.registration);
  const validation = validateStateRequest({ method: "PUT", ...query }, token, currentSessionId);
  if (!validation.ok) {
    logRejectedStateAttempt(validation.reason!, { actor: query.actorAccount, registration: query.registration, stateId: query.stateId });
    return NextResponse.json({ error: validation.reason }, { status: validation.status, headers: corsHeaders() });
  }

  const raw = await request.text();
  const sizeCheck = validateStateDocumentSize(raw);
  if (!sizeCheck.ok) {
    return NextResponse.json({ error: sizeCheck.reason }, { status: sizeCheck.status, headers: corsHeaders() });
  }
  const parsed = parseStateDocumentJson(raw);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400, headers: corsHeaders() });
  }

  // Last-write-wins (bestilling §5: ETag/concurrency deliberately deferred
  // in v1 — cmi5 AUs are single-session per registration, so collision risk
  // is low).
  const admin = getServiceRoleSupabaseClient();
  await admin.from("xapi_state").upsert({
    actor_account: query.actorAccount,
    activity_id: query.activityId,
    registration: query.registration,
    state_id: query.stateId,
    document: parsed.value as unknown as Json,
    org_id: token.org_id,
  });

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const { token } = auth;

  const query = parseQuery(request);
  if (!query) {
    return NextResponse.json({ error: "Missing/invalid activityId, agent, registration, or stateId" }, { status: 400, headers: corsHeaders() });
  }

  const currentSessionId = await currentSessionIdFor(token.registration);
  const validation = validateStateRequest({ method: "DELETE", ...query }, token, currentSessionId);
  if (!validation.ok) {
    logRejectedStateAttempt(validation.reason!, { actor: query.actorAccount, registration: query.registration, stateId: query.stateId });
    return NextResponse.json({ error: validation.reason }, { status: validation.status, headers: corsHeaders() });
  }

  const admin = getServiceRoleSupabaseClient();
  await admin
    .from("xapi_state")
    .delete()
    .eq("actor_account", query.actorAccount)
    .eq("activity_id", query.activityId)
    .eq("registration", query.registration)
    .eq("state_id", query.stateId);

  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
