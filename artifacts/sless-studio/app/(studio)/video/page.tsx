import type { Metadata } from "next"
import { Suspense } from "react"

import { GeneratorView } from "@/components/generator/generator-view"
import { listPresets, type PresetView } from "@/lib/presets"

// Audio Cleanup jobs start in this page's server action (after the response)
// and may run for several minutes on long clips (Vercel Pro allows 800 s).
export const maxDuration = 800

export const metadata: Metadata = {
  title: "Video generator",
  description:
    "Create, edit and motion-control video with Seedance, Kling, Wan and more.",
}

async function presets(): Promise<PresetView[]> {
  try {
    return (await listPresets()).filter((preset) => preset.surface === "video")
  } catch {
    return []
  }
}

export default async function VideoPage() {
  return (
    <Suspense>
      <GeneratorView surface="video" presets={await presets()} />
    </Suspense>
  )
}
