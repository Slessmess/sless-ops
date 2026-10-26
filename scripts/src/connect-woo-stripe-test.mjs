import { writeFile } from "node:fs/promises";

// Credentials are relayed inside the runtime only. Never print, save to receipts,
// or place them in source files. No live keys, orders, or products are modified.
const apply = process.argv.includes("--apply");
const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
const identity = process.env.REPL_IDENTITY
  ? `repl ${process.env.REPL_IDENTITY}`
  : process.env.WEB_REPL_RENEWAL ? `depl ${process.env.WEB_REPL_RENEWAL}` : null;
if (!hostname || !identity) throw new Error("Integration identity unavailable");
const connectionResponse = await fetch(
  `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
  { headers: { Accept: "application/json", X_REPLIT_TOKEN: identity }, signal: AbortSignal.timeout(15_000) },
);
if (!connectionResponse.ok) throw new Error(`Integration credential request failed (${connectionResponse.status})`);
const connectionData = await connectionResponse.json();
if (connectionData.items?.length !== 1) throw new Error("Expected one connected Stripe account");
const settings = connectionData.items[0].settings || {};
// The current provisioned connection uses secret/publishable, rather than the
// secret_key/publishable_key shape in the generic Stripe client template.
const secret = settings.secret;
const publishable = settings.publishable;
if (typeof secret !== "string" || !secret.startsWith("sk_test_") ||
    typeof publishable !== "string" || !publishable.startsWith("pk_test_")) {
  throw new Error("Connected credentials are not a supported pair of test keys; no WordPress write made");
}
async function stripeGet(path) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
    redirect: "error", signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Stripe verification failed (${response.status})`);
  return response.json();
}
const [balance, account] = await Promise.all([stripeGet("balance"), stripeGet("account")]);
if (balance.livemode !== false || account.id !== settings.account_id) {
  throw new Error("Connected test-account identity failed verification");
}
const origin = new URL(process.env.WP_URL || "https://slessismore.org").origin;
if (!process.env.WP_USER || !process.env.WP_APP_PASSWORD) throw new Error("WordPress credentials unavailable");
const headers = {
  Authorization: `Basic ${Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString("base64")}`,
  Accept: "application/json", "Content-Type": "application/json",
};
async function wp(path, method = "GET", data) {
  const response = await fetch(`${origin}/wp-json/${path}`, {
    method, headers, body: data ? JSON.stringify(data) : undefined,
    redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`WordPress ${method} failed (${response.status}); reconcile before retrying writes`);
  return response.json();
}
const before = await wp("wc/v3/payment_gateways/stripe");
if (before.settings?.testmode?.value !== "yes") throw new Error("WooCommerce must already be in approved test mode");
const liveFields = ["publishable_key", "secret_key", "webhook_secret"];
const liveBefore = liveFields.map(field => before.settings?.[field]?.value);
if (apply) {
  const current = await wp("wc/v3/wc_stripe/account_keys");
  // The controller returns masked keys. Do not replace a preexisting test
  // connection automatically; use the configured account endpoint to reconcile.
  if (current.test_secret_key || current.test_publishable_key) {
    const configured = await wp("wc/v3/wc_stripe/account");
    const configuredId = configured.id || configured.account_id;
    if (configuredId !== account.id) throw new Error("A test connection already exists; reconcile its account before changing it");
  } else {
    await wp("wc/v3/wc_stripe/account_keys", "POST", {
      test_secret_key: secret,
      test_publishable_key: publishable,
    });
  }
  const keyState = await wp("wc/v3/wc_stripe/account_keys");
  if (!keyState.test_webhook_secret) {
    await wp("wc/v3/wc_stripe/account_keys/configure_webhooks", "POST", { live_mode: false });
  }
}
const after = await wp("wc/v3/payment_gateways/stripe");
const keyState = await wp("wc/v3/wc_stripe/account_keys");
const unchanged = liveFields.every((field, index) => after.settings?.[field]?.value === liveBefore[index]);
if (!unchanged) throw new Error("Live credential settings changed unexpectedly; investigate before further work");
const report = {
  verifiedAt: new Date().toISOString(),
  connectedStripeEnvironment: "test",
  sourceAccountVerified: true,
  wooTestMode: after.settings?.testmode?.value === "yes",
  wooTestPublishableKeyConfigured: Boolean(keyState.test_publishable_key),
  wooTestSecretKeyConfigured: Boolean(keyState.test_secret_key),
  wooTestWebhookConfigured: Boolean(keyState.test_webhook_secret),
  liveCredentialSettingsUnchanged: unchanged,
  transactionTestRun: false,
  realFundsTransferred: false,
};
if (apply && (!report.wooTestPublishableKeyConfigured || !report.wooTestSecretKeyConfigured ||
    !report.wooTestWebhookConfigured)) throw new Error("Test connection setup incomplete");
await writeFile("wordpress/sless-refresh/stripe-test-connection.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
