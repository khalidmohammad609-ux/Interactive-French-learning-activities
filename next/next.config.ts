import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Old Apps Script style links (?page=teacher) keep working.
  async redirects() {
    return [{ source: '/', has: [{ type: 'query', key: 'page', value: 'teacher' }], destination: '/teacher', permanent: false }];
  },
};

export default nextConfig;
