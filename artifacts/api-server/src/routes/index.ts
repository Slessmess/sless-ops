import { Router, type IRouter } from "express";
import healthRouter from "./health";
import opsRouter from "./ops";
import mediaRouter from "./media";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mediaRouter);
router.use(opsRouter);

export default router;
