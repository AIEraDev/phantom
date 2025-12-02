/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Compression
  compress: true,
  poweredByHeader: false,
};

module.exports = nextConfig;
