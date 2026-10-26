/**
 * Explicit, workspace-only operator command for the approved Sless redesign.
 * Never run from app startup, build hooks or deployment commands.
 * --prepare uploads the owner-supplied shirt crops; --create creates drafts.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "@workspace/db";
import { TaskStore } from "./task-store";
import { OpsService } from "./ops-service";
import type { OpsTask, TaskResult } from "./ops-types";

const directory = resolve(process.cwd(), "../../wordpress/sless-refresh");
const base = new URL(process.env.WP_URL || "https://slessismore.org/wp-json/wp/v2");
if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
  throw new Error("Unsafe WordPress REST URL");
}
const headers = {
  Authorization: `Basic ${Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64")}`,
};
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

async function saveJson(name: string, value: unknown) {
  const path = resolve(directory, name);
  await writeFile(`${path}.tmp`, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

async function loadJson<T>(name: string, empty: T): Promise<T> {
  try {
    return JSON.parse(await readFile(resolve(directory, name), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty;
    throw error;
  }
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${base.href.replace(/\/$/, "")}/${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`WordPress returned non-JSON (HTTP ${response.status}); inspect the provider before retrying`);
  }
  // Elementor's cache endpoint can acknowledge success with an empty body.
  // Creation/update endpoints must still return their complete JSON result.
  if (options.method === "DELETE" && path === "../../elementor/v1/cache" && response.ok) {
    const text = await response.text();
    return text.trim() ? JSON.parse(text) : null;
  }
  const body = await response.json();
  const code = typeof body === "object" && body !== null && "code" in body && typeof body.code === "string" ?
    body.code : "unknown";
  if (!response.ok) throw new Error(`WordPress rejected ${path.split("?")[0]} (HTTP ${response.status}, ${code})`);
  return body;
}

const definitions = [
  { key: "home", slug: "home-redesign", title: "Home" },
  { key: "wrestling", slug: "wrestling", title: "Wrestling" },
  { key: "ai", slug: "ai", title: "AI (SlessBox)" },
  { key: "store", slug: "store", title: "Sless Store" },
  { key: "giveaway", slug: "giveaway", title: "Fall Brawl 2025" },
  { key: "thank-you", slug: "thank-you", title: "Thank You" },
  { key: "download", slug: "download", title: "Download SlessBox" },
  { key: "checkout", slug: "checkout", title: "Checkout" },
  { key: "winners", slug: "winners", title: "Fall Brawl Winners" },
];
type RecordMap = Record<string, { id: number; url: string; slug: string }>;

function contentWithUrls(source: string, media: RecordMap, pages: RecordMap, previews: boolean) {
  let content = source;
  for (let index = 1; index <= 3; index++) {
    for (const lifestyle of [false, true]) {
      const key = `shirt-${index}${lifestyle ? "-lifestyle" : ""}`;
      const token = `__SHIRT_${index}_${lifestyle ? "LIFESTYLE" : "IMAGE"}__`;
      if (!media[key]) throw new Error(`Missing image: ${key}`);
      content = content.replaceAll(token, media[key].url);
    }
  }
  for (const page of definitions) {
    const url = pages[page.key] ?
      `${base.origin}/?page_id=${pages[page.key].id}${previews ? "&preview=true" : ""}` :
      `${base.origin}/${page.slug}/`;
    content = content.replaceAll(`__PAGE_URL_${page.key}__`, url.replaceAll("&", "&amp;"));
  }
  if (/__(?:SHIRT|PAGE_URL)_/.test(content)) throw new Error("Unresolved layout asset/navigation token");
  return content;
}

function pageBody(task: OpsTask, content: string) {
  // Existing Elementor's HTML widget preserves the supplied page design and
  // makes it available in the site's existing editor. No plugin is installed.
  const elementorData = [{
    id: "slessroot",
    elType: "section",
    settings: {
      layout: "full_width",
      content_width: { unit: "%", size: 100 },
      gap: "no",
      padding: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
    },
    elements: [{
      id: "slesscol",
      elType: "column",
      settings: { _column_size: 100, _inline_size: null },
      elements: [{
        id: "slesshtml", elType: "widget", widgetType: "html",
        settings: { html: content }, elements: [],
      }],
    }],
  }];
  return {
    title: task.title, slug: task.slug, status: "draft",
    content: `<!-- wp:html -->\n${content}\n<!-- /wp:html -->`,
    excerpt: task.excerpt || "",
    template: "elementor_canvas",
    meta: {
      _elementor_edit_mode: "builder",
      _elementor_template_type: "wp-page",
      _elementor_data: JSON.stringify(elementorData),
      _elementor_page_settings: { hide_title: "yes" },
    },
  };
}

async function main() {
  if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT === "1" ||
      !["--prepare", "--create"].includes(process.argv[2] || "")) {
    throw new Error("Run explicitly in the workspace: NODE_ENV=development tsx src/lib/wordpress-page-cli.ts --prepare|--create");
  }
  if (!process.env.WP_USER || !process.env.WP_APP_PASSWORD) throw new Error("WordPress credentials are missing");
  const identity = await request("users/me?context=edit");
  if (!identity.capabilities?.edit_pages || !identity.capabilities?.unfiltered_html) {
    throw new Error("The WordPress account needs page-editing and unfiltered HTML permissions");
  }
  const settings = await request("settings");
  const liveHome = await request(`pages/${settings.page_on_front}?context=edit`);
  const baseline = {
    frontPageId: settings.page_on_front,
    showOnFront: settings.show_on_front,
    liveHomeId: liveHome.id,
    liveHomeModified: liveHome.modified_gmt,
    liveHomeHash: digest(liveHome.content.raw + JSON.stringify(liveHome.meta)),
  };
  const existingBaseline = await loadJson<any>("site-baseline.json", null);
  if (!existingBaseline) await saveJson("site-baseline.json", baseline);
  else if (JSON.stringify(existingBaseline) !== JSON.stringify(baseline)) {
    throw new Error("Live homepage/settings changed since preparation; inspect before continuing");
  }

  const media = await loadJson<RecordMap>("media-manifest.json", {});
  const names = ["NO INTRODUCTION NEEDED", "STAY UNDENIABLE", "BUILT DIFFERENT. PROVEN DAILY."];
  for (let index = 1; index <= 3; index++) {
    for (const lifestyle of [false, true]) {
      const key = `shirt-${index}${lifestyle ? "-lifestyle" : ""}`;
      if (media[key]) continue;
      const filename = `sless-fall-${key}.${lifestyle ? "jpg" : "png"}`;
      const form = new FormData();
      form.set("file", new Blob([await readFile(resolve(directory, `assets/${key}.${lifestyle ? "jpg" : "png"}`))],
        { type: lifestyle ? "image/jpeg" : "image/png" }), filename);
      form.set("title", `${names[index - 1]} — ${lifestyle ? "lifestyle" : "product"}`);
      form.set("alt_text", `${names[index - 1]} white unisex tee with black typography${lifestyle ? ", worn by a model" : ""}`);
      const image = await request("media", { method: "POST", body: form });
      media[key] = { id: image.id, url: image.source_url, slug: image.slug };
      await saveJson("media-manifest.json", media);
      console.log(JSON.stringify({ uploaded: key, mediaId: image.id }));
    }
  }
  if (process.argv[2] === "--prepare") return;

  const seo = await loadJson<any>("seo-plan.json", null);
  if (!seo) throw new Error("Missing SEO/content plan");
  const pages = await loadJson<RecordMap>("page-manifest.json", {});
  const store = new TaskStore();
  const existingTasks = await store.list();
  const input: OpsTask[] = [];
  for (const definition of definitions) {
    const source = await readFile(resolve(directory, `${definition.key}.html`), "utf8");
    if (!/<style[\s>]/i.test(source) || !/<h1[\s>]/i.test(source)) throw new Error(`Missing design content: ${definition.key}`);
    const matches = await request(`pages?context=edit&status=any&slug=${definition.slug}&per_page=100`);
    if (matches.some((page: any) => page.id !== pages[definition.key]?.id)) {
      throw new Error(`Page slug already exists: ${definition.slug}. No existing page was overwritten.`);
    }
    const seoPages = Array.isArray(seo) ? seo : Array.isArray(seo.pages) ? seo.pages : null;
    const seoEntry = seoPages ? seoPages.find((entry: any) => entry.key === definition.key || entry.slug === definition.slug) :
      (seo.pages?.[definition.key] || seo[definition.key]);
    const task: OpsTask = {
      id: `sless_draft_page_${definition.key.replaceAll("-", "_")}`,
      type: "wp_page", status: "pending", title: definition.title, slug: definition.slug,
      content: source, wp_status: "draft",
      excerpt: seoEntry?.metaDescription || seoEntry?.description || seoEntry?.meta_description || "",
    };
    const existing = existingTasks.find((item) => item.id === task.id);
    if (existing) {
      if (existing.status !== "completed" || !pages[definition.key] || existing.result?.id !== pages[definition.key].id) {
        throw new Error(`Existing unconfirmed task ${task.id}; inspect WordPress before any retry`);
      }
    } else input.push(task);
  }
  await store.importTasks(input);
  const service = new OpsService(store, async (task): Promise<TaskResult> => {
    const content = contentWithUrls(String(task.content), media, pages, true);
    const page = await request("pages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pageBody(task, content)),
    });
    if (page.status !== "draft" || !page.id || !page.link) throw new Error("Unconfirmed WordPress draft outcome");
    const definition = definitions.find((item) => item.slug === task.slug)!;
    pages[definition.key] = { id: page.id, url: page.link, slug: page.slug };
    await saveJson("page-manifest.json", pages);
    return { success: true, id: page.id, link: page.link };
  });
  for (const definition of definitions) {
    if (pages[definition.key]) continue;
    const task = await service.approve(`sless_draft_page_${definition.key.replaceAll("-", "_")}`);
    console.log(JSON.stringify({ created: definition.key, status: task.status, result: task.result }));
    if (task.status !== "completed") throw new Error("Stopped after an unconfirmed provider operation; no writes were retried");
  }
  // Resolve cross-page preview links only after every draft has its stable ID.
  for (const definition of definitions) {
    const task = (await store.list()).find((item) => item.id === `sless_draft_page_${definition.key.replaceAll("-", "_")}`)!;
    const source = await readFile(resolve(directory, `${definition.key}.html`), "utf8");
    const content = contentWithUrls(source, media, pages, true);
    const page = await request(`pages/${pages[definition.key].id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pageBody(task, content)),
    });
    if (page.status !== "draft" || page.template !== "elementor_canvas" ||
        page.meta?._elementor_data !== pageBody(task, content).meta._elementor_data) {
      throw new Error(`Draft/template content verification failed: ${definition.key}`);
    }
    await writeFile(resolve(directory, `${definition.key}.wordpress.html`), content);
    console.log(JSON.stringify({ verified: definition.key, id: page.id, status: page.status, template: page.template }));
  }
  // Elementor REST metadata updates do not invalidate its rendered HTML cache.
  // This supported endpoint clears only generated cache, not page content.
  await request("../../elementor/v1/cache", { method: "DELETE" });
  console.log("Elementor generated cache refreshed.");
  const afterSettings = await request("settings");
  const afterHome = await request(`pages/${baseline.liveHomeId}?context=edit`);
  if (afterSettings.page_on_front !== baseline.frontPageId ||
      afterSettings.show_on_front !== baseline.showOnFront ||
      digest(afterHome.content.raw + JSON.stringify(afterHome.meta)) !== baseline.liveHomeHash ||
      afterHome.modified_gmt !== baseline.liveHomeModified) {
    throw new Error("Live homepage/settings verification failed");
  }
  console.log("All nine drafts verified; live homepage and front-page settings unchanged.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "WordPress operator command failed");
  process.exitCode = 1;
}).finally(() => pool.end());