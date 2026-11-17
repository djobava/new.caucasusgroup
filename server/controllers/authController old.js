// authController.js
import { db } from "../config/config.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/** ───────────────────────── Cookie options ───────────────────────── **/
let COOKIE_SAMESITE =
  process.env.COOKIE_SAMESITE ||
  (process.env.NODE_ENV === "production" ? "None" : "None"); // dev -> Lax by default

// Safety: if SameSite=None is requested but we're not in production/HTTPS, override to Lax
if (COOKIE_SAMESITE.toLowerCase() === "none" && process.env.NODE_ENV !== "production") {
  console.warn(
    'COOKIE_SAMESITE="None" requested but not in production. Overriding to "Lax" to avoid browser blocking.'
  );
  COOKIE_SAMESITE = "None";
}
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;  // напр: ".caucasusgroup.com"
const BASE_COOKIE = {
  httpOnly: true,
  // secure must be true when SameSite=None. Keep secure true only in production unless you run HTTPS locally.
  secure: process.env.NODE_ENV === "production",
  sameSite: COOKIE_SAMESITE,
  path: "/",
  domain: COOKIE_DOMAIN,
};

const ACCESS_COOKIE_OPTS  = { ...BASE_COOKIE, maxAge: 15 * 60 * 1000 };           // 15 წუთი
const REFRESH_COOKIE_OPTS = { ...BASE_COOKIE, maxAge: 7 * 24 * 60 * 60 * 1000 };  // 7 დღე

const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });

const signRefresh = (payload) =>
  jwt.sign(payload, process.env.REFRESH_SECRET, { expiresIn: "7d" });

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // true only in prod (HTTPS)
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    path: "/",
    domain: process.env.COOKIE_DOMAIN || "localhost",
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTS);
};

/** ───────────────────────── Register ───────────────────────── **/
export const register = async (req, res) => {
  try {
    let { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email და password სავალდებულოა" });
    }

    email = email.trim().toLowerCase();

    // ✅ ელფოსტის დუბლიკის შემოწმება
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const q = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
    await db.query(q, [name, email, hashedPassword, role || "user"]);

    return res.status(201).json({ message: "User registered" });
  } catch (err) {
    // თუ users.email UNIQUE-ია და მაინც დაჯდათ დუბლიკატი:
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already registered" });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

/** ───────────────────────── Login ───────────────────────── **/
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // JWT payload-ში დავამატე name-იც, რომ /check-ზე გქონდეს
    const payload = { id: user.id, email: user.email, role: user.role, name: user.name };

    const accessToken  = signAccess(payload);
    const refreshToken = signRefresh(payload);

    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({
      message: "Login successful",
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error: " + err.message });
  }
};

/** ───────────────────────── Refresh Access Token ───────────────────────── **/
export const refreshToken = (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ message: "Refresh token missing" });
  }

  jwt.verify(token, process.env.REFRESH_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // გამოვუშვათ ახალი accessToken და სურვილისამებრ — rotate refreshToken-იც
    const newAccessToken  = signAccess({ id: payload.id, email: payload.email, role: payload.role, name: payload.name });
    const newRefreshToken = signRefresh({ id: payload.id, email: payload.email, role: payload.role, name: payload.name });

    setAuthCookies(res, newAccessToken, newRefreshToken);

    return res.json({ message: "Access token refreshed" });
  });
};

/** ───────────────────────── Logout ───────────────────────── **/
export const logout = (req, res) => {
  // ქუქის გასათიშად საჭიროა იგივე sameSite/secure/domain პარამეტრები
  res.clearCookie("accessToken",  { ...ACCESS_COOKIE_OPTS });
  res.clearCookie("refreshToken", { ...REFRESH_COOKIE_OPTS });
  return res.status(200).json({ message: "Logged out" });
};

/** ───────────────────────── Check (needs auth middleware) ───────────────────────── **/
export const check = (req, res) => {
  // req.user-ს უნდა ავსებდეს auth middleware accessToken-იდან
  return res.json({
    email: req.user.email,
    role: req.user.role,
    name: req.user.name,
  });
};
