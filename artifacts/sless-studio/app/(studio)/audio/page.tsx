import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { GeneratorView } from "@/components/generator/generator-view"
import { modelsFor } from "@/generation/catalog"
import { listPresets, type PresetView } from "@/lib/presets"

export const metadata: Metadata = {
  title: "Audio generator",
  description: "Generate voices, sound effects and music.",
}

async function presets(): Promise<PresetView[]> {
  try {
    return (await listPresets()).filter((preset) => preset.surface === "audio")
  } catch {
    return []
  }
}

export default async function AudioPage() {
  // The Audio surface appears once the catalog has an audio model; the REST
  // API documents none yet (docs/model-catalog.md → Audio).
  if (modelsFor("audio").length === 0) notFound()
  return (
    <Suspense>
      <GeneratorView surface="audio" presets={await presets()} />
    </Suspense>
  )
}
