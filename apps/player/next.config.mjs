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
        // iframing course content under this origin.
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${APP_ORIGIN}` },
        ],
      },
    ];
  },
};

export default nextConfig;
