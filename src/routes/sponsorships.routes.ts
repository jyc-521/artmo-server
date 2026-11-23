import { Router } from "express";
import { isAuthenticated, requireAdmin } from "../middleware/auth.middleware";
import * as controller from "../controllers/sponsorships.controller";

const router = Router();
router.post("/", isAuthenticated, controller.create);
router.get("/me", isAuthenticated, controller.mine);
router.get("/", isAuthenticated, requireAdmin, controller.list);
router.post("/:id/approve", isAuthenticated, requireAdmin, controller.approve);
router.put("/:id", isAuthenticated, requireAdmin, controller.reject);

export default router;
