import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const php = readFileSync("wordpress/sless-refresh/marketing-consent.php", "utf8");
const bridge = php.match(/<script id="sless-consent-bridge">([\s\S]*?)<\/script>/)[1]
  .replace(/<\?php[\s\S]*?\?>/g, "false");

function browser(initial = {}, privacy = {}) {
  const cookies = new Map(Object.entries(initial));
  const listeners = new Map();
  const signals = [];
  const pixel = [];
  const reloads = [];
  const document = {
    addEventListener(name, callback) {
      listeners.set(name, [...(listeners.get(name) || []), callback]);
    },
    querySelector() { return null; },
    get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join("; "); },
    set cookie(value) {
      const [pair] = value.split(";");
      const [key, val] = pair.split("=");
      if (/Max-Age=0/.test(value)) cookies.delete(key);
      else cookies.set(key, val);
    },
  };
  const context = {
    document,
    navigator: privacy,
    location: { hostname: "slessismore.org", reload() {} },
    setTimeout(callback) { reloads.push(callback); },
    gtag(...args) { signals.push(args); },
    fbq(...args) { pixel.push(args); },
    // The bridge must not mistake the API's pre-initialization default for opt-in.
    wp_has_consent() { return true; },
  };
  context.window = context;
  vm.runInNewContext(bridge, context);
  return {
    cookies, signals, pixel, reloads,
    fire(name, detail = {}) {
      for (const callback of listeners.get(name) || []) callback(detail);
    },
    lastConsent() { return signals.filter(x => x[0] === "consent").at(-1)[2]; },
  };
}

test("no explicit opt-in remains denied despite the Consent API default", () => {
  const b = browser();
  assert.equal(b.lastConsent().analytics_storage, "denied");
  assert.equal(b.lastConsent().ad_storage, "denied");
});

test("statistics is granted at the before-category hook, without granting ads", () => {
  const b = browser();
  b.cookies.set("cmplz_statistics", "allow");
  b.fire("cmplz_before_category");
  assert.equal(b.lastConsent().analytics_storage, "granted");
  assert.equal(b.lastConsent().ad_storage, "denied");
});

test("denial clears optional identifiers without clearing the cart", () => {
  const b = browser({
    cmplz_statistics: "allow", cmplz_marketing: "allow",
    _ga: "test", _fbp: "test", woocommerce_cart_hash: "keep",
  });
  b.cookies.set("cmplz_statistics", "deny");
  b.cookies.set("cmplz_marketing", "deny");
  b.fire("cmplz_status_change");
  assert.equal(b.cookies.has("_ga"), false);
  assert.equal(b.cookies.has("_fbp"), false);
  assert.equal(b.cookies.get("woocommerce_cart_hash"), "keep");
  assert.equal(b.reloads.length, 1);
});

test("the Deny click revokes Meta before its bubbling click listener", () => {
  const b = browser({ cmplz_marketing: "allow" });
  b.fire("click", {
    target: { closest: () => ({ classList: { contains: x => x === "cmplz-deny" } }) },
  });
  assert.deepEqual(b.pixel.at(-1), ["consent", "revoke"]);
  assert.equal(b.lastConsent().ad_storage, "denied");
});

test("GPC denies marketing and DNT denies both optional categories", () => {
  const cookies = { cmplz_statistics: "allow", cmplz_marketing: "allow" };
  const gpc = browser(cookies, { globalPrivacyControl: true });
  assert.equal(gpc.lastConsent().analytics_storage, "granted");
  assert.equal(gpc.lastConsent().ad_storage, "denied");
  const dnt = browser(cookies, { doNotTrack: "1" });
  assert.equal(dnt.lastConsent().analytics_storage, "denied");
  assert.equal(dnt.lastConsent().ad_storage, "denied");
});
