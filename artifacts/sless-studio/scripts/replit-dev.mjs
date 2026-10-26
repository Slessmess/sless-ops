import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// Explicit, isolated DEVELOPMENT stack. Never used by the production command.
if (process.env.REPLIT_DEPLOYMENT === "1") throw new Error("Preview stack cannot run in a deployment");
const base = (process.env.BASE_PATH ?? "/sless-studio").replace(/\/$/, "");
const origin = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : `http://localhost:${process.env.PORT}`;
await mkdir(".data/mongo", { recursive: true });
const mongo = await MongoMemoryReplSet.create({
  binary: { version: "7.0.24" },
  replSet: { count: 1, name: "sless", storageEngine: "wiredTiger" },
  instanceOpts: [{ port: 27027, dbPath: `${process.cwd()}/.data/mongo`, ip: "127.0.0.1" }],
});
const environment = { ...process.env,
  NODE_ENV: "development", STUDIO_PREVIEW: "true",
  NEXT_PUBLIC_STUDIO_PREVIEW: "true", NEXT_PUBLIC_BASE_PATH: base,
  APP_URL: `${origin}${base}`, AUTH_URL: `${origin}${base}/api/auth`,
  AUTH_SECRET: randomBytes(32).toString("hex"),
  MONGODB_URI: mongo.getUri(), MONGODB_DB: "sless-studio-preview",
  HF_API_BASE_URL: "http://127.0.0.1:4010", HF_CREDENTIALS: "mock:mock",
  MOCK_PUBLIC_BASE: `${origin}${base}/api/preview-platform`,
  HF_WEBHOOK_BASE_URL: "", SIGNUP_BONUS_CREDITS: "200",
  E2E_TEST_MODE: "true", E2E_SECRET: randomBytes(32).toString("hex"),
  STUDIO_BACKGROUND_WORKER: "true", BILLING_ENABLED: "false",
};
// Never inherit paid-provider connections into this preview.
for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "AUTH_RESEND_KEY",
  "AUPHONIC_API_KEY", "ELEVENLABS_API_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]) delete environment[key];
try { environment.FFMPEG_PATH = execFileSync("which", ["ffmpeg"], { encoding: "utf8" }).trim(); }
catch { throw new Error("System ffmpeg is required for the preview"); }
const children = [];
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill("SIGTERM"));
  await mongo.stop({ doCleanup: false });
  process.exit(code);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void stop());
const mock = spawn("pnpm", ["exec", "tsx", "scripts/mock-higgsfield.ts"], { env: environment, stdio: "inherit" });
children.push(mock);
mock.on("exit", code => { if (!stopping) void stop(code || 1); });
const next = spawn("pnpm", ["exec", "next", "dev", "--webpack", "--hostname", "0.0.0.0", "--port", process.env.PORT ?? "3000"], {
  env: environment, stdio: "inherit",
});
children.push(next);
next.on("exit", code => { if (!stopping) void stop(code || 1); });
