/** Load .env.local then .env for standalone scripts (Next loads them itself). */
import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"

for (const file of [".env.local", ".env"])
  if (existsSync(file)) loadEnvFile(file)
