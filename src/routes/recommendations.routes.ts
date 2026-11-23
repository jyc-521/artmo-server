import { Router } from "express";
import { isAuthenticated, optionalAuth } from "../middleware/auth.middleware";
import { dailyLimit } from "../middleware/rateLimit.middleware";
import * as controller from "../controllers/recommendations.controller";

const router = Router();
router.post("/", optionalAuth, dailyLimit, controller.create);
router.get("/me", isAuthenticated, controller.mine);
router.get("/:id", optionalAuth, controller.get);
router.post("/:id/share", controller.share);

export default router;
