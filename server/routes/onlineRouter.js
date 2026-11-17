import express from "express";
import { getOnlineUsers, getOnlineStats, clearSessionHistory, kickOffUser } from "../controllers/onlineController.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/",      verifyToken, requireRole(["admin", "sa"]), getOnlineUsers);
router.get("/stats", verifyToken, requireRole(["admin", "sa"]), getOnlineStats);
router.delete("/sessions/clear", verifyToken, requireRole(["admin", "sa"]), clearSessionHistory);
router.post("/:userId/kick-off", verifyToken, requireRole(["admin", "sa"]), kickOffUser);

export default router;
