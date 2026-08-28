import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      ignored: ["**/.git/**", "**/.venv/**", "**/node_modules/**", "**/.next/**"],
    };
    return config;
  },
};

export default nextConfig;
