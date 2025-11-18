/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Edge 런타임을 사용하는 미들웨어/라우트가 있을 경우를 대비한 최대 바디 크기 (50MB)
  middlewareClientMaxBodySize: 50 * 1024 * 1024,
};

export default nextConfig;
