import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome, utilisé par le Dockerfile (déploiement Scaleway).
  output: "standalone",
};

export default nextConfig;
