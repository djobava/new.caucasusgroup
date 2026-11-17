import { db } from "../config/config.js";
import { io } from "../index.js";

// Format date as dd/mm/yyyy hh:mm:ss
const formatDate = (date) => {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
};

// GET /api/logs
export const getLogs = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "sa") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const offset = (page - 1) * limit;

    const filters = [];
    const params = [];
    if (req.query.userId) { filters.push("al.user_id = ?"); params.push(req.query.userId); }
    if (req.query.action) { filters.push("al.action = ?"); params.push(req.query.action); }
    if (req.query.from)   { filters.push("al.created_at >= ?"); params.push(req.query.from); }
    if (req.query.to)     { filters.push("al.created_at <= ?"); params.push(req.query.to); }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT al.id, al.user_id, u.email as username, al.action, al.object_type, al.object_id, 
              al.ip_address, al.device_info, al.details, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${where} ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRes] = await db.query(
      `SELECT COUNT(*) as total FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ${where}`,
      params
    );

    // Format dates before sending
    const formatted = rows.map((r) => ({
      ...r,
      created_at: formatDate(r.created_at),
    }));

    return res.json({ logs: formatted, total: countRes[0].total, page, limit });
  } catch (err) {
    console.error("getLogs error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Helper to create a log entry and emit via Socket.IO
export const createLog = async ({ userId, action, objectType, objectId, ip, device, details }) => {
  try {
    const [result] = await db.query(
      `INSERT INTO audit_logs (user_id, action, object_type, object_id, ip_address, device_info, details, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId || null, action, objectType || null, objectId || null, ip || null, device || null, details || null]
    );

    // Fetch the inserted row with username for socket emit
    const [rows] = await db.query(
      `SELECT al.id, al.user_id, u.email as username, al.action, al.object_type, al.object_id,
              al.ip_address, al.device_info, al.details, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.id = ?`,
      [result.insertId]
    );

    if (rows[0]) {
      const log = { ...rows[0], created_at: formatDate(rows[0].created_at) };
      // Emit only to superadmin room
      io.to("superadmin").emit("new_log", log);
    }
  } catch (err) {
    console.error("createLog error:", err);
  }
};

export default { getLogs, createLog };
