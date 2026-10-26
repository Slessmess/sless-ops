import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { LibraryView } from "@/components/library/library-view"
import { currentUser } from "@/lib/auth/session"
import { getProject, listProjects } from "@/lib/generations/library"

export const metadata: Metadata = { title: "Project" }

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await currentUser()
  const { id } = await params
  if (!user) redirect(`/login?callbackUrl=/projects/${id}`)
  // Someone else's (or a missing) project is simply "not found".
  const project = await getProject(user.objectId, id).catch(() => null)
  if (!project) notFound()
  return (
    <LibraryView
      initialProjects={await listProjects(user.objectId)}
      project={project}
    />
  )
}
