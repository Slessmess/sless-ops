import "server-only"

import { higgsfield } from "@/lib/higgsfield/client"
import type { RequestStatus } from "@/lib/higgsfield/types"
import { cancelLocal, isLocalRequest, localStatus } from "@/lib/tools/jobs"

/**
 * Where a request lives: Higgsfield, or a Sless tool job (request ids
 * starting "sless_", see lib/tools/jobs.ts). Finalize, cancel and the
 * reconciler go through here so both behave the same way.
 */
export async function requestStatus(requestId: string): Promise<RequestStatus> {
  return isLocalRequest(requestId)
    ? localStatus(requestId)
    : higgsfield().status(requestId)
}

export async function cancelRequest(requestId: string): Promise<void> {
  return isLocalRequest(requestId)
    ? cancelLocal(requestId)
    : higgsfield().cancel(requestId)
}
