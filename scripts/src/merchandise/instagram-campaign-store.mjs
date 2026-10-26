import { Storage } from "@google-cloud/storage";
import { createHash } from "node:crypto";

const sidecar = "http://127.0.0.1:1106";
const storage = new Storage({
  credentials: {
    audience: "replit", subject_token_type: "access_token",
    token_url: `${sidecar}/token`, type: "external_account",
    credential_source: {
      url: `${sidecar}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});
export const sha256 = value => createHash("sha256").update(value).digest("hex");
const prefix = "private/campaigns/holiday-tops-oct2026";
export function campaignFile(name) {
  const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucket) throw new Error("App Storage bucket unavailable");
  return storage.bucket(bucket).file(`${prefix}/${name}`);
}
export async function readJournal() {
  const file = campaignFile("instagram-journal.json");
  const [metadata] = await file.getMetadata();
  // Read exactly the generation used by the next conditional write. Never pair
  // another worker's newer bytes with an older generation.
  const version = storage.bucket(file.bucket.name).file(file.name, { generation: metadata.generation });
  const [bytes] = await version.download();
  return { data: JSON.parse(bytes.toString("utf8")), generation: metadata.generation };
}
export async function writeJournal(data, generation) {
  await campaignFile("instagram-journal.json").save(JSON.stringify(data, null, 2), {
    resumable: false, contentType: "application/json",
    preconditionOpts: { ifGenerationMatch: generation },
  });
  // The returned generation must belong to this exact version. A changed value
  // below is detected before any subsequent external write.
  const saved = await readJournal();
  if (saved.data.revision !== data.revision || saved.data.owner !== data.owner)
    throw new Error("Journal ownership changed; stop without publishing");
  return saved.generation;
}
export async function signedAssetUrl(objectName) {
  const response = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID,
      object_name: `${prefix}/${objectName}`, method: "GET",
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Cannot sign campaign media: HTTP ${response.status}`);
  const result = await response.json();
  if (!result.signed_url?.startsWith("https://")) throw new Error("Invalid media signing response");
  return result.signed_url; // Runtime only: never write signed URLs to files or logs.
}
