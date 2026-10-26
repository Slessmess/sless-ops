import "server-only"

import { randomUUID } from "node:crypto"
import { ObjectId } from "mongodb"

import { collections, type GenerationDoc } from "@/lib/db/collections"
import { PlatformError } from "@/lib/higgsfield/client"
import type { QueuedRequest, RequestStatus } from "@/lib/higgsfield/types"

import { runAudioCleanup } from "./audio-cleanup"
import { ToolError } from "./errors"
import { db } from "@/lib/db/mongo"
import { AUDIO_CLEANUP_PATHS } from "@/generation/catalog/models/audio-cleanup"

/**
 * Sless Studio tools run on our own servers but behave like the platform, so
 * submit, finalize, cancel, the reconciler, billing and refunds stay the same:
 *
 *   submitLocal()  → a queued job (the generation's hfRequestId = requestId)
 *   runToolJobs()  → claims a job, runs it, stores the result in our bucket
 *   localStatus()  → what finalizeGeneration reads, like GET /requests/{id}/status
 *   cancelLocal()  → queued jobs only, like POST /requests/{id}/cancel
 *
 * Jobs start right after submit (next/server `after`), and the tools cron
 * (/api/cron/tools, every minute) picks up anything left behind. A job whose
 * worker died is retried once after its lease expires, then failed (refunded).
 */

export const LOCAL_PATH_PREFIX = "sless/"
export const LOCAL_REQUEST_PREFIX = "sless_"
const LEASE_MS = 12 * 60_000
const MAX_ATTEMPTS = 2

export function isLocalPath(path: string): boolean {
  return path.startsWith(LOCAL_PATH_PREFIX)
}

export function isLocalRequest(requestId: string): boolean {
  return requestId.startsWith(LOCAL_REQUEST_PREFIX)
}

export async function submitLocal(gen: GenerationDoc): Promise<QueuedRequest> {
  const { toolJobs } = await collections()
  const requestId = `${LOCAL_REQUEST_PREFIX}${gen._id.toHexString()}`
  const now = new Date()
  await toolJobs.updateOne(
    { requestId },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        requestId,
        generationId: gen._id,
        userId: gen.userId,
        path: gen.modelPath,
        body: gen.requestBody,
        status: "queued",
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true }
  )
  return { status: "queued", requestId, statusUrl: "", cancelUrl: "" }
}

export async function localStatus(requestId: string): Promise<RequestStatus> {
  const { toolJobs } = await collections()
  const job = await toolJobs.findOne({ requestId })
  if (!job)
    return {
      status: "failed",
      requestId,
      artifacts: [],
      error: "This job was lost before it ran.",
    }
  const abandoned =
    job.status === "in_progress" &&
    (job.attempts >= MAX_ATTEMPTS || job.path !== AUDIO_CLEANUP_PATHS.repair) &&
    (job.leaseUntil?.getTime() ?? 0) < Date.now()
  if (abandoned)
    return {
      status: "failed",
      requestId,
      artifacts: [],
      error: "Processing stopped before it finished.",
    }
  return {
    status: job.status,
    requestId,
    artifacts: job.output
      ? [
          {
            kind: "video",
            url: job.output.url,
            contentType: job.output.contentType,
            stored: job.output,
          },
        ]
      : [],
    ...(job.error ? { error: job.error } : {}),
  }
}

/** Queued jobs only; mirrors the platform's 400 once processing started. */
export async function cancelLocal(requestId: string): Promise<void> {
  const { toolJobs } = await collections()
  const canceled = await toolJobs.findOneAndUpdate(
    { requestId, status: "queued" },
    {
      $set: {
        status: "canceled",
        finishedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  )
  if (!canceled)
    throw new PlatformError(400, { detail: "The job already started." })
}

export type ToolRunner = typeof runAudioCleanup

/**
 * Claim and run queued jobs one at a time until none are left or the time
 * budget runs out. Each finished job is finalized at once, so its tile
 * updates without waiting for the reconciler.
 */
export async function runToolJobs(
  options: { budgetMs?: number; max?: number; runner?: ToolRunner } = {}
): Promise<number> {
  const locks = (await db()).collection<{ _id: string; owner: string; until: Date }>("runtime_locks")
  const owner = randomUUID()
  const now = new Date()
  try {
    const acquired = await locks.findOneAndUpdate(
      { _id: "audio-runner", until: { $lt: now } },
      { $set: { owner, until: new Date(now.getTime() + LEASE_MS) } },
      { upsert: true, returnDocument: "after" }
    )
    if (acquired?.owner !== owner) return 0
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) return 0
    throw error
  }
  const heartbeat = setInterval(() => {
    void locks.updateOne(
      { _id: "audio-runner", owner },
      { $set: { until: new Date(Date.now() + LEASE_MS) } }
    ).catch(() => console.error("[tools] runner lease renewal failed"))
  }, 30_000)
  heartbeat.unref()
  try {
    return await processToolJobs(options, owner)
  } finally {
    clearInterval(heartbeat)
    await locks.deleteOne({ _id: "audio-runner", owner })
  }
}

async function processToolJobs(
  options: { budgetMs?: number; max?: number; runner?: ToolRunner },
  owner: string
): Promise<number> {
  const started = Date.now()
  const budgetMs = options.budgetMs ?? 4 * 60_000
  const runner = options.runner ?? runAudioCleanup
  const { toolJobs, generations } = await collections()
  let ran = 0
  while (
    ran < (options.max ?? Number.POSITIVE_INFINITY) &&
    Date.now() - started < budgetMs
  ) {
    const now = new Date()
    const job = await toolJobs.findOneAndUpdate(
      {
        $or: [
          { status: "queued" },
          {
            status: "in_progress",
            path: AUDIO_CLEANUP_PATHS.repair,
            leaseUntil: { $lt: now },
            attempts: { $lt: MAX_ATTEMPTS },
          },
        ],
      },
      {
        $set: {
          status: "in_progress",
          leaseUntil: new Date(now.getTime() + LEASE_MS),
          leaseOwner: owner,
          startedAt: now,
          updatedAt: now,
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, returnDocument: "after" }
    )
    if (!job) break
    ran++
    await generations.updateOne(
      { _id: job.generationId, status: "queued" },
      { $set: { status: "in_progress", updatedAt: now } }
    )
    const renew = setInterval(() => {
      void toolJobs.updateOne(
        { _id: job._id, status: "in_progress", leaseOwner: owner },
        { $set: { leaseUntil: new Date(Date.now() + LEASE_MS) } }
      ).catch(() => console.error("[tools] job lease renewal failed"))
    }, 30_000)
    renew.unref()
    try {
      const output = await runner({
        path: job.path,
        body: job.body,
        keyBase: `u/${job.userId.toHexString()}/${job.generationId.toHexString()}/0`,
      })
      await toolJobs.updateOne(
        { _id: job._id, status: "in_progress", leaseOwner: owner },
        {
          $set: {
            status: "completed",
            output,
            finishedAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: { leaseUntil: "", leaseOwner: "" },
        }
      )
    } catch (error) {
      const known = error instanceof ToolError
      console.error(
        `[tools] ${job.path} failed for ${job.generationId.toHexString()}:`,
        known
          ? (error.operatorDetail ?? error.userMessage)
          : error instanceof Error
            ? error.message
            : error
      )
      await toolJobs.updateOne(
        { _id: job._id, status: "in_progress", leaseOwner: owner },
        {
          $set: {
            status: "failed",
            error: known ? error.userMessage : "Processing failed.",
            finishedAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: { leaseUntil: "", leaseOwner: "" },
        }
      )
    } finally {
      clearInterval(renew)
    }
    // Imported lazily: finalize reads job status from this module.
    const { finalizeGeneration } = await import("@/lib/generations/finalize")
    await finalizeGeneration(job.generationId).catch((error: unknown) =>
      console.error(
        "[tools] finalize failed",
        error instanceof Error ? error.message : error
      )
    )
  }
  return ran
}

/**
 * Start queued jobs after the current response is sent. Outside a request
 * (tests, scripts) there's nothing to hook into; the tools cron picks them up.
 */
export async function kickToolJobs(): Promise<void> {
  if (process.env.STUDIO_BACKGROUND_WORKER === "true") return
  try {
    const { after } = await import("next/server")
    after(() => runToolJobs({ max: 1 }).then(() => undefined))
  } catch {
    // Not inside a request scope.
  }
}
