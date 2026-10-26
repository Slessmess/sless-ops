import test from "node:test";
import assert from "node:assert/strict";
import { isOpsAdministrator } from "./ops-access";

const config = { emails: " Owner@example.test " };
const identity = {
  id: "user_owner",
  primaryEmailAddressId: "email_owner",
  emailAddresses: [{
    id: "email_owner", emailAddress: "OWNER@example.test",
    verification: { status: "verified" },
  }],
};

test("owner access requires a server-verified primary email in the current instance", async () => {
  assert.equal(await isOpsAdministrator(identity.id, config, async () => identity), true);
  assert.equal(await isOpsAdministrator(identity.id, config, async () => ({
    ...identity, emailAddresses: [{ ...identity.emailAddresses[0]!, verification: { status: "unverified" } }],
  })), false);
  assert.equal(await isOpsAdministrator(identity.id, config, async () => ({
    ...identity, primaryEmailAddressId: "different_primary",
  })), false);
  assert.equal(await isOpsAdministrator("different_user", config, async () => identity), false);
  assert.equal(await isOpsAdministrator(identity.id, { emails: "other@example.test" }, async () => identity), false);
});

test("empty configuration denies without lookup; existing ID allowlists remain supported", async () => {
  const unexpected = async (): Promise<never> => { throw new Error("Unexpected lookup"); };
  assert.equal(await isOpsAdministrator(identity.id, {}, unexpected), false);
  assert.equal(await isOpsAdministrator(identity.id, { userIds: " other, user_owner " }, unexpected), true);
});

test("identity-provider failures propagate rather than granting access", async () => {
  await assert.rejects(isOpsAdministrator(identity.id, config, async () => {
    throw new Error("Provider unavailable");
  }), /Provider unavailable/);
});
