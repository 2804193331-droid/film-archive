const ossEndpoint = (process.env.ALI_OSS_ENDPOINT || "oss-cn-shanghai.aliyuncs.com")
  .replace(/^https?:\/\//i, "")
  .replace(/\/+$/, "");
const ossBucket = process.env.ALI_OSS_BUCKET || "film-archive-images";
const ossPublicHost = (() => {
  const value = process.env.ALI_OSS_PUBLIC_BASE_URL;
  if (!value) return null;

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
})();
const ossHosts = Array.from(new Set([`${ossBucket}.${ossEndpoint}`, ossPublicHost].filter(Boolean)));

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          }
        ]
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com"
      },
      ...ossHosts.map((hostname) => ({
        protocol: "https",
        hostname
      }))
    ]
  }
};

export default nextConfig;
