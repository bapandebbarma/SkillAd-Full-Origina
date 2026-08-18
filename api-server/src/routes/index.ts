import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import plansRouter from "./plans.js";
import providersRouter from "./providers.js";
import adminRouter from "./admin.js";
import authRouter from "./auth.js";
import uploadsRouter from "./uploads.js";
import subscriptionsRouter from "./subscriptions.js";
import translationsRouter from "./translations.js";
import conversationsRouter from "./conversations.js";
import reviewsRouter from "./reviews.js";
import adminSubscriptionsRouter from "./admin-subscriptions.js";
import earningsRouter from "./earnings.js";
import landingRouter from "./landing.js";
import appReviewsRouter from "./app-reviews.js";
import contactRouter from "./contact.js";
import paymentsRouter from "./payments.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plansRouter);
router.use(providersRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(uploadsRouter);
router.use(subscriptionsRouter);
router.use(translationsRouter);
router.use(conversationsRouter);
router.use(reviewsRouter);
router.use(adminSubscriptionsRouter);
router.use(earningsRouter);
router.use(landingRouter);
router.use(appReviewsRouter);
router.use(contactRouter);
router.use(paymentsRouter);

export default router;
