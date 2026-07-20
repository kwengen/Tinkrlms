import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  buildLaunchData,
  buildLaunchedStatement,
  generateFetchNonce,
  statementHash,
  type Json,
} from "@tinkr/shared";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

const requestSchema = z.object({ auId: z.string().uuid() });

const LAUNCH_TOKEN_TTL_SECONDS = Number(process.env.LAUNCH_TOKEN_TTL_HOURS ?? "12") * 3600;

export async function POST(request: NextRequest) {
  const sessionClient = createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { auId } = parsed.data;

  // RLS (assignable_units_select_authenticated) lets any authenticated user
  // read the catalog; we still verify the caller is actually enrolled below.
  const { data: au } = await sessionClient
    .from("assignable_units")
    .select("id, course_version_id, publisher_id, activity_id, launch_url, move_on, mastery_score")
    .eq("id", auId)
    .maybeSingle();
  if (!au) {
    return NextResponse.json({ error: "AU not found" }, { status: 404 });
  }

  // enrollments_select_own (RLS) — the caller can only see their own enrollment.
  const { data: enrollment } = await sessionClient
    .from("enrollments")
    .select("id, org_id, status")
    .eq("user_id", user.id)
    .eq("course_version_id", au.course_version_id)
    .eq("status", "active")
    .maybeSingle();
  if (!enrollment) {
    return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
  }

  const { data: courseVersion } = await sessionClient
    .from("course_versions")
    .select("content_package_id")
    .eq("id", au.course_version_id)
    .single();
  const { data: contentPackage } = await sessionClient
    .from("content_packages")
    .select("storage_path")
    .eq("id", courseVersion!.content_package_id)
    .single();

  const admin = getServiceRoleSupabaseClient();
  const tokenExpiresAt = new Date(Date.now() + LAUNCH_TOKEN_TTL_SECONDS * 1000).toISOString();

  const { data: launchRows, error: launchError } = await admin.rpc("launch_registration", {
    p_enrollment_id: enrollment.id,
    p_au_id: au.id,
    p_org_id: enrollment.org_id,
    p_user_id: user.id,
    p_token_expires_at: tokenExpiresAt,
    p_launch_mode: "Normal",
  });
  const launch = launchRows?.[0];
  if (launchError || !launch) {
    return NextResponse.json({ error: launchError?.message ?? "launch_registration failed" }, { status: 500 });
  }

  const { nonce, hash } = generateFetchNonce();
  await admin
    .from("registration_sessions")
    .update({ fetch_nonce_hash: hash })
    .eq("session_id", launch.out_session_id);

  const actorAccountName = user.id; // opaque internal id, never email (bestilling §4)

  const launchData = buildLaunchData({
    launchMode: "Normal",
    moveOn: au.move_on,
    masteryScore: au.mastery_score,
    registration: launch.out_registration_uuid,
    publisherGroupingId: au.publisher_id,
    sessionId: launch.out_session_id,
  });

  await admin.from("xapi_state").upsert({
    actor_account: actorAccountName,
    activity_id: au.activity_id,
    registration: launch.out_registration_uuid,
    state_id: "LMS.LaunchData",
    document: launchData as unknown as Json,
    org_id: enrollment.org_id,
  });

  const launchedStatement = buildLaunchedStatement({
    statementId: crypto.randomUUID(),
    actorHomePage: process.env.APP_ORIGIN!,
    actorAccountName,
    activityId: au.activity_id,
    registration: launch.out_registration_uuid,
    publisherGroupingId: au.publisher_id,
    sessionId: launch.out_session_id,
    timestamp: new Date().toISOString(),
  });

  await admin.from("xapi_statements").insert({
    statement_id: launchedStatement.id as string,
    registration: launch.out_registration_uuid,
    org_id: enrollment.org_id,
    actor_account: actorAccountName,
    verb_id: (launchedStatement.verb as { id: string }).id,
    activity_id: au.activity_id,
    statement: launchedStatement as unknown as Json,
    statement_hash: statementHash(launchedStatement),
  });

  const fetchUrl = new URL(`${process.env.APP_ORIGIN}/api/cmi5/fetch-token`);
  fetchUrl.searchParams.set("session_id", launch.out_session_id);
  fetchUrl.searchParams.set("nonce", nonce);

  const actorJson = JSON.stringify({
    objectType: "Agent",
    account: { homePage: process.env.APP_ORIGIN, name: actorAccountName },
  });

  const playerLaunchUrl = new URL(`${process.env.PLAYER_ORIGIN}/launch`);
  playerLaunchUrl.searchParams.set("endpoint", `${process.env.LRS_ENDPOINT}`);
  playerLaunchUrl.searchParams.set("fetch", fetchUrl.toString());
  playerLaunchUrl.searchParams.set("actor", actorJson);
  playerLaunchUrl.searchParams.set("registration", launch.out_registration_uuid);
  playerLaunchUrl.searchParams.set("activityId", au.activity_id);
  playerLaunchUrl.searchParams.set(
    "contentBase",
    `${process.env.PLAYER_ORIGIN}/content/${contentPackage!.storage_path}`,
  );
  playerLaunchUrl.searchParams.set("launchPath", au.launch_url);

  return NextResponse.json({ playerLaunchUrl: playerLaunchUrl.toString() });
}
