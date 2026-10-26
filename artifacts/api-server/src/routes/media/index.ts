import { Router, type IRouter } from "express";
import { GetMediaPlansResponse } from "@workspace/api-zod";
import { mediaPlans } from "../../lib/media-service";
import { requireMediaUser } from "../../lib/media-access";
import profileRouter from "./profile";
import assetsRouter from "./assets";
import contentRouter from "./content";
import leadsRouter from "./leads";
import adminRouter from "./admin";

const router: IRouter = Router();
router.get("/media/plans", (_req, res) => { res.json(GetMediaPlansResponse.parse(mediaPlans)); });
// Tracking redirect is intentionally public. All workspace data is private.
router.use(leadsRouter);
router.use("/media", requireMediaUser);
router.use(profileRouter);
router.use(assetsRouter);
router.use(contentRouter);
router.use(adminRouter);
export default router;
