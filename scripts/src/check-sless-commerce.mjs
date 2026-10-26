import { writeFile } from "node:fs/promises";

// A readiness check, not a transaction test. Never creates orders, publishes
// products, submits a card, sends emails, or starts Printify production.
const configure = process.argv.includes("--configure-notifications");
const origin = new URL(process.env.WP_URL || "https://slessismore.org").origin;
if (!process.env.WP_USER || !process.env.WP_APP_PASSWORD) {
  throw new Error("WordPress credentials unavailable");
}
const headers = {
  Authorization: `Basic ${Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64")}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};
async function request(path, method = "GET", body) {
  const response = await fetch(`${origin}/wp-json/${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    redirect: "error", signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`WordPress ${method} failed (${response.status}). Reconcile writes before retrying.`);
  return { data: await response.json(), total: Number(response.headers.get("x-wp-total") || 0) };
}
function option(settings, id) {
  return settings.find(item => item.id === id)?.value;
}
let newOrder = (await request("wc/v3/settings/email_new_order")).data;
if (configure && !option(newOrder, "recipient")) {
  // Use the site's existing administrator, never invent or print an address.
  const settings = (await request("wp/v2/settings")).data;
  const recipient = settings.email || settings.admin_email;
  if (typeof recipient !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
    throw new Error("Existing site administrator email is unavailable; no notification update made");
  }
  await request("wc/v3/settings/email_new_order/recipient", "PUT", { value: recipient });
  newOrder = (await request("wc/v3/settings/email_new_order")).data;
  if (option(newOrder, "recipient") !== recipient) throw new Error("Notification recipient update was not confirmed");
}
const [gateway, keyState, products, downloadSettings, processingEmail, completedEmail, hooks, orders, downloadPage] =
  await Promise.all([
    request("wc/v3/payment_gateways/stripe"),
    request("wc/v3/wc_stripe/account_keys"),
    request("wc/v3/products?sku=SLESSBOX-PRO,SLESSBOX-STUDIO&status=any"),
    request("wc/v3/settings/products"),
    request("wc/v3/settings/email_customer_processing_order"),
    request("wc/v3/settings/email_customer_completed_order"),
    request("wc/v3/webhooks?per_page=100"),
    request("wc/v3/orders?per_page=1"),
    request("wp/v2/pages/153?context=edit"),
  ]);
const stripe = gateway.data;
// This controller masks key values. Report only existence, never key material.
const keys = keyState.data;
const payment = {
  enabled: stripe.enabled,
  testMode: stripe.settings?.testmode?.value === "yes",
  testPublishableKeyConfigured: Boolean(keys.test_publishable_key),
  testSecretKeyConfigured: Boolean(keys.test_secret_key),
  testWebhookConfigured: Boolean(keys.test_webhook_secret),
};
const digital = {
  existingProtectedPackageObserved: /\[wpdm_package\s+id=["']\d+["']/.test(downloadPage.data.content?.raw || "") &&
    /wpdmdl|wpdm-download-link/.test(downloadPage.data.content?.rendered || ""),
  method: option(downloadSettings.data, "woocommerce_file_download_method"),
  insecureRedirectFallback: option(downloadSettings.data, "woocommerce_downloads_redirect_fallback_allowed") === "yes",
  accessAfterPayment: option(downloadSettings.data, "woocommerce_downloads_grant_access_after_payment") === "yes",
  products: products.data.map(product => ({
    id: product.id, name: product.name, status: product.status,
    downloadable: product.downloadable,
    fileCount: product.downloads?.length || 0,
    wooUploadPathsOnly: Boolean(product.downloads?.length) &&
      product.downloads.every(file => {
        try {
          const url = new URL(file.file);
          return url.origin === origin && url.pathname.includes("/woocommerce_uploads/");
        } catch { return false; }
      }),
  })),
};
const fulfillmentHooks = hooks.data.filter(hook => hook.status === "active" &&
  /order_status_processing|order\.created|order\.updated/.test(hook.topic));
const blockers = [];
if (!payment.testMode || !payment.testPublishableKeyConfigured || !payment.testSecretKeyConfigured) {
  blockers.push("Stripe test checkout is not configured: test keys are missing or test mode is off.");
}
if (!payment.testWebhookConfigured) blockers.push("Stripe test webhook is not configured.");
if (digital.method !== "force" || digital.insecureRedirectFallback) {
  blockers.push("Download handler is not configured for force downloads without redirect fallback.");
}
if (digital.products.length !== 2 || digital.products.some(p => !p.downloadable || !p.fileCount || !p.wooUploadPathsOnly)) {
  blockers.push("The existing protected installer is not yet connected to WooCommerce paid-order delivery.");
}
blockers.push("Paid-tier activation is not implemented; do not claim Pro/Studio feature delivery is ready.");
if (fulfillmentHooks.length) {
  blockers.push("An active order-processing webhook may trigger production fulfillment; isolate it before a test order.");
}
if (digital.products.some(p => p.status === "draft")) {
  blockers.push("Draft products are not publicly purchasable; do not publish them without authorization.");
}
const report = {
  checkedAt: new Date().toISOString(),
  payment,
  notifications: {
    ownerNewOrderEnabled: option(newOrder, "enabled") === "yes",
    ownerRecipientConfigured: Boolean(option(newOrder, "recipient")),
    customerProcessingEnabled: option(processingEmail.data, "enabled") === "yes",
    customerCompletedEnabled: option(completedEmail.data, "enabled") === "yes",
    emailReceiptObserved: false,
  },
  digital,
  fulfillment: {
    activeProcessingHooks: fulfillmentHooks.map(hook => ({ id: hook.id, topic: hook.topic })),
    productionSafetyConfirmed: false,
  },
  orderCount: orders.total,
  transactionTestRun: false,
  realPayoutVerified: false,
  blockers,
};
await writeFile("wordpress/sless-refresh/commerce-readiness.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
