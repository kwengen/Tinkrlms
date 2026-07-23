import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CURRENT_PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

// Routes reachable without a Supabase session. /verify/* is the public
// certificate verification page (bestilling §8: no login required).
// /api/cmi5/fetch-token and /api/xapi/* are called cross-origin by the
// player/AU content, which never holds a Supabase session cookie — they
// authenticate callers themselves via the single-use fetch nonce and the
// scoped launch JWT (bestilling §5), not via this session gate.
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/auth",
  "/verify",
  "/no-access",
  "/api/cmi5/fetch-token",
  "/api/xapi",
];

// Requires a session (unlike PUBLIC_PATH_PREFIXES above) but must stay
// reachable even before the privacy notice is acknowledged — otherwise a
// user could never reach the page that lets them acknowledge it, or sign
// out while stuck on it.
const PRIVACY_GATE_EXEMPT_PREFIXES = ["/personvern", "/api/personvern"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPrivacyGateExempt(pathname: string): boolean {
  return PRIVACY_GATE_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() (not getSession()) — it revalidates the token
  // against Supabase Auth instead of trusting an unverified cookie value.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/post-login", request.url));
  }

  // GDPR transparency gate (bestilling §9) — see CURRENT_PRIVACY_NOTICE_VERSION's
  // doc comment for why this is an information ack, not a consent opt-in.
  if (user && !isPublicPath(pathname) && !isPrivacyGateExempt(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("privacy_notice_ack_at, privacy_notice_version")
      .eq("user_id", user.id)
      .maybeSingle();
    const acknowledged =
      !!profile &&
      profile.privacy_notice_ack_at !== null &&
      profile.privacy_notice_version === CURRENT_PRIVACY_NOTICE_VERSION;
    if (!acknowledged) {
      const redirectUrl = new URL("/personvern", request.url);
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
