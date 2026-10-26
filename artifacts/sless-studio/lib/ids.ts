import { ObjectId } from "mongodb"

import { NotFoundError } from "./errors"

/** Parse an id from the client; invalid ids are simply "not found". */
export function objectIdOrNotFound(id: unknown): ObjectId {
  if (typeof id !== "string" || id.length !== 24 || !ObjectId.isValid(id))
    throw new NotFoundError()
  return new ObjectId(id)
}
