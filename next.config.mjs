/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // In production the /api/*.py files are built by the Vercel Python runtime
  // (see vercel.json) and Vercel routes them. No Next.js route handler may live
  // under app/api, or it would shadow them.
  //
  // `next dev` does not run the Python runtime, so in development proxy /api to
  // `python scripts/dev_api.py`. This rewrite is not applied in production.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    const target = process.env.DEV_API_ORIGIN ?? 'http://127.0.0.1:8000';
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
