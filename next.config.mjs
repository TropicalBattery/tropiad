/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep sharp's native bindings out of the webpack bundle so linux-x64
  // libvips loads from node_modules at runtime on Vercel.
  experimental: {
    serverComponentsExternalPackages: ["sharp"],
  },
  // Ensure NFT traces the platform binary + libvips .so into serverless functions.
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;
