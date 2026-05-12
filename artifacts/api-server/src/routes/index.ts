import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import paymentsRouter from "./payments";
import pharmacyRouter from "./pharmacy";
import medicationRouter from "./medication";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/payments", paymentsRouter);
router.use("/pharmacy", pharmacyRouter);
router.use("/medication", medicationRouter);

export default router;
