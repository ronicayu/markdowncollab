import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws", "y-protocols", "lib0", "yjs"],
  allowedDevOrigins: ["100.109.228.117", "localhost", "0.0.0.0"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
