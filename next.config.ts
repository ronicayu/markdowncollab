import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws", "y-protocols", "lib0", "yjs"],
  allowedDevOrigins: ["*"],
};

export default nextConfig;
