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
        source: "/dashboard",
        destination: "/dashboard/index.html",
      },
      {
        source: "/dashboard/:path*",
        destination: "/dashboard/index.html",
      },
      {
        source: "/dashboard/admin",
        destination: "/dashboard/admin.html",
      },
      {
        source: "/auth/login",
        destination: "/auth/login.html",
      },
      {
        source: "/src/:path*",
        destination: "/:path*",
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
