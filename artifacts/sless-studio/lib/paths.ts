/**
 * Prefix a root-relative app URL with NEXT_PUBLIC_BASE_PATH (e.g. the Replit
 * preview mount "/sless-studio"). External, protocol-relative, data:, blob:
 * and already-prefixed URLs pass through unchanged. Next <Link>/router handle
 * basePath themselves; only use this for raw fetch, native anchors, media
 * srcs and window.location.
 */
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "")

export function appPath(path: string): string
export function appPath(path: string | undefined): string | undefined
export function appPath(path: string | null | undefined): string | null | undefined
export function appPath(path: string | null | undefined): string | null | undefined {
  if (!path || !BASE) return path
  if (!path.startsWith("/") || path.startsWith("//")) return path
  if (path === BASE || path.startsWith(`${BASE}/`) || path.startsWith(`${BASE}?`) || path.startsWith(`${BASE}#`))
    return path
  return `${BASE}${path}`
}

/** Strip the base path from a browser pathname (window.location.pathname). */
export function stripBasePath(pathname: string): string {
  if (!BASE) return pathname
  if (pathname === BASE) return "/"
  return pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length) : pathname
}
