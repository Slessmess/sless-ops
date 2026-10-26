import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { OpsError } from "./lib/ops-types";
import { ZodError } from "zod/v4";
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors());
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof OpsError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Invalid request fields" });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Invalid JSON request body" });
    return;
  }
  if (error?.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large" });
    return;
  }
  req.log.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "Operations API request failed");
  res.status(500).json({ error: "Unable to process the request. Check server configuration and task data." });
};
app.use(errorHandler);

export default app;
