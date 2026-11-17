// authMiddleware.js
import jwt from "jsonwebtoken";

// ✅ Access token validation middleware
export const verifyToken = (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.status(401).json({ message: "Access token missing" }); // ✅ 401
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Access token expired or invalid" }); // ✅ 401
    }
    req.user = user;
    next();
  });
};

// ✅ Alias for consistency
export const authenticate = verifyToken;

// ✅ Role-based access control
export const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient role" }); // ✅ 403 stays here
    }
    next();
  };
};
