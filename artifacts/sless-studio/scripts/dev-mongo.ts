/**
 * Local MongoDB for development: a single-node replica set (transactions need
 * one) persisted in .data/mongo. Prints the URI to put in .env.local.
 *   pnpm db:dev
 */
import { mkdirSync } from "node:fs"
import { join } from "node:path"

import { MongoMemoryReplSet } from "mongodb-memory-server"

const dbPath = join(process.cwd(), ".data", "mongo")
mkdirSync(dbPath, { recursive: true })

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger", name: "sless" },
  instanceOpts: [{ port: 27027, dbPath }],
})
console.log(
  `\nMongoDB replica set ready\n  MONGODB_URI=${replSet.getUri()}\n  data: ${dbPath}\n\nCtrl+C to stop.`
)

const stop = async () => {
  await replSet.stop({ doCleanup: false })
  process.exit(0)
}
process.on("SIGINT", () => void stop())
process.on("SIGTERM", () => void stop())
setInterval(() => undefined, 1 << 30)
