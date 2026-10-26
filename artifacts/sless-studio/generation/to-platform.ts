import { getModel } from "./catalog"
import { mapByPaths } from "./catalog/mappers"
import { validateMedia } from "./catalog/media-inputs"
import type { GenerationPlane, PlatformRequest } from "./catalog/types"

/**
 * Validate a plane against the catalog and map it to the platform request.
 * Runs in the browser (to disable Generate with a reason) and again on the
 * server before any credit is debited — the server never trusts the client.
 */
export function toPlatform(plane: GenerationPlane): PlatformRequest {
  const model = getModel(plane.model)
  validateMedia(model, plane.media, plane.inputMode)
  const text = plane.prompt.text.trim()
  if (model.requirePrompt && !text)
    throw new Error(`A prompt is required for ${model.label}.`)
  if (model.maxPromptLength && text.length > model.maxPromptLength)
    throw new Error(
      `${model.label} prompts are limited to ${model.maxPromptLength.toLocaleString("en-US")} characters.`
    )
  if (model.toPlatform) return model.toPlatform(plane)
  if (model.paths) return mapByPaths(plane, model.paths)
  throw new Error(`No platform map for ${plane.model}`)
}
