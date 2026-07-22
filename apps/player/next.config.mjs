const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tinkr/shared"],
  async headers() {
    return [
      {
        // The player origin's whole purpose is to be iframed by the app
        // origin (bestilling §3 architecture) — X-Frame-Options: SAMEORIGIN
        // would block exactly that. `frame-ancestors` scopes embedding to
        // ONLY app.tinkrakademiet.no instead of allowing (or blocking)
        // everyone; player has no Supabase session/auth cookies regardless
        // of who frames it, but this keeps arbitrary third-party sites from
        // iframing course content under this origin. `'self'` is also
        // required: the architecture nests a SECOND iframe on this same
        // origin (launch page -> /content/[...path] AU content), and
        // frame-ancestors does not implicitly allow same-origin framing the
        // way X-Frame-Options: SAMEORIGIN would.
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${APP_ORIGIN} 'self'` },
        ],
      },
    ];
  },
};

export default nextConfig;
