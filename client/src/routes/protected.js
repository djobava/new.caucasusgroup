import express from "express";
import { verifyToken } from "../../middlewares/verifyToken.js";
import { verifyRole } from "../../middlewares/verifyRole.js";

const router = express.Router();

// 🧍 მხოლოდ `user` როლისთვის
router.get("/user-data", verifyToken, verifyRole("user"), (req, res) => {
  res.json({ message: "User content", user: req.user });
});

// 👑 `admin` ან `sa` როლისთვის
router.get("/admin-data", verifyToken, verifyRole(["admin", "sa"]), (req, res) => {
  res.json({ message: "Admin content", user: req.user });
});

export default router;
