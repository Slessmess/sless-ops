import "server-only"

import { ObjectId, type Filter } from "mongodb"
import { z } from "zod"

import type { Surface } from "@/generation/catalog/types"
import { UserFacingError } from "@/lib/errors"
import { objectIdOrNotFound } from "@/lib/ids"
import { NotFoundError } from "@/lib/errors"
import {
  collections,
  IN_FLIGHT,
  type GenerationDoc,
} from "@/lib/db/collections"
import { deleteObjects } from "@/lib/storage"

import { toGenerationView, toProjectView } from "./serialize"
import type { GenerationView, ProjectView } from "./view"

export const PAGE_SIZE = 60

export const listSchema = z.object({
  surface: z.enum(["image", "video", "audio"]).optional(),
  projectId: z.string().optional(),
  status: z.enum(["all", "completed", "failed"]).default("all"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(PAGE_SIZE),
})

export type ListQuery = z.input<typeof listSchema>

/** Newest first; the cursor is the last item's `createdAt:id`. */
export async function listGenerations(
  userId: ObjectId,
  raw: ListQuery
): Promise<{ items: GenerationView[]; nextCursor: string | null }> {
  const query = listSchema.parse(raw)
  const { generations } = await collections()
  const filter: Filter<GenerationDoc> = { userId }
  if (query.surface) filter.surface = query.surface as Surface
  if (query.projectId) filter.projectId = objectIdOrNotFound(query.projectId)
  if (query.status === "completed") filter.status = "completed"
  if (query.status === "failed")
    filter.status = { $in: ["failed", "nsfw", "canceled"] }
  if (query.cursor) {
    const [time, id] = query.cursor.split(":")
    const at = new Date(Number(time))
    if (!Number.isNaN(at.getTime()) && id && ObjectId.isValid(id))
      filter.$or = [
        { createdAt: { $lt: at } },
        { createdAt: at, _id: { $lt: new ObjectId(id) } },
      ]
  }
  const docs = await generations
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()
  const page = docs.slice(0, query.limit)
  const last = page.at(-1)
  return {
    items: page.map(toGenerationView),
    nextCursor:
      docs.length > query.limit && last
        ? `${last.createdAt.getTime()}:${last._id.toHexString()}`
        : null,
  }
}

/** Status snapshot for the browser poll: only the caller's own ids. */
export async function generationStatuses(
  userId: ObjectId,
  ids: string[]
): Promise<GenerationView[]> {
  const valid = ids.filter((id) => ObjectId.isValid(id) && id.length === 24)
  if (!valid.length) return []
  const { generations } = await collections()
  const docs = await generations
    .find({ userId, _id: { $in: valid.map((id) => new ObjectId(id)) } })
    .toArray()
  return docs.map(toGenerationView)
}

export async function getOwnGeneration(
  userId: ObjectId,
  id: string
): Promise<GenerationDoc> {
  const { generations } = await collections()
  const doc = await generations.findOne({ _id: objectIdOrNotFound(id), userId })
  if (!doc) throw new NotFoundError("Generation not found.")
  return doc
}

export async function deleteGenerations(
  userId: ObjectId,
  ids: string[]
): Promise<{ deleted: number }> {
  const { generations } = await collections()
  const objectIds = ids.map(objectIdOrNotFound)
  const docs = await generations
    .find({ userId, _id: { $in: objectIds } })
    .toArray()
  if (docs.length !== objectIds.length)
    throw new NotFoundError("Generation not found.")
  if (docs.some((doc) => IN_FLIGHT.includes(doc.status)))
    throw new UserFacingError(
      "Wait for running generations to finish (or cancel them) before deleting.",
      "IN_FLIGHT"
    )
  const keys = docs.flatMap((doc) =>
    doc.outputs.filter((output) => output.key).map((output) => output.key)
  )
  await deleteObjects(keys).catch((error) =>
    console.error("[library] storage delete failed", error)
  )
  const result = await generations.deleteMany({
    userId,
    _id: { $in: objectIds },
  })
  return { deleted: result.deletedCount }
}

export async function setPublished(
  userId: ObjectId,
  id: string,
  isPublic: boolean
): Promise<GenerationView> {
  const { generations } = await collections()
  const doc = await getOwnGeneration(userId, id)
  if (isPublic && doc.status !== "completed")
    throw new UserFacingError("Only finished generations can be published.")
  if (isPublic && doc.unpublishedByAdmin)
    throw new UserFacingError(
      "This generation was removed from Community by a moderator.",
      "MODERATED"
    )
  const updated = await generations.findOneAndUpdate(
    { _id: doc._id, userId },
    isPublic
      ? {
          $set: {
            isPublic: true,
            publishedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      : {
          $set: { isPublic: false, updatedAt: new Date() },
          $unset: { publishedAt: "" },
        },
    { returnDocument: "after" }
  )
  return toGenerationView(updated!)
}

export async function moveToProject(
  userId: ObjectId,
  ids: string[],
  projectId: string | null
): Promise<{ moved: number }> {
  const { generations, projects } = await collections()
  let target: ObjectId | null = null
  if (projectId) {
    const project = await projects.findOne({
      _id: objectIdOrNotFound(projectId),
      userId,
    })
    if (!project) throw new NotFoundError("Project not found.")
    target = project._id
    await projects.updateOne(
      { _id: target },
      { $set: { updatedAt: new Date() } }
    )
  }
  const objectIds = ids.map(objectIdOrNotFound)
  const result = await generations.updateMany(
    { userId, _id: { $in: objectIds } },
    { $set: { projectId: target, updatedAt: new Date() } }
  )
  if (result.matchedCount !== objectIds.length)
    throw new NotFoundError("Generation not found.")
  return { moved: result.modifiedCount }
}

/* ── Projects ─────────────────────────────────────────────────────────────── */

const projectName = z
  .string()
  .trim()
  .min(1, "Give the project a name.")
  .max(80, "Keep project names under 80 characters.")

export async function listProjects(userId: ObjectId): Promise<ProjectView[]> {
  const { projects, generations } = await collections()
  const docs = await projects
    .find({ userId })
    .sort({ updatedAt: -1 })
    .limit(200)
    .toArray()
  if (!docs.length) return []
  const stats = await generations
    .aggregate<{ _id: ObjectId; count: number; cover?: string }>([
      { $match: { userId, projectId: { $in: docs.map((doc) => doc._id) } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$projectId",
          count: { $sum: 1 },
          cover: {
            $first: {
              $cond: [
                { $eq: ["$status", "completed"] },
                { $arrayElemAt: ["$outputs.url", 0] },
                null,
              ],
            },
          },
        },
      },
    ])
    .toArray()
  const byId = new Map(stats.map((stat) => [stat._id.toHexString(), stat]))
  return docs.map((doc) => {
    const stat = byId.get(doc._id.toHexString())
    return toProjectView(doc, {
      count: stat?.count ?? 0,
      ...(stat?.cover ? { cover: stat.cover } : {}),
    })
  })
}

export async function getProject(
  userId: ObjectId,
  id: string
): Promise<ProjectView> {
  const { projects, generations } = await collections()
  const doc = await projects.findOne({ _id: objectIdOrNotFound(id), userId })
  if (!doc) throw new NotFoundError("Project not found.")
  const count = await generations.countDocuments({ userId, projectId: doc._id })
  return toProjectView(doc, { count })
}

export async function createProject(
  userId: ObjectId,
  name: unknown
): Promise<ProjectView> {
  const { projects } = await collections()
  const count = await projects.countDocuments({ userId })
  if (count >= 200)
    throw new UserFacingError("You can have up to 200 projects.")
  const now = new Date()
  const doc = {
    _id: new ObjectId(),
    userId,
    name: projectName.parse(name),
    createdAt: now,
    updatedAt: now,
  }
  await projects.insertOne(doc)
  return toProjectView(doc, { count: 0 })
}

export async function renameProject(
  userId: ObjectId,
  id: string,
  name: unknown
): Promise<void> {
  const { projects } = await collections()
  const result = await projects.updateOne(
    { _id: objectIdOrNotFound(id), userId },
    { $set: { name: projectName.parse(name), updatedAt: new Date() } }
  )
  if (!result.matchedCount) throw new NotFoundError("Project not found.")
}

/** Deleting a project keeps its generations (they return to the library). */
export async function deleteProject(
  userId: ObjectId,
  id: string
): Promise<void> {
  const { projects, generations } = await collections()
  const projectId = objectIdOrNotFound(id)
  const result = await projects.deleteOne({ _id: projectId, userId })
  if (!result.deletedCount) throw new NotFoundError("Project not found.")
  await generations.updateMany(
    { userId, projectId },
    { $set: { projectId: null, updatedAt: new Date() } }
  )
}
