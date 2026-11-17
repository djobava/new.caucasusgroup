import { db } from "../config/config.js";
import bcrypt from "bcryptjs";
import { io } from "../index.js";
import { createLog } from "./logsController.js";

const getRequestMeta = (req) => {
  const ip = req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.ip
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || "Unknown";
  const device = req.headers?.["user-agent"] || "Unknown";
  return { ip, device };
};

// ყველა მომხმარებელი (გარდა sa-ის)
export const getUsers = async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.created_at,
        IFNULL(GROUP_CONCAT(g.name), '') AS group_names
      FROM users u
      LEFT JOIN user_groups ug ON u.id = ug.user_id
      LEFT JOIN \`groups\` g ON ug.group_id = g.id
      WHERE u.role != 'sa'
      GROUP BY u.id
    `);

    const formattedUsers = users.map((user) => ({
      ...user,
      groups: user.group_names ? user.group_names.split(",") : [],
    }));

    io.emit("userListChanged");
    res.status(200).json(formattedUsers);
  } catch (err) {
    console.error("getUsers error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

// მომხმარებლის დამატება (sa როლის გარეშე)
export const addUser = async (req, res) => {
  let { name, email, password, role = "user", groups = [] } = req.body;

  if (!["admin", "user", "hr"].includes(role)) {
    role = "user";
  }

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const [existingUsers] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertQuery = `
      INSERT INTO users (name, email, password, role)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.query(insertQuery, [name, email, hashedPassword, role]);
    const userId = result.insertId;

    if (role !== "admin" && groups.length) {
      const groupInserts = groups.map((groupId) => [userId, groupId]);
      await db.query("INSERT INTO user_groups (user_id, group_id) VALUES ?", [groupInserts]);
    }

    io.emit("userListChanged");
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: req.user?.id || null,
      action: "create_user",
      objectType: "user",
      objectId: userId,
      ip,
      device,
      details: `Created user ${name} <${email}> role=${role}`,
    });
    res.status(201).json({ message: "User added", id: userId });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

// მომხმარებლის განახლება (sa როლის გარეშე)
export const updateUser = async (req, res) => {
  const { name, email, role, password, groups = [] } = req.body;
  const { id } = req.params;

  try {
    const [check] = await db.query("SELECT role FROM users WHERE id = ?", [id]);
    if (check.length && check[0].role === "sa") {
      return res.status(403).json({ message: "Cannot update super admin" });
    }
    if (role === "sa") {
      return res.status(403).json({ message: "Cannot assign super admin role" });
    }

    let updateQuery;
    let updateParams;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateQuery = `
        UPDATE users
        SET name = ?, email = ?, password = ?, role = ?
        WHERE id = ?
      `;
      updateParams = [name, email, hashedPassword, role, id];
    } else {
      updateQuery = `
        UPDATE users
        SET name = ?, email = ?, role = ?
        WHERE id = ?
      `;
      updateParams = [name, email, role, id];
    }

    await db.query(updateQuery, updateParams);
    await db.query("DELETE FROM user_groups WHERE user_id = ?", [id]);

    if (groups.length) {
      const groupInserts = groups.map((groupId) => [id, groupId]);
      await db.query("INSERT INTO user_groups (user_id, group_id) VALUES ?", [groupInserts]);
    }

    io.emit("userListChanged");
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: req.user?.id || null,
      action: "update_user",
      objectType: "user",
      objectId: id,
      ip,
      device,
      details: `Updated user ${id} name=${name} email=${email} role=${role} groups=${groups.length}`,
    });
    res.status(200).json({ message: "User updated" });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

// მომხმარებლის წაშლა (გარდა sa-ის)
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const [check] = await db.query("SELECT role FROM users WHERE id = ?", [id]);
    if (check.length && check[0].role === "sa") {
      return res.status(403).json({ message: "Cannot delete super admin" });
    }

    await db.query("DELETE FROM user_groups WHERE user_id = ?", [id]);
    await db.query("DELETE FROM users WHERE id = ?", [id]);

    io.emit("userListChanged");
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: req.user?.id || null,
      action: "delete_user",
      objectType: "user",
      objectId: id,
      ip,
      device,
      details: `Deleted user id ${id}`,
    });
    res.status(200).json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error: " + err.message });
  }
};
