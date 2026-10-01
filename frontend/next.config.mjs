/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_PUBLIC_API_URL: empty string = relative URLs (/api/v1/...)
  // Next.js rewrites will proxy /api/* to the backend
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
  },
  async rewrites() {
    // Server-side proxy: /api/* → backend
    // In Docker: http://backend:8000, in local dev: http://localhost:8000
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
