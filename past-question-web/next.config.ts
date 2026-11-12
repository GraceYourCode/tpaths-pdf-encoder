import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Landing-page photos are served from Unsplash (free to use under the Unsplash License).
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    // Account and checkout pages hold personal data; keep them out of shared caches
    // and back/forward caches.
    const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0" }];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/dashboard/:path*", headers: noStore },
      { source: "/checkout/:path*", headers: noStore },
      { source: "/payment/:path*", headers: noStore },
    ];
  },
  allowedDevOrigins: ['10.198.185.204'],
};

export default nextConfig;
