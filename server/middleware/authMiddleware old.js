// authMiddleware.js
import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.cookies.accessToken; // ⬅️ consistent name
  if (!token) return res.status(403).json({ message: "Access Denied" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ message: "Invalid token" });
    req.user = user;
    console.log("Authenticated user:", user);
    next();
  });
};


export const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (req.user.role === "admin") return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient role" });
    }
    next();
  };
};

