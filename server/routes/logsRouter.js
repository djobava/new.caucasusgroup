import express from "express";
import { getLogs } from "../controllers/logsController.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/logs
router.get("/", verifyToken, requireRole(["sa"]), getLogs);

export default router;
