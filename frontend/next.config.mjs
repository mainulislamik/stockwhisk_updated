/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // The browser talks to the backend directly at NEXT_PUBLIC_API_BASE (CORS is
  // enabled on the backend), so no rewrite/proxy is needed here.
};

export default nextConfig;
