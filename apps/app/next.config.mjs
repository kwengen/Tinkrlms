/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tinkr/shared"],
  async headers() {
    return [
      {
        // The app origin embeds the player origin in an iframe; the player
        // never embeds the app. See docs/INTEGRATION-cmi5-contract.md and
        // bestilling §3 for the trust boundary this enforces.
        source: "/(.*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
    ];
  },
};

export default nextConfig;
