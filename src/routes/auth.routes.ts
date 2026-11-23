import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import * as controller from "../controllers/auth.controller";

const router = Router();
router.get("/providers", controller.providers);
router.get("/me", isAuthenticated, controller.me);

export default router;
