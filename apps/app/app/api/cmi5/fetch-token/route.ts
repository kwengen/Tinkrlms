import type { NextRequest } from "next/server";
import { fetchNonceMatches, signLaunchToken } from "@tinkr/shared";
import { getServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { corsPreflightResponse, jsonWithCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  const nonce = request.nextUrl.searchParams.get("nonce");
  if (!sessionId || !nonce) {
    return jsonWithCors({ error: "Missing session_id or nonce" }, { status: 400 });
  }

  const admin = getServiceRoleSupabaseClient();

  const { data: session } = await admin
    .from("registration_sessions")
    .select("session_id, registration_id, org_id, user_id, status, token_expires_at, fetch_nonce_hash, fetch_consumed_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (
    !session ||
    session.status !== "active" ||
    session.fetch_consumed_at !== null ||
    !session.fetch_nonce_hash ||
    !fetchNonceMatches(nonce, session.fetch_nonce_hash)
  ) {
    // Deliberately generic: don't reveal WHICH check failed (expired vs.
    // already-consumed vs. wrong nonce) to an unauthenticated caller.
    return jsonWithCors({ error: "Invalid or already-used fetch URL" }, { status: 403 });
  }

  // Atomic single-use consumption: only the first caller to hit this row
  // while fetch_consumed_at is still null wins (bestilling §5 "engangs-fetch").
  const { data: consumed } = await admin
    .from("registration_sessions")
    .update({ fetch_consumed_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .is("fetch_consumed_at", null)
    .select("session_id")
    .maybeSingle();
  if (!consumed) {
    return jsonWithCors({ error: "Invalid or already-used fetch URL" }, { status: 403 });
  }

  const { data: registration } = await admin
    .from("registrations")
    .select("registration_uuid, au_id, launch_mode")
    .eq("id", session.registration_id)
    .single();
  const { data: au } = await admin
    .from("assignable_units")
    .select("activity_id")
    .eq("id", registration!.au_id)
    .single();

  const ttlSeconds = Math.max(
    60,
    Math.floor((new Date(session.token_expires_at).getTime() - Date.now()) / 1000),
  );

  const token = await signLaunchToken(
    {
      registration: registration!.registration_uuid,
      actorAccount: session.user_id,
      activityId: au!.activity_id,
      sessionId: session.session_id,
      orgId: session.org_id,
      launchMode: registration!.launch_mode,
    },
    process.env.LAUNCH_JWT_SECRET!,
    ttlSeconds,
  );

  // Bestilling §5 "Auth-scheme (avklart)": return the FULL header value
  // verbatim, so Studio's own "prepend Bearer if scheme-less" normalization
  // is a no-op.
  return jsonWithCors({ "auth-token": `Bearer ${token}` });
}
