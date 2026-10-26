import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
export const directory = resolve(root, "wordpress/sless-refresh");

export async function saveJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

export async function api(path, method = "GET", body) {
  if (!process.env.PRINTIFY_API_TOKEN) throw new Error("Printify credentials missing");
  if (method !== "GET" && process.env.REPLIT_DEPLOYMENT === "1") {
    throw new Error("Merchant operator writes must not run in a deployment");
  }
  const response = await fetch(`https://api.printify.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(method === "GET" ? 60_000 : 120_000),
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Unconfirmed HTTP ${response.status}; inspect provider state before retrying`);
  }
  const result = await response.json();
  if (!response.ok) throw new Error(`Printify HTTP ${response.status}: ${JSON.stringify({
    code: result.code, message: result.message, errors: result.errors,
  })}`);
  return result;
}
