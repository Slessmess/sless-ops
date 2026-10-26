import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { isOpsAdministrator } from "../lib/ops-access";

export const requireOpsAdmin: RequestHandler = async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to access operations tasks" });
    return;
  }
  let authorized: boolean;
  try {
    authorized = await isOpsAdministrator(userId, {
      userIds: process.env.SLESS_OPS_ADMIN_USER_IDS,
      emails: process.env.SLESS_OPS_ADMIN_EMAILS,
    }, id => clerkClient.users.getUser(id));
  } catch {
    // Provider outages must not grant access or appear to revoke the owner's role.
    res.status(503).json({ error: "Administrator verification is temporarily unavailable. Try again shortly." });
    return;
  }
  if (!authorized) {
    res.status(403).json({ error: "This account is not an authorized operations administrator" });
    return;
  }
  // Cookie-authenticated writes must originate from this app. Bearer API
  // requests without Origin remain protected by Clerk and the admin allowlist.
  const origin = req.headers.origin;
  if (req.method !== "GET" && req.method !== "HEAD") {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const effectiveHost = (Array.isArray(host) ? host[0] : host)?.split(",")[0]?.trim();
    let allowedOrigin = false;
    try {
      allowedOrigin = origin ? new URL(origin).host === effectiveHost :
        /^Bearer /i.test(req.headers.authorization || "");
    } catch {
      allowedOrigin = false;
    }
    if (!allowedOrigin) {
      res.status(403).json({ error: "Cross-origin operations requests are not allowed" });
      return;
    }
  }
  next();
};