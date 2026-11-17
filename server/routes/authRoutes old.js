import express from "express";
import { login, register,refreshToken, check ,logout } from "../controllers/authController.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", verifyToken, check);
router.post("/register", register);
router.post("/logout", logout);
router.post("/refresh", refreshToken);

router.get("/protected", verifyToken, (req, res) => {
  res.json({ message: "Protected content", user: req.user });
});

router.get("/admin-only", verifyToken, requireRole(["admin", "sa"]), (req, res) => {
  res.json({ message: "Welcome admin!" });
});

export default router;
