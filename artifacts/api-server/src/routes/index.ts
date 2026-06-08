import { Router, type IRouter } from "express";
import healthRouter from "./health";
import financeRouter from "./finance";
import authRouter from "./auth";
import tradesRouter from "./trades";

const router: IRouter = Router();

router.use(healthRouter);
router.use(financeRouter);
router.use(authRouter);
router.use(tradesRouter);

export default router;
