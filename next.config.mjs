/** @type {import('next').NextConfig} */
const nextConfig = {
  // Inline critical CSS on first load (reduces render-blocking CSS)
  experimental: {
    optimizeCss: true,
  },
  // Allow Next.js Image optimizer to serve resized/WebP images from these hosts
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
