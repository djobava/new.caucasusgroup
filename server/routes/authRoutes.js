// authRoutes.js
import express from "express";
import {
  register,
  login,
  logout,
  logoutAll,
  refreshToken,
  check,
  getActiveSessions,
  deleteSession,
  cleanupExpiredTokens ,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);

// Protected routes (requires authentication)
router.post("/logout", authenticate, logout);
router.post("/logout-all", authenticate, logoutAll);
router.get("/check", authenticate, check);
router.get("/sessions", authenticate, getActiveSessions);
router.delete("/sessions/:sessionId", authenticate, deleteSession);

export default router;