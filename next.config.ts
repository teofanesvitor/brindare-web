import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.1.101"],
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
