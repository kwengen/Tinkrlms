import { NextResponse, type NextRequest } from "next/server";
import {
  extractBearerToken,
  verifyLaunchToken,
  ingestStatements,
  type IngestPorts,
  type RegistrationContext,
  type Json,
} from "@tinkr/shared";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { corsHeaders, corsPreflightResponse } from "@/lib/cors";
import { maybeIssueCertificate } from "@/lib/certificates";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(request: NextRequest) {
  const rawToken = extractBearerToken(request.headers.get("authorization"));
  if (!rawToken) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <jwt>" },
      { status: 401, headers: corsHeaders() },
    );
  }

  const verified = await verifyLaunchToken(rawToken, process.env.LAUNCH_JWT_SECRET!);
  if (!verified.ok || !verified.claims) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401, headers: corsHeaders() });
  }
  const token = verified.claims;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders() });
  }
  if (!Array.isArray(body)) {
    // bestilling §5 point 4 / §10.7: /statements MUST accept a JSON array.
    return NextResponse.json({ error: "Body MUST be a JSON array" }, { status: 400, headers: corsHeaders() });
  }

  const admin = getServiceRoleSupabaseClient();

  const { data: registration } = await admin
    .from("registrations")
    .select("enrollment_id, org_id, current_session_id, launch_mode, au_id")
    .eq("registration_uuid", token.registration)
    .maybeSingle();
  if (!registration) {
    return NextResponse.json({ error: "Unknown registration" }, { status: 403, headers: corsHeaders() });
  }

  const { data: au } = await admin
    .from("assignable_units")
    .select("course_version_id, move_on, mastery_score, publisher_id")
    .eq("id", registration.au_id)
    .single();
  if (!au) {
    return NextResponse.json({ error: "Unknown AU for this registration" }, { status: 403, headers: corsHeaders() });
  }

  const regCtx: RegistrationContext = {
    enrollmentId: registration.enrollment_id,
    orgId: registration.org_id,
    currentSessionId: registration.current_session_id,
    launchMode: registration.launch_mode,
    moveOn: au.move_on,
    masteryScore: au.mastery_score,
    publisherId: au.publisher_id,
  };

  const ports: IngestPorts = {
    async getRegistrationContext() {
      return regCtx;
    },
    async findStatementHash(statementId) {
      const { data } = await admin
        .from("xapi_statements")
        .select("statement_hash")
        .eq("statement_id", statementId)
        .maybeSingle();
      return data?.statement_hash ?? null;
    },
    async insertStatement(row) {
      await admin.from("xapi_statements").insert({ ...row, statement: row.statement as unknown as Json });
    },
    async getCompletionFields(registrationUuid) {
      const { data } = await admin
        .from("completion_state")
        .select("completion, success, score")
        .eq("registration", registrationUuid)
        .maybeSingle();
      return data ?? null;
    },
    async upsertCompletionState(registrationUuid, fields, satisfied) {
      await admin.from("completion_state").upsert({
        registration: registrationUuid,
        org_id: regCtx.orgId,
        user_id: token.actor_account,
        course_version_id: au.course_version_id,
        au_id: registration.au_id,
        completion: fields.completion,
        success: fields.success,
        score: fields.score,
        satisfied,
      });
    },
    async hasSatisfiedStatement(registrationUuid, activityId) {
      const { data } = await admin
        .from("xapi_statements")
        .select("statement_id")
        .eq("registration", registrationUuid)
        .eq("activity_id", activityId)
        .eq("verb_id", "http://adlnet.gov/expapi/verbs/satisfied")
        .maybeSingle();
      return data !== null;
    },
    async insertSatisfiedStatement(row) {
      await admin.from("xapi_statements").insert({ ...row, statement: row.statement as unknown as Json });
    },
    async recomputeCourseCompletion(enrollmentId) {
      await admin.rpc("recompute_course_completion", { p_enrollment_id: enrollmentId });
    },
  };

  const result = await ingestStatements(body, token, ports, { appOrigin: process.env.APP_ORIGIN! });

  // Regardless of the batch's overall status: any statement processed
  // before a later failure may already have driven this enrollment to
  // satisfied via recomputeCourseCompletion above. Cheap no-op otherwise.
  await maybeIssueCertificate(registration.enrollment_id);

  return NextResponse.json({ results: result.results }, { status: result.status, headers: corsHeaders() });
}
