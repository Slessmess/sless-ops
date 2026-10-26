import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

// Stage only. This script never publishes, submits orders, uploads public files,
// creates Stripe Payment Links, or writes Mailchimp contacts.
const stage = process.argv.includes("--stage");
const root = "wordpress/sless-refresh";
const origin = new URL(process.env.WP_URL || "https://slessismore.org").origin;
if (!process.env.WP_USER || !process.env.WP_APP_PASSWORD) {
  throw new Error("WordPress credentials are unavailable");
}
const headers = {
  Authorization: `Basic ${Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64")}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};
async function wp(path, method = "GET", body) {
  const response = await fetch(`${origin}/wp-json/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`WordPress ${method} failed (${response.status}). Reconcile before retrying a write.`);
  return response.json();
}
function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
const manifest = JSON.parse(await readFile(`${root}/page-manifest.json`, "utf8"));
const sourceIds = ["ai", "checkout", "download", "thank-you"];
const originals = await Promise.all(sourceIds.map(name => wp(`wp/v2/pages/${manifest[name].id}?context=edit`)));
const baseline = originals.map(p => ({ id: p.id, status: p.status, hash: hash(p.content.raw) }));
const existingDownload = originals.find(page => page.id === manifest.download.id);
const protectedPackageId = existingDownload.content.raw.match(/\[wpdm_package\s+id=["'](\d+)["']/)?.[1];
if (!protectedPackageId || !/wpdmdl|wpdm-download-link/.test(existingDownload.content.rendered)) {
  throw new Error("Existing native protected package could not be observed; do not upload a public substitute");
}
const gateway = await wp("wc/v3/payment_gateways/stripe");
if (gateway.settings?.testmode?.value !== "yes") {
  throw new Error("Stripe must already be in approved test mode. No staging writes performed.");
}

const key = process.env.MAILCHIMP_API_KEY;
const dc = key?.match(/-([a-z]{2,3}\d+)$/i)?.[1];
if (!dc) throw new Error("Mailchimp configuration unavailable");
async function mailchimp(path) {
  const response = await fetch(`https://${dc}.api.mailchimp.com/3.0/${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`replit:${key}`).toString("base64")}` },
    redirect: "error", signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Mailchimp read failed (${response.status})`);
  return response.json();
}
const audience = await mailchimp("lists/e9025fad09?fields=id,name,double_optin");
if (audience.double_optin !== true) throw new Error("Expected existing double opt-in; no audience settings were changed.");
const forms = await mailchimp("lists/e9025fad09/signup-forms");
const signup = new URL(forms.signup_forms?.[0]?.signup_form_url);
if (signup.hostname !== "eepurl.com" || signup.username || signup.password) {
  throw new Error("Unexpected Mailchimp signup URL");
}
signup.protocol = "https:";
const publicForm = await fetch(signup.href, { signal: AbortSignal.timeout(25_000) });
const destination = new URL(publicForm.url);
if (!publicForm.ok || destination.protocol !== "https:" ||
    !destination.hostname.endsWith(".list-manage.com")) {
  throw new Error("Mailchimp hosted signup destination could not be verified");
}
const formHtml = await publicForm.text();
// Mailchimp's hosted form uses MERGE0; embedded forms commonly use EMAIL.
if (!/<input\b[^>]*type\s*=\s*["']?email["'\s>]/i.test(formHtml) ||
    !/name\s*=\s*["']?(?:EMAIL|MERGE0)["'\s>]/i.test(formHtml)) {
  throw new Error("Hosted signup form has no supported email field");
}

const productSpecs = [
  {
    name: "SlessBox Pro", sku: "SLESSBOX-PRO", regular_price: "39.00",
    previousDescription: "<p>One-time purchase. Commercial use license included, email support, and one year of free updates. 14-day money-back guarantee.</p>",
    description: "<p><strong>Pro · $39 one time.</strong> Multi-document chat with source citations, project workspaces, saved prompt templates, and polished document exports.</p><p>Includes the existing commercial-use license, email support, one year of updates, and a 14-day money-back guarantee.</p><p><strong>Staging proposal only:</strong> These features are not implemented or activated in the current installer. Do not sell or deliver this edition until app licensing is built and tested.</p>",
  },
  {
    name: "SlessBox Studio", sku: "SLESSBOX-STUDIO", regular_price: "79.00",
    previousDescription: "<p>One-time purchase. Everything in Pro, document chat (RAG), priority email support, and lifetime updates. 14-day money-back guarantee.</p>",
    description: "<p><strong>Studio · $79 one time.</strong> Everything in Pro, plus searchable document libraries, batch generation for social posts from your source documents, and reusable multi-step workflows.</p><p>Includes the existing commercial-use license, priority email support, lifetime updates, and a 14-day money-back guarantee.</p><p><strong>Staging proposal only:</strong> These features are not implemented or activated in the current installer. Do not sell or deliver this edition until app licensing is built and tested.</p>",
  },
];
function updateTierCard(source, name, bullets) {
  const heading = `<h3>SlessBox ${name}</h3>`;
  const headingIndex = source.indexOf(heading);
  if (headingIndex < 0 || source.indexOf(heading, headingIndex + heading.length) >= 0) {
    throw new Error(`Expected one SlessBox ${name} card in the draft`);
  }
  const start = source.lastIndexOf("<article", headingIndex);
  const end = source.indexOf("</article>", headingIndex);
  const card = source.slice(start, end + "</article>".length);
  const listStart = card.indexOf("<ul>");
  const listEnd = card.indexOf("</ul>", listStart);
  if (start < 0 || listStart < 0 || listEnd < 0) throw new Error(`SlessBox ${name} feature list is missing`);
  const updated = `${card.slice(0, listStart)}<ul>${bullets.map(item => `<li>${item}</li>`).join("")}</ul>${card.slice(listEnd + 5)}`;
  return `${source.slice(0, start)}${updated}${source.slice(end + "</article>".length)}`;
}
function updateTierComparison(source) {
  const section = source.indexOf('id="compare"');
  const start = section < 0 ? -1 : source.indexOf("<tbody>", section);
  const end = start < 0 ? -1 : source.indexOf("</tbody>", start);
  if (start < 0 || end < 0) throw new Error("Tier comparison table is missing from the staging page");
  const rows = [
    ["Price", "Free", "$39 one time", "$79 one time"],
    ["Subscription", "None", "None", "None"],
    ["Windows 10/11", "Yes", "Yes", "Yes"],
    ["Local model access", "Use installed models", "Use installed models", "Use installed models"],
    ["Unlimited local chats", "Yes", "Yes", "Yes"],
    ["Chat history", "Basic", "Included", "Included"],
    ["Document chat with citations", "—", "Included", "Included"],
    ["Project workspaces and saved prompts", "—", "Included", "Included"],
    ["Polished document exports", "—", "Included", "Included"],
    ["Searchable document libraries", "—", "—", "Included"],
    ["Batch content generation", "—", "—", "Included"],
    ["Reusable multi-step workflows", "—", "—", "Included"],
    ["Commercial-use license", "—", "Included", "Included"],
    ["Support", "Community", "Email", "Priority email"],
    ["Updates", "Not specified", "1 year", "Lifetime"],
    ["Money-back guarantee", "—", "14 days", "14 days"],
  ];
  const html = rows.map(row => `<tr>${row.map((cell, index) =>
    index === 0 ? `<td>${cell}</td>` : `<td>${cell}</td>`).join("")}</tr>`).join("");
  return `${source.slice(0, start + "<tbody>".length)}${html}${source.slice(end)}`;
}
const receipt = {
  stripeTestMode: true,
  signup: { audience: audience.name, doubleOptIn: true, url: signup.href },
  installer: {
    filename: "Local-AI-Setup_0.1.4_x64-setup_1791200773622.exe",
    ownerConfirmed: true,
    existingProtectedPackageObserved: true,
    protectedPackageId: Number(protectedPackageId),
    uploadRequired: false,
    contentHashVerified: false,
    wooOrderDeliveryConnected: false,
  },
  products: [], pages: [], originalsUnchanged: false,
  limitations: [
    "No products or pages published; no orders or contacts created.",
    "An existing WordPress Download Manager installer package is present; do not request a duplicate upload.",
    "Native password-protected owner verification is not yet connected to WooCommerce paid-order permissions.",
    "Hosted signup is connected, but confirmed-email-to-Lite-download delivery is not configured.",
    "No automated license issuance or tier feature-unlocking has been configured.",
  ],
};
async function saveReceipt() {
  await writeFile(`${root}/slessbox-staging.json`, `${JSON.stringify(receipt, null, 2)}\n`);
}
for (const spec of productSpecs) {
  const matches = await wp(`wc/v3/products?sku=${encodeURIComponent(spec.sku)}&status=any`);
  if (matches.length > 1) throw new Error("Duplicate SlessBox SKU; reconcile manually");
  let product = matches[0];
  if (product && (product.status !== "draft" || product.name !== spec.name)) {
    throw new Error("Existing SlessBox product is not the expected draft; no update allowed");
  }
  if (!product && stage) {
    product = await wp("wc/v3/products", "POST", {
      ...spec, type: "simple", status: "draft", virtual: true, downloadable: false,
      short_description: "<p>SlessBox for Windows 10/11. One-time payment; no subscription.</p>",
      meta_data: [{ key: "_slessbox_staging", value: "order-downloads" }],
    });
  }
  if (!product) throw new Error("SlessBox draft missing; use --stage to prepare it");
  if (product.status !== "draft" || Number(product.regular_price) !== Number(spec.regular_price) || !product.virtual) {
    throw new Error("SlessBox draft price or virtual-product setting differs");
  }
  const currentDescription = (product.description || "").trim();
  if (currentDescription !== spec.description && stage) {
    if (currentDescription !== spec.previousDescription) {
      throw new Error(`${spec.name} draft description changed; review before overwriting`);
    }
    product = await wp(`wc/v3/products/${product.id}`, "PUT", { description: spec.description });
    if ((product.description || "").trim() !== spec.description) {
      throw new Error(`${spec.name} proposed tier description failed verification`);
    }
  } else if (currentDescription !== spec.description && currentDescription !== spec.previousDescription) {
    throw new Error(`${spec.name} draft description needs review`);
  }
  receipt.products.push({
    id: product.id, name: product.name, status: product.status,
    price: product.regular_price, downloadable: product.downloadable,
    proposedFeaturesAwaitingAppActivation: true,
    downloadCount: product.downloads?.length || 0,
    editUrl: `${origin}/wp-admin/post.php?post=${product.id}&action=edit`,
  });
  await saveReceipt();
}

const bodies = {
  checkout: `<main class="main" id="checkout-main"><div class="wrap"><p class="eyebrow">SlessBox · Test-mode staging</p><h1>Checkout</h1><section class="card"><p class="primary">SlessBox checkout is being staged in WooCommerce with Stripe test mode.</p><p>SlessBox Pro: $39 one-time. SlessBox Studio: $79 one-time.</p><p class="draft">Both products remain drafts. This page does not accept payment or redirect to a payment link.</p><p>After launch approval, checkout will use the site's WooCommerce cart and Stripe gateway. Paid downloads will use order-specific permissions, not a shared receipt password.</p><div class="buttons"><button class="disabled" disabled type="button">Checkout unavailable until launch</button><a class="store-fallback" href="__PAGE_URL_ai__">Compare SlessBox editions</a></div></section></div></main>`,
  download: `<main id="download-main"><section class="hero"><div class="wrap"><p class="eyebrow">SlessBox · Protected delivery staging</p><h1>SLESSBOX DOWNLOAD</h1><p class="sub">Existing native protected installer · owner verification only.</p></div></section><div class="wrap"><section class="panel"><h2>Protected owner verification</h2><p>The installer already exists in WordPress Download Manager. Use the existing native control and the password provided for owner verification; no duplicate upload or public installer URL is needed.</p>[wpdm_package id="${protectedPackageId}" template="link-template-default"]<div class="security"><strong>Customer downloads remain closed.</strong> Native password protection is not yet connected to WooCommerce paid-order permissions. Paid-tier activation is not implemented.</div><p>After paid delivery is configured and launch is approved, eligible paid orders should receive their own download links. No shared Stripe receipt password is promised.</p><p>Mailchimp signup requires email confirmation. Automatic Lite installer delivery after confirmation remains pending.</p></section></div></main>`,
  "thank-you": `<main id="thanks-main"><div class="wrap"><p class="eyebrow">SlessBox · Confirmation staging</p><h1>ORDER NEXT STEPS</h1><p>This draft is not evidence of payment or a completed order.</p><p>After checkout and protected delivery are launched, eligible paid orders will receive their download links through WooCommerce order email. No shared receipt password is configured or promised.</p><p>Mailchimp email signup requires confirmation. Lite installer delivery is not yet connected.</p></div></main>`,
};
for (const name of sourceIds) {
  let content = await readFile(`${root}/${name}.html`, "utf8");
  if (name === "ai") {
    content = updateTierCard(content, "Lite", [
      "Basic local model included (Mistral 7B or similar lightweight model)",
      "Runs 100% offline on Windows 10/11",
      "Unlimited chats, no subscription",
      "Basic chat history",
      "Community support only",
      "Free download; email required",
    ]);
    content = updateTierCard(content, "Pro", [
      "One-click installer for Windows",
      "Multi-document chat with source citations",
      "Project workspaces for saved documents",
      "Reusable prompt templates",
      "Polished document exports",
      "Commercial use license included",
      "Email support",
      "1 year of free updates",
    ]);
    content = updateTierCard(content, "Studio", [
      "Everything in Pro",
      "Searchable document libraries",
      "Batch generation for social posts from your documents",
      "Reusable multi-step workflows",
      "Priority email support",
      "Lifetime updates",
    ]);
    content = updateTierComparison(content);
    content = content.replace("</h1><p class=\"copy\">", "</h1><p class=\"draft-note\">Staging only: paid-tier activation and automatic installer delivery are not implemented. Products remain unavailable for purchase.</p><p class=\"copy\">");
    const oldButton = /<button[^>]*data-sless-placeholder="STRIPE_LITE_URL"[^>]*>.*?<\/button><p class="draft-note">.*?<\/p>/s;
    if (!oldButton.test(content)) throw new Error("Lite placeholder not found");
    content = content.replace(oldButton,
      `<a class="btn" href="${signup.href}" target="_blank" rel="noopener noreferrer">Join the Sless Brand email list</a><p class="draft-note">Opens Mailchimp's signup form. Confirm your email to join; unsubscribe anytime. Lite installer delivery is not connected yet.</p>`);
    content = content.replace("Draft placeholder — Stripe checkout is not connected.",
      "Test-mode WooCommerce product prepared. Checkout remains unavailable while the product is a draft.");
    content = content.replace("Draft placeholder — Stripe checkout is not connected.",
      "Test-mode WooCommerce product prepared. Checkout remains unavailable while the product is a draft.");
  } else {
    if (!/<main\b[\s\S]*?<\/main>/.test(content)) throw new Error("Page main content not found");
    content = content.replace(/<main\b[\s\S]*?<\/main>/, bodies[name]);
  }
  content = content.replace(/__PAGE_URL_([\w-]+)__/g, (_, page) => {
    if (!manifest[page]?.url) throw new Error("Unresolved page navigation");
    return manifest[page].url;
  });
  const slug = `slessbox-${name}-staging`;
  const matches = await wp(`wp/v2/pages?slug=${slug}&status=draft&context=edit`);
  const anyStatus = await wp(`wp/v2/pages?slug=${slug}&context=edit`);
  if (anyStatus.some(p => p.status === "publish")) throw new Error("Staging slug is already public; no overwrite allowed");
  if (matches.length > 1) throw new Error("Duplicate staging pages");
  let page = matches[0];
  if (stage) {
    const payload = { title: `SlessBox ${name} — staging`, slug, content, status: "draft" };
    page = await wp(page ? `wp/v2/pages/${page.id}` : "wp/v2/pages", "POST", payload);
    await mkdir(`${root}/staging`, { recursive: true });
    await writeFile(`${root}/staging/${name}.html`, content);
  }
  if (!page) throw new Error("Staging page missing");
  const checked = await wp(`wp/v2/pages/${page.id}?context=edit`);
  if (checked.status !== "draft" || checked.content.raw !== content) throw new Error("Draft page content failed verification");
  if (name === "ai" && (!checked.content.rendered.includes(signup.href) ||
      !checked.content.rendered.includes("source citations") ||
      !checked.content.rendered.includes("multi-step workflows") ||
      !checked.content.rendered.includes("paid-tier activation and automatic installer delivery are not implemented"))) {
    throw new Error("Signup link, proposed tier benefits, or non-release warning missing from rendered draft");
  }
  if (name === "download" && (!checked.content.rendered.includes("Customer downloads remain closed") ||
      !/wpdmdl|wpdm-download-link/.test(checked.content.rendered))) {
    throw new Error("Native protected control or closed-delivery warning missing from rendered draft");
  }
  receipt.pages.push({ id: checked.id, name, status: checked.status, editUrl: `${origin}/wp-admin/post.php?post=${checked.id}&action=edit` });
  await saveReceipt();
}
for (const before of baseline) {
  const after = await wp(`wp/v2/pages/${before.id}?context=edit`);
  if (after.status !== before.status || hash(after.content.raw) !== before.hash) throw new Error("Original public page changed during staging; investigate");
}
receipt.originalsUnchanged = true;
receipt.verifiedAt = new Date().toISOString();
await saveReceipt();
console.log(JSON.stringify(receipt, null, 2));
