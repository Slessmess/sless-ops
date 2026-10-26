import "server-only"

import { PlatformError } from "./client"

/**
 * Platform errors → plain messages for the prompt dock
 * (https://docs.higgsfield.ai/docs/concepts/errors). Operator problems
 * (bad key, platform balance) are logged loudly but shown generically.
 */
export function describePlatformError(error: unknown): {
  message: string
  operatorAlert?: string
} {
  if (!(error instanceof PlatformError))
    return {
      message: "Something went wrong starting this generation. Try again.",
    }
  const detail = error.message
  switch (error.status) {
    case 400:
      if (/concurren/i.test(detail))
        return {
          message:
            "Our studio is at capacity right now. Try again in a minute — your credits were refunded.",
          operatorAlert: `Platform concurrency limit reached: ${detail}`,
        }
      return { message: `The model rejected this request: ${trim(detail)}` }
    case 401:
      return {
        message:
          "Generation is temporarily unavailable. Please try again soon.",
        operatorAlert: "Higgsfield rejected HF_CREDENTIALS (401).",
      }
    case 403:
      return {
        message:
          "Generation is temporarily unavailable. Please try again soon.",
        operatorAlert:
          "Higgsfield account is out of credits (403). Top up the platform balance.",
      }
    case 404:
      return {
        message: "This model isn't available right now. Pick another model.",
      }
    case 422:
      return { message: `Some settings weren't accepted: ${trim(detail)}` }
    case 423:
      return { message: "This model is temporarily paused. Try another model." }
    case 429:
      return { message: "The studio is busy. Try again in a moment." }
    case 503:
      return {
        message: "This model is warming up. Try again in a few minutes.",
      }
    default:
      return {
        message: "The model service had a problem. Try again in a moment.",
      }
  }
}

function trim(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim()
  return clean.length > 180 ? `${clean.slice(0, 177)}…` : clean
}

/** Terminal failure text → the message we store on the tile. */
export function describeTerminal(status: string, error?: string): string {
  if (status === "nsfw") return "Blocked by content filter. Credits refunded."
  if (status === "canceled") return "Canceled. Credits refunded."
  const reason = error ? trim(error) : "The generation failed"
  return `${reason.replace(/\.$/, "")}. Credits refunded.`
}
