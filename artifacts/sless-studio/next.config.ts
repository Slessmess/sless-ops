import type { NextConfig } from "next"

import { syncModels, watchModels } from "./scripts/sync-models.mjs"

// Keep the model barrel in sync with generation/catalog/models/*.
syncModels()
if (process.env.NODE_ENV === "development") watchModels()

const isDev = process.env.NODE_ENV === "development"

function origin(value: string | undefined): string | null {
  try {
    return value ? new URL(value).origin : null
  } catch {
    return null
  }
}

/**
 * Content-Security-Policy. Media may come from our R2 bucket and the
 * platform's CDNs (outputs are shown while their copy is pending). Browser
 * uploads PUT to a presigned platform storage URL whose host the docs don't
 * pin, so connect-src allows HTTPS; override with CSP_CONNECT_SRC to narrow it.
 */
function contentSecurityPolicy(): string {
  const media = [
    "'self'",
    "data:",
    "blob:",
    origin(process.env.R2_PUBLIC_BASE_URL),
    "https://*.higgsfield.ai",
    "https://*.cloudfront.net",
    ...(isDev ? ["http://localhost:4010"] : []),
  ].filter(Boolean)
  const connect =
    process.env.CSP_CONNECT_SRC ??
    `'self' https:${isDev ? " http://localhost:4010 ws:" : ""}`
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${media.join(" ")}`,
    `media-src ${media.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "frame-src https://js.stripe.com https://checkout.stripe.com",
    "form-action 'self' https://checkout.stripe.com",
    isDev
      ? "frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev"
      : "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  ...(isDev ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(self)",
  },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
]

/*
 * Audio Cleanup runs ffmpeg on the server (lib/tools). `ffmpeg-static` stays an
 * external package so its binary path resolves at runtime, and the binary is
 * traced into the two functions that run tool jobs: the video page (its
 * server action starts the job right after submit) and the tools cron.
 */
const FFMPEG_FILES = [
  "./node_modules/ffmpeg-static/ffmpeg",
  "./node_modules/.pnpm/ffmpeg-static@*/node_modules/ffmpeg-static/ffmpeg",
]

const nextConfig: NextConfig = {
  distDir: process.env.STUDIO_DIST_DIR ?? ".next",
  basePath: (process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH ?? "").replace(/\/$/, ""),
  allowedDevOrigins: ["*.replit.dev", "*.replit.app"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb", allowedOrigins: ["*.replit.dev", "*.replit.app"] },
  },
  agentRules: false,
  poweredByHeader: false,
  serverExternalPackages: ["ffmpeg-static", "mongodb", "@auth/mongodb-adapter"],
  outputFileTracingIncludes: {
    "/video": FFMPEG_FILES,
    "/api/cron/tools": FFMPEG_FILES,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/media/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ]
  },
}

export default nextConfig
