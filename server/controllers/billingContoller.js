import { db } from "../config/config.js";
import { io } from "../index.js";
import { createLog } from "./logsController.js";
import { getRequestMeta } from "../utils/logHelper.js";

// ყველა Billing-ის წამოღება
export const getBilling = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM billing");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error loading Billing" });
  }
};

// კონკრეტული Billing-ის წამოღება ID-ით
export const getBillingById = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM billing WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) return res.status(404).json({ message: "Not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error loading Billing" });
  }
};

// Billing-ის დამატება
export const addBilling = async (req, res) => {
  const {
    full_name,
    dob,
    phone1,
    phone2,
    email,
    zip,
    address,
    city,
    state,
    reputation,
    notes,
    legal_name,
    ein
  } = req.body;

  if (!full_name || !phone1 || !email) {
    return res.status(400).json({ message: "Fields 'full_name', 'phone1', and 'email' are required." });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO billing 
      (full_name, dob, phone1, phone2, email, zip, address, city, state, reputation, notes, legal_name, ein)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        dob,
        phone1,
        phone2,
        email,
        zip,
        address,
        city,
        state,
        reputation,
        notes,
        legal_name,
        ein
      ]
    );

    const billingId = result.insertId;
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: req.user?.id || null,
      action: "create_billing",
      objectType: "billing",
      objectId: billingId,
      ip,
      device,
      details: `Created billing ${billingId} for ${full_name}`,
    });

    res.status(201).json({ message: "Billing added", id: billingId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding Billing" });
  }
};

// Billing-ის განახლება
export const updateBilling = async (req, res) => {
  const {
    full_name,
    dob,
    phone1,
    phone2,
    email,
    zip,
    address,
    city,
    state,
    reputation,
    notes,
    legal_name,
    ein
  } = req.body;

  try {
    await db.query(
      `UPDATE billing SET
        full_name = ?, dob = ?, phone1 = ?, phone2 = ?, email = ?, zip = ?, address = ?, city = ?, state = ?, reputation = ?, notes = ?, legal_name = ?, ein = ?
      WHERE id = ?`,
      [
        full_name,
        dob,
        phone1,
        phone2,
        email,
        zip,
        address,
        city,
        state,
        reputation,
        notes,
        legal_name,
        ein,
        req.params.id
      ]
    );

    io.emit("billingUpdated", {
      id: req.params.id,
      full_name,
      zip
    });

    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: req.user?.id || null,
      action: "update_billing",
      objectType: "billing",
      objectId: req.params.id,
      ip,
      device,
      details: `Updated billing ${req.params.id} for ${full_name}`,
    });

    res.json({ message: "Billing updated" });
  } catch (err) {
    console.error("Error updating Billing:", err);
    res.status(500).json({ message: "Error updating Billing" });
  }
};

// Billing-ის წაშლა და არქივში გადატანა
export const deleteBilling = async (req, res) => {
  const billingId = req.params.id;

  try {
    const [rows] = await db.query("SELECT * FROM billing WHERE id = ?", [billingId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Billing not found" });
    }

    await db.query("DELETE FROM billing WHERE id = ?", [billingId]);

    io.emit("billingDeleted", { id: billingId });

    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: req.user?.id || null,
      action: "delete_billing",
      objectType: "billing",
      objectId: billingId,
      ip,
      device,
      details: `Deleted billing ${billingId}`,
    });

    res.json({ message: "Billing deleted successfully" });
  } catch (err) {
    console.error("Error deleting Billing:", err);
    res.status(500).json({ message: "Error deleting Billing" });
  }
};