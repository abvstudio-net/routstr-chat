import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  experimental: {
    // Ensure app router can export without Node APIs on the server
    reactCompiler: false,
  },
};

export default nextConfig;