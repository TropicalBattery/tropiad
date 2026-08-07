/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep sharp's native bindings out of the webpack/NFT bundle so linux-x64
  // libvips loads from node_modules at runtime on Vercel.
  experimental: {
    serverComponentsExternalPackages: ["sharp", "@img/sharp-linux-x64", "@img/sharp-libvips-linux-x64"],
  },
  // Force-include platform binaries (NFT often misses nested @img/libvips).
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/**/*": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/posts/[id]/approve": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
