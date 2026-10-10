/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api-docs",
        destination: "/api-docs.html",
      },
      {
        source: "/docs",
        destination: "/api-docs.html",
      },
      {
        source: "/docs/api",
        destination: "/api-docs.html",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/api-docs",
        destination: "/api-docs.html",
        permanent: false,
      },
      {
        source: "/docs",
        destination: "/api-docs.html",
        permanent: false,
      },
      {
        source: "/docs/api",
        destination: "/api-docs.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
