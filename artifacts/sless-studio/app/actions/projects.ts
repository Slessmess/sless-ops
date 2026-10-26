"use server"

import { runAction } from "@/lib/action-result"
import type { ActionResult } from "@/lib/action-types"
import { requireUser } from "@/lib/auth/session"
import {
  createProject,
  deleteProject,
  listProjects,
  renameProject,
} from "@/lib/generations/library"
import type { ProjectView } from "@/lib/generations/view"

export async function listProjectsAction(): Promise<
  ActionResult<ProjectView[]>
> {
  return runAction(async () => listProjects((await requireUser()).objectId))
}

export async function createProjectAction(
  name: string
): Promise<ActionResult<ProjectView>> {
  return runAction(async () =>
    createProject((await requireUser()).objectId, name)
  )
}

export async function renameProjectAction(
  id: string,
  name: string
): Promise<ActionResult<null>> {
  return runAction(async () => {
    await renameProject((await requireUser()).objectId, id, name)
    return null
  })
}

export async function deleteProjectAction(
  id: string
): Promise<ActionResult<null>> {
  return runAction(async () => {
    await deleteProject((await requireUser()).objectId, id)
    return null
  })
}
