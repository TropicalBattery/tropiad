/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep sharp's native bindings out of the webpack/NFT bundle so linux-x64
  // libvips loads from node_modules at runtime on Vercel.
  experimental: {
    serverComponentsExternalPackages: [
      "sharp",
      "@img/sharp-linux-x64",
      "@img/sharp-libvips-linux-x64",
    ],
  },
  // NFT often traces @img/sharp-linux-x64 but not sibling libvips (.so).
  // Include both under every serverless function, especially approve.
  outputFileTracingIncludes: {
    "/api/posts/[id]/approve": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/cron/advance-runs": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/admin/clients/[slug]/run-now": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
