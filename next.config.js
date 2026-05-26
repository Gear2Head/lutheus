/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/dashboard/admin",
        destination: "/dashboard/admin.html",
      },
      {
        source: "/auth/login",
        destination: "/auth/login.html",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/discord-dashboard",
        destination: "/bot",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
