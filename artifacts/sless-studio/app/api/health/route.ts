import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export function GET() {
  return NextResponse.json({
    status: "ok",
    mode: process.env.STUDIO_PREVIEW === "true" ? "development-preview" : "production",
    paidOperationsEnabled: process.env.BILLING_ENABLED === "true",
  })
}
