import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright drives a real browser binary; keep it out of the server bundle.
  serverExternalPackages: ["playwright"],
  images: {
    remotePatterns: [
      // Google account avatars
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
