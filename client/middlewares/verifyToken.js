// middlewares/verifyToken.js

import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const accessToken = req.cookies.accessToken; // ✅ შეცვლილია token-იდან accessToken-ზე

  if (!accessToken) {
    return res.status(401).json({ message: "Access Denied: No token provided" });
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    req.user = decoded; // 👉 მომხმარებლის მონაცემები ვამაგრებთ req.user-ზე
    next();
  } catch (err) {
    // ✅ Token-ის ვადა გაუვიდა - frontend-მა უნდა გამოიძახოს /refresh
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ 
        message: "Token expired",
        code: "TOKEN_EXPIRED" // Frontend-მა ამ code-ის მიხედვით იცის რომ refresh უნდა გააკეთოს
      });
    }
    return res.status(403).json({ message: "Invalid token" });
  }
};