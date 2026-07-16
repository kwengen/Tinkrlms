/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tinkr/shared"],
  async headers() {
    return [
      {
        // Player origin has no Supabase session and no access to the app's
        // auth cookies — it only ever talks to the LRS via a scoped token.
        // See docs/INTEGRATION-cmi5-contract.md and bestilling §3.
        source: "/(.*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
