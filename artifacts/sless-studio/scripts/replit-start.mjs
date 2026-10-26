import { spawn } from "node:child_process";

if (process.env.STUDIO_PREVIEW === "true") throw new Error("Development preview cannot be published");
const origin = new URL(process.env.APP_URL ?? "");
if (origin.protocol !== "https:") throw new Error("APP_URL must be the verified HTTPS production URL");
const child = spawn("pnpm", ["exec", "next", "start", "--hostname", "0.0.0.0", "--port", process.env.PORT ?? "3000"], {
  env: { ...process.env, NODE_ENV: "production", STUDIO_BACKGROUND_WORKER: "true",
    AUTH_URL: `${origin.href.replace(/\/$/, "")}/api/auth` },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
