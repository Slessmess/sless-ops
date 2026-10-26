import "server-only"

import { ObjectId } from "mongodb"

import { auth } from "@/auth"
import type { Role } from "@/lib/db/collections"
import { NotFoundError, UnauthorizedError } from "@/lib/errors"

export { NotFoundError, UnauthorizedError }
export { objectIdOrNotFound } from "@/lib/ids"

export type SessionUser = {
  id: string
  objectId: ObjectId
  role: Role
  email: string
  name?: string | null
  image?: string | null
}

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth()
  const user = session?.user
  if (!user?.id || !ObjectId.isValid(user.id)) return null
  return {
    id: user.id,
    objectId: new ObjectId(user.id),
    role: user.role,
    email: user.email ?? "",
    name: user.name,
    image: user.image,
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user) throw new UnauthorizedError()
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  // Non-admins get the same answer as a missing page.
  if (user.role !== "admin") throw new NotFoundError()
  return user
}
