// authController.js
import { db } from "../config/config.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createLog } from "./logsController.js";

/**  Cookie options  **/



// ✅ პირდაპირ ვაყენებთ მნიშვნელობებს — NODE_ENV და dynamic logic ამოღებულია
const BASE_COOKIE = {
  httpOnly: true,
  // Enable secure cookies only in production so local dev (HTTP) still works
  secure: process.env.NODE_ENV === "production",
  // Use SameSite=None only in production (requires Secure). Use Lax for local dev over HTTP.
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  path: "/",
};

// ✅ მოკლე ვადიანი cookie-ები (ტესტისთვის ან development)
//const ACCESS_COOKIE_OPTS = { ...BASE_COOKIE, maxAge: 30 * 1000 };           // 30 წამი
//const REFRESH_COOKIE_OPTS = { ...BASE_COOKIE, maxAge: 2 * 60 * 1000 };      // 2 წუთი

const ACCESS_COOKIE_OPTS = { ...BASE_COOKIE, maxAge: 15 * 60 * 1000 };          // 15 წუთი
const REFRESH_COOKIE_OPTS = { ...BASE_COOKIE, maxAge: 7 * 24 * 60 * 60 * 1000 };  // 7 დღე

// ✅ Access/Refresh Token გენერაცია
const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });

const signRefresh = (payload) =>
  jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn: "7d" });

// ✅ Cookie-ების დაყენება response-ზე
const setAuthCookies = (res, accessToken, refreshToken) => {
 // console.log("✅ Setting new cookies");
  res.cookie("accessToken", accessToken, ACCESS_COOKIE_OPTS);
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTS);
};

const getRequestMeta = (req) => {
  const ip = req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.ip
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || "Unknown";
  const device = req.headers?.["user-agent"] || "Unknown";
  return { ip, device };
};








/** ───────────────────────── Helper: Save Refresh Token to DB ───────────────────────── **/
const saveRefreshToken = async (userId, token, req) => {
  const deviceInfo = req?.headers?.["user-agent"] || "Unknown";
  const ipAddress = req?.ip || req?.connection?.remoteAddress || "Unknown";
  // 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Hash the refresh token before storing to protect against DB leaks
  const hashed = await bcrypt.hash(token, 10);

  const q = `
    INSERT INTO refresh_tokens (user_id, token, device_info, ip_address, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `;
  await db.query(q, [userId, hashed, deviceInfo, ipAddress, expiresAt]);
};

/** ───────────────────────── Helper: Delete Refresh Token from DB ───────────────────────── **/
const deleteRefreshToken = async (token) => {
  // Find matching stored (hashed) token and delete by id
  try {
    const decoded = jwt.decode(token);
    if (!decoded?.id) return;
    const userId = decoded.id;

    const [rows] = await db.query(
      "SELECT id, token FROM refresh_tokens WHERE user_id = ?",
      [userId]
    );

    for (const row of rows) {
      const match = await bcrypt.compare(token, row.token);
      if (match) {
        await db.query("DELETE FROM refresh_tokens WHERE id = ?", [row.id]);
        return;
      }
    }
  } catch (err) {
    console.error("deleteRefreshToken error:", err);
  }
};

/** ───────────────────────── Helper: Validate Refresh Token from DB ───────────────────────── **/
const validateRefreshToken = async (token) => {
  // Decode to find user id (we'll still verify signature later)
  const decoded = jwt.decode(token);
  if (!decoded?.id) return null;
  const userId = decoded.id;

  const [rows] = await db.query(
    "SELECT * FROM refresh_tokens WHERE user_id = ? AND expires_at > NOW() AND revoked_at IS NULL",
    [userId]
  );

  for (const row of rows) {
    const match = await bcrypt.compare(token, row.token);
    if (match) return row;
  }
  return null;
};


/** ───────────────────────── Register ───────────────────────── **/
export const register = async (req, res) => {
  try {
    let { name, email, password } = req.body;
    const role = "user";

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email და password სავალდებულოა" });
    }

    email = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const q = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
    const [result] = await db.query(q, [name, email, hashedPassword, role]);
    const userId = result.insertId;
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId,
      action: "register",
      objectType: "user",
      objectId: userId,
      ip,
      device,
      details: `Registered user ${email} role=${role}`,
    });

    return res.status(201).json({ message: "User registered" });
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already registered" });
    }
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/** ───────────────────────── Login ───────────────────────── **/
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
      email.trim().toLowerCase(),
    ]);

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name };

    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    await saveRefreshToken(user.id, refreshToken, req);
    await db.query("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id]);

    setAuthCookies(res, accessToken, refreshToken);
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: user.id,
      action: "login",
      objectType: "session",
      objectId: null,
      ip,
      device,
      details: `User ${user.email} logged in successfully`,
    });

    return res.status(200).json({
      message: "Login successful",
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**  Refresh Access Token (✅ FIXED)  **/

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
    //  console.log("♻️ Refresh token missing");
      return res.status(401).json({ message: "Refresh token missing" });
    }
    console.log("♻️ Refresh token request received");

    // ✅ Check if token exists in database and not expired
    const dbToken = await validateRefreshToken(token);
    if (!dbToken) {
    //  console.log("♻️ Invalid or expired refresh token");
      return res.status(403).json({ message: "Invalid or expired refresh token" });
    }
     // console.log("♻️ Valid refresh token found in DB");

    // ✅ Verify JWT
    let payload;
    try {
      payload = jwt.verify(token, process.env.REFRESH_SECRET);
    } catch (err) {
      // Token signature invalid - revoke the DB entry if we found it earlier
      try {
        if (dbToken?.id) {
          await db.query(
            `UPDATE refresh_tokens SET revoked_at = NOW(), rotation_reason = 'invalid' WHERE id = ?`,
            [dbToken.id]
          );
        }
      } catch (e) {
        console.error("Failed to revoke token row:", e);
      }
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // ✅ Revoke old token
    // Revoke the old refresh token row (we matched it earlier to dbToken)
    if (dbToken?.id) {
      await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW(), rotation_reason = 'refresh' WHERE id = ?`,
        [dbToken.id]
      );
    }

    // ✅ Generate new tokens
    const newAccessToken = signAccess({
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    });

    const newRefreshToken = signRefresh({
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    });

    // ✅ Save new refresh token with linkage to old
    await saveRefreshToken(payload.id, newRefreshToken, req, dbToken.id, "refresh");

    // ✅ Set cookies
    setAuthCookies(res, newAccessToken, newRefreshToken);
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: payload.id,
      action: "refresh_token",
      objectType: "session",
      objectId: null,
      ip,
      device,
      details: `Refreshed access token for ${payload.email}`,
    });

    return res.json({
      message: "Access token refreshed",
      email: payload.email,
      name: payload.name,
      role: payload.role,
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/** ───────────────────────── Logout ───────────────────────── **/
export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    
    if (token) {
      await deleteRefreshToken(token);
    }

    res.clearCookie("accessToken", ACCESS_COOKIE_OPTS);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTS);
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: req.user?.id || null,
      action: "logout",
      objectType: "session",
      objectId: null,
      ip,
      device,
      details: `User logged out`,
    });

    return res.status(200).json({ message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/** ───────────────────────── Logout All Devices ───────────────────────── **/
export const logoutAll = async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);

    res.clearCookie("accessToken", ACCESS_COOKIE_OPTS);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTS);
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: req.user?.id || null,
      action: "logout_all",
      objectType: "session",
      objectId: null,
      ip,
      device,
      details: `User logged out from all devices`,
    });

    return res.status(200).json({ message: "Logged out from all devices" });
  } catch (err) {
    console.error("Logout all error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/** ───────────────────────── Get Active Sessions ───────────────────────── **/
export const getActiveSessions = async (req, res) => {
  try {
    const userId = req.user.id;

    const [sessions] = await db.query(
      `SELECT id, device_info, ip_address, created_at, expires_at 
       FROM refresh_tokens 
       WHERE user_id = ? AND expires_at > NOW() AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({ sessions });
  } catch (err) {
    console.error("Get sessions error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/** ───────────────────────── Delete Specific Session ───────────────────────── **/
export const deleteSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    await db.query(
      "DELETE FROM refresh_tokens WHERE id = ? AND user_id = ?",
      [sessionId, userId]
    );

    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId,
      action: "delete_session",
      objectType: "session",
      objectId: sessionId,
      ip,
      device,
      details: `Deleted session ${sessionId}`,
    });

    return res.json({ message: "Session deleted" });
  } catch (err) {
    console.error("Delete session error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/** ───────────────────────── Check ───────────────────────── **/
export const check = (req, res) => {
  return res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    name: req.user.name,
  });
};

/** ───────────────────────── Cleanup Expired Tokens (Cron Job) ───────────────────────── **/
export const cleanupExpiredTokens = async () => {
  try {
    const [result] = await db.query(`
      DELETE FROM refresh_tokens 
      WHERE expires_at < NOW() OR revoked_at IS NOT NULL
    `);
    // console.log(`🧹 Cleaned up ${result.affectedRows} tokens`);
  } catch (err) {
    console.error("Cleanup error:", err);
  }
};
