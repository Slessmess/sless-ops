import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { appPath } from "@/lib/paths"

/**
 * Next 16 proxy (formerly middleware). UX only: bounce signed-out visitors
 * away from private pages. It only checks that a session cookie exists —
 * every route handler and server action still calls auth() and checks
 * ownership itself. Never rely on this for security.
 */
const PRIVATE = ["/assets", "/account", "/admin", "/projects"]
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
]

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (
    !PRIVATE.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  )
    return NextResponse.next()
  const signedIn = SESSION_COOKIES.some((name) => request.cookies.has(name))
  if (signedIn) return NextResponse.next()
  const login = new URL(appPath("/login"), request.url)
  login.searchParams.set("callbackUrl", `${pathname}${search}`)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: [
    "/assets/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/projects/:path*",
  ],
}
