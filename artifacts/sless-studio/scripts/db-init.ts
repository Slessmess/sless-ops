/**
 * Idempotent database setup: indexes, the Effects preset seed, and (with
 * --admin=email) an admin role for an existing or future user.
 *   pnpm db:init [--admin=you@example.com]
 */
import "./load-env"

const { db, closeMongoForTests } = await import("../lib/db/mongo")
const { ensureIndexes } = await import("../lib/db/indexes")
const { seedPresets } = await import("../lib/presets")

const database = await db()
const indexes = await ensureIndexes(database)
console.log(`indexes: ${indexes.length} ensured`)
console.log(`presets: ${await seedPresets()} inserted`)

const admin = process.argv
  .find((arg) => arg.startsWith("--admin="))
  ?.split("=")[1]
if (admin) {
  const email = admin.trim().toLowerCase()
  const result = await database
    .collection("users")
    .updateOne({ email }, { $set: { role: "admin" } })
  console.log(
    result.matchedCount
      ? `admin: ${email} is now an admin`
      : `admin: no user ${email} yet — add it to ADMIN_EMAILS or sign in first`
  )
}
await closeMongoForTests()
