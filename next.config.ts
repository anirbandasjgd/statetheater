import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  webpack: (config) => {
    config.watchOptions = {
      ignored: ["**/.git/**", "**/.venv/**", "**/node_modules/**", "**/.next/**"],
    };
    return config;
  },
};

export default nextConfig;
