import { Router } from "express";
import { isAuthenticated, requireAdmin } from "../middleware/auth.middleware";
import * as controller from "../controllers/artworks.controller";

const router = Router();
router.get("/", controller.list);
router.get("/popular", controller.popular);
router.get("/tags", controller.tags);
router.get("/saved", isAuthenticated, controller.saved);
router.get("/:id", controller.get);
router.post("/", isAuthenticated, requireAdmin, controller.create);
router.put("/:id", isAuthenticated, requireAdmin, controller.update);
router.delete("/:id", isAuthenticated, requireAdmin, controller.remove);
router.post("/:id/save", isAuthenticated, controller.save);
router.delete("/:id/save", isAuthenticated, controller.unsave);

export default router;
