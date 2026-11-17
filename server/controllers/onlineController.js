import { db } from "../config/config.js";
import { io } from "../index.js";

// ─── Connect: save to online_users + open session ───────────────────────────
export const saveSocketId = async (userId, socketId) => {
  try {
    await db.query(`
      INSERT INTO online_users (user_id, socket_id, connected_at, last_seen)
      VALUES (?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE socket_id = VALUES(socket_id), connected_at = NOW(), last_seen = NOW()
    `, [userId, socketId]);

    // Open a new session row
    await db.query(`
      INSERT INTO user_sessions (user_id, socket_id, connected_at)
      VALUES (?, ?, NOW())
    `, [userId, socketId]);
  } catch (err) {
    console.error("❌ saveSocketId error:", err);
  }
};

// ─── Disconnect: remove from online_users + close session ───────────────────
export const removeSocketId = async (socketId) => {
  try {
    // Close the open session
    await db.query(`
      UPDATE user_sessions
      SET disconnected_at = NOW(),
          duration_seconds = TIMESTAMPDIFF(SECOND, connected_at, NOW())
      WHERE socket_id = ? AND disconnected_at IS NULL
    `, [socketId]);

    await db.query("DELETE FROM online_users WHERE socket_id = ?", [socketId]);
  } catch (err) {
    console.error("❌ removeSocketId error:", err);
  }
};

// ─── GET /api/online — current online list (excluding super admins) ─────────
export const getOnlineUsers = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, o.connected_at
      FROM users u
      JOIN online_users o ON u.id = o.user_id
      WHERE u.role <> 'sa'
      ORDER BY o.connected_at ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ getOnlineUsers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── GET /api/online/stats — per-user session stats, excluding super admins ─
export const getOnlineStats = async (req, res) => {
  try {
    // Summary per user
    const [summary] = await db.query(`
      SELECT
        u.id, u.name, u.email, u.role,
        COUNT(s.id)                                        AS total_sessions,
        CAST(COALESCE(SUM(s.duration_seconds), 0) AS UNSIGNED)               AS total_seconds,
        CAST(COALESCE(SUM(CASE WHEN s.connected_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                          THEN s.duration_seconds ELSE 0 END), 0) AS UNSIGNED) AS week_seconds,
        CAST(COALESCE(SUM(CASE WHEN s.connected_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                          THEN s.duration_seconds ELSE 0 END), 0) AS UNSIGNED) AS month_seconds,
        MAX(s.connected_at)                                AS last_seen
      FROM users u
      LEFT JOIN user_sessions s ON u.id = s.user_id AND s.disconnected_at IS NOT NULL
      WHERE u.role <> 'sa'
      GROUP BY u.id
      ORDER BY total_seconds DESC
    `);

    // Last sessions for non-superadmin users
    const [sessions] = await db.query(`
      SELECT s.id, s.user_id, s.connected_at, s.disconnected_at, s.duration_seconds
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.disconnected_at IS NOT NULL AND u.role <> 'sa'
      ORDER BY s.connected_at DESC
      LIMIT 200
    `);

    res.json({ summary, sessions });
  } catch (err) {
    console.error("❌ getOnlineStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── Used internally by index.js: broadcast non-superadmin users only ───────
export const fetchOnlineUsers = async () => {
  const [rows] = await db.query(`
    SELECT u.id, u.name, u.email, u.role, o.connected_at
    FROM users u
    JOIN online_users o ON u.id = o.user_id
    WHERE u.role <> 'sa'
    ORDER BY o.connected_at ASC
  `);
  return rows;
};

// ─── DELETE /api/online/sessions/clear — clear all session history ──────────
export const clearSessionHistory = async (req, res) => {
  try {
    await db.query(`DELETE FROM user_sessions`);
    res.json({ message: "Session history cleared successfully" });
  } catch (err) {
    console.error("❌ clearSessionHistory error:", err);
    res.status(500).json({ message: "Failed to clear session history" });
  }
};

// ─── POST /api/online/:userId/kick-off — kick off a user (admins only) ──────
export const kickOffUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user to be kicked exists and their role
    const [userRows] = await db.query("SELECT id, role, name FROM users WHERE id = ?", [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser = userRows[0];

    // Super admins (sa) cannot be kicked off
    if (targetUser.role === "sa") {
      return res.status(403).json({ message: "Cannot kick off super admin users" });
    }

    // Remove from online_users
    const [onlineRows] = await db.query("SELECT socket_id FROM online_users WHERE user_id = ?", [userId]);

    if (onlineRows.length === 0) {
      return res.status(400).json({ message: "User is not currently online" });
    }

    const socketId = onlineRows[0].socket_id;

    // Close the session
    await db.query(`
      UPDATE user_sessions
      SET disconnected_at = NOW(),
          duration_seconds = TIMESTAMPDIFF(SECOND, connected_at, NOW())
      WHERE socket_id = ? AND disconnected_at IS NULL
    `, [socketId]);

    // Remove from online_users
    await db.query("DELETE FROM online_users WHERE socket_id = ?", [socketId]);

    // Actually terminate the socket connection
    io.sockets.sockets.get(socketId)?.disconnect(true);

    res.json({ message: `User ${targetUser.name} has been kicked off` });
  } catch (err) {
    console.error("❌ kickOffUser error:", err);
    res.status(500).json({ message: "Failed to kick off user" });
  }
};
