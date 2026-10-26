import { getBalance } from "@/lib/account"
import { currentUser } from "@/lib/auth/session"
import { errorResponse, json } from "@/lib/http"

/** Live credit balance for the nav pill (balances are never kept in the session). */
export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return json({ user: null })
    const balance = await getBalance(user.objectId)
    return json({ user: { id: user.id, role: user.role }, ...balance })
  } catch (caught) {
    return errorResponse(caught)
  }
}
