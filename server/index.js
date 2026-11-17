import dotenv from "dotenv";
dotenv.config(); // ✅ მხოლოდ ერთი .env ფაილი root-დან

import { config } from './config/config.js';
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import cron from "node-cron";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

// Routes
import authRoutes from "./routes/authRoutes.js";
import UsersRouter from "./routes/UsersRouter.js";
import driverRouter from "./routes/driverRouter.js";
import dashboardRouter from "./routes/dashboardRouter.js";
import groupRouter from "./routes/groupRouter.js";
import onlineRouter from "./routes/onlineRouter.js";
import hrRouter from "./routes/hrRouter.js";
import billingRouter from "./routes/billingRouter.js";
import logsRouter from "./routes/logsRouter.js";
import healthRouter from "./routes/healthRouter.js";

// Cron Jobs
import driverInsuranceCron from "./cron/driverInsurance.js";
import { cleanupExpiredTokens } from "./controllers/authController.js";
import { saveSocketId, removeSocketId, fetchOnlineUsers } from "./controllers/onlineController.js";

const app = express();
const server = http.createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../client/dist");

// ✅ Socket.IO setup
export const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173", // ✅ .env-ით კონტროლირებადი
    credentials: true,
    sameSite: "None",
    secure: true,
    httpOnly: true,

  },
});

// ✅ Middleware
const getCookie = (cookieHeader, name) => {
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator === -1) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
  }
  return null;
};

io.use((socket, next) => {
  const token = getCookie(socket.handshake.headers.cookie, "accessToken");
  if (!token) return next(new Error("Unauthorized"));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return next(new Error("Unauthorized"));
  }
});

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// ✅ API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", UsersRouter);
app.use("/api/drivers", driverRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/groups", groupRouter);
app.use("/api/online", onlineRouter);
app.use("/api/hr", hrRouter);
app.use("/api/billing", billingRouter);
app.use("/api/logs", logsRouter);
app.use("/api", healthRouter);

// Serve the production React build (single-service mode) only if it exists.
// In the split setup (separate front service) client/dist is absent, so skip it.
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  app.get("/{*path}", (req, res, next) => {
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      return res.status(404).json({ message: "API route not found" });
    }

    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
} else {
  app.use((req, res) => res.status(404).json({ message: "Not found" }));
}

// ✅ Socket.IO connection handler
io.on("connection", (socket) => {
  // Client sends userId after connecting
  socket.on("user_connected", async () => {
    try {
      await saveSocketId(socket.user.id, socket.id);
      const onlineUsers = await fetchOnlineUsers();
      io.emit("onlineUsersUpdated", onlineUsers);
    } catch (err) {
      console.error("user_connected error:", err);
    }
  });

  socket.on("join_room", () => {
    if (socket.user.role === "sa") {
      socket.join("superadmin");
    }
  });

  socket.on("disconnect", async () => {
    try {
      await removeSocketId(socket.id);
      const onlineUsers = await fetchOnlineUsers();
      io.emit("onlineUsersUpdated", onlineUsers);
    } catch (err) {
      console.error("disconnect error:", err);
    }
  });
});

// ✅ Start cron jobs
driverInsuranceCron(io);

// ✅ Cleanup expired tokens hourly
cron.schedule("0 * * * *", () => {
  console.log("🧹 Running cleanup every hour...");
  cleanupExpiredTokens();
});

// ✅ Manual cleanup on server start
cleanupExpiredTokens();

// ✅ Start server
const PORT = config.port || 5000;
server.listen(PORT, () => {
  console.log(`Server v3 running on port ${PORT}`);
});
