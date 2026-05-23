import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Internal URL used by the Next.js server to reach the NestJS API.
 * Never exposed to the browser — no NEXT_PUBLIC_ prefix.
 * Default: http://localhost:3001
 */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

/**
 * Content-Security-Policy.
 * – Development: no CSP (avoids blocking HMR, Turbopack, source-maps, etc.)
 * – Production: strict, same-origin only (API is proxied through Next.js).
 */
function buildCSP(): string | null {
  if (isDev) return null;

  const directives: string[] = [
    `default-src 'self'`,
    `script-src 'self'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`, // API is same-origin via the /api/v1 rewrite
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ];

  return directives.join('; ');
}

/** Security response headers (no network side-effects). */
const STATIC_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Proxy all /api/v1/* requests through Next.js to the NestJS backend.
   *
   * Why: when the frontend is accessed from a LAN IP (e.g. 10.0.0.248:3000),
   * the browser stores cookies for that origin. Direct cross-origin calls to
   * localhost:3001 would bind the refresh_token cookie to "localhost", making
   * it invisible to the Next.js middleware at 10.0.0.248:3000.
   *
   * By proxying through Next.js the cookie is always scoped to whichever host
   * the browser used to load the app — matching what the middleware sees.
   */
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${API_INTERNAL_URL}/api/v1/:path*`,
      },
    ];
  },

  async headers() {
    const csp = buildCSP();

    const responseHeaders = [
      ...STATIC_HEADERS,
      ...(!isDev
        ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload',
            },
          ]
        : []),
      ...(csp ? [{ key: 'Content-Security-Policy', value: csp }] : []),
    ];

    return [{ source: '/:path*', headers: responseHeaders }];
  },
};

export default nextConfig;
