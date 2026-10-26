import { NextResponse, type NextRequest } from "next/server"

import type { Surface } from "@/generation/catalog/types"
import { listPublic } from "@/lib/community"
import { errorResponse } from "@/lib/http"

const SURFACES: readonly Surface[] = ["image", "video", "audio"]

/**
 * Public community feed: GET /api/community?surface=image|video&cursor=<ms>&limit=
 * Published generations only (see lib/community.ts). Cached briefly at the edge.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const surfaceParam = params.get("surface")
  const cursorParam = params.get("cursor")
  const limitParam = Number(params.get("limit") ?? 24)

  if (surfaceParam && !SURFACES.includes(surfaceParam as Surface))
    return NextResponse.json(
      { error: "Unknown surface.", code: "INVALID" },
      { status: 400 }
    )
  if (cursorParam && !/^\d{1,15}$/.test(cursorParam))
    return NextResponse.json(
      { error: "Invalid cursor.", code: "INVALID" },
      { status: 400 }
    )

  try {
    const page = await listPublic({
      ...(surfaceParam ? { surface: surfaceParam as Surface } : {}),
      ...(cursorParam ? { cursor: cursorParam } : {}),
      limit: Number.isFinite(limitParam)
        ? Math.min(Math.max(Math.trunc(limitParam), 1), 48)
        : 24,
    })
    return NextResponse.json(page, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    })
  } catch (caught) {
    return errorResponse(caught)
  }
}
