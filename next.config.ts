import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Mostadam manuals are large PDFs (Commercial D+C is ~6MB) and the wizard
      // accepts several at once, so lift the default 1MB Server Action body cap.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
