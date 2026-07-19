import { NextResponse } from "next/server";

/**
 * CORS for the LRS-adjacent endpoints the player-origin AU calls
 * cross-origin (fetch-token, statements, state). Bestilling §3/§5: origin
 * MUST be the exact player origin (never a wildcard), and
 * Access-Control-Allow-Headers MUST be exactly these three — Studio sends
 * X-Experience-API-Version on every POST.
 */
export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.PLAYER_ORIGIN!,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Experience-API-Version",
    "Access-Control-Max-Age": process.env.CORS_ACCESS_CONTROL_MAX_AGE_SECONDS ?? "7200",
  };
}

export function corsPreflightResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export function jsonWithCors(body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: corsHeaders() });
}
