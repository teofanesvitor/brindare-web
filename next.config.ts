import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.1.101"],
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  outputFileTracingIncludes: {
    "/*": ["./src/templates/contract-template.docx"],
  },
};
export default nextConfig;
