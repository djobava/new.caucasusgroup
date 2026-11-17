
import { db } from "../config/config.js";
import { io } from "../index.js";
import zipcodes from "zipcodes";
import { createLog } from "./logsController.js";
import { getRequestMeta } from "../utils/logHelper.js";

const createLogSafely = async (entry) => {
  try {
    await createLog(entry);
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
};

// ყველა გადამზიდავის წამოღება
export const getDrivers = async (req, res) => {
  try {
    const groupId = req.query.group;
    let drivers = [];

    if (groupId) {
      const groupIds = String(groupId)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (groupIds.length > 0) {
        const placeholders = groupIds.map(() => "?").join(",");
        const [rows] = await db.query(
          `SELECT DISTINCT c.* FROM drivers c
           JOIN driver_groups cg ON c.id = cg.driver_id
           WHERE cg.group_id IN (${placeholders})`,
          groupIds
        );
        drivers = rows;
      } else {
        const [rows] = await db.query("SELECT * FROM drivers");
        drivers = rows;
      }
    } else {
      // ყველა გადამზიდავის წამოღება
      const [rows] = await db.query("SELECT * FROM drivers");
      drivers = rows;
    }

    // ჯგუფების წამოღება პარალელურად ყველა driver-ზე
    const driversWithGroups = await Promise.all(
      drivers.map(async (driver) => {
        const [groupRows] = await db.query(
          `SELECT g.id, g.name 
           FROM driver_groups cg 
           JOIN groups g ON cg.group_id = g.id 
           WHERE cg.driver_id = ?`,
          [driver.id]
        );
        return {
          ...driver,
          groups: groupRows,
        };
      })
    );

    res.json(driversWithGroups);
  } catch (err) {
    console.error("Error in getDrivers:", err);
    res.status(500).json({ message: "Error loading drivers" });
  }
};


// ერთი გადამზიდავის წამოღება ID-ით
export const getDriverById = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM drivers WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0) return res.status(404).json({ message: "Not found" });

    const driver = rows[0];

    const [groupRows] = await db.query(
      `SELECT g.id, g.name FROM driver_groups cg 
       JOIN groups g ON cg.group_id = g.id 
       WHERE cg.driver_id = ?`,
      [driver.id]
    );
    driver.groups = groupRows;

    res.json(driver);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error loading drivers" });
  }
};

// ახალი გადამზიდავის დამატება
export const addDriver = async (req, res) => {
  let {
    unit,
    name,
    dimensions,
    payload,
    license_plate,
    phone,
    zip,
    date,
    insurance_date,
    registration_date,
    comments,
    email,
    groups = [],
    emergency,
  } = req.body;
   
  // ვალიდაცია - აუცილებლად უნდა იყოს მითითებული unit, name და phone
  if (!unit || !name || !phone) {
    return res.status(400).json({ message: "Fields 'unit', 'name' and 'phone' are required." });
  }
  
  let location = "";

  const locationData = zipcodes.lookup(zip);
  if (locationData) {
    const { city, state } = locationData;
    location = `${city}, ${state}`;
  } else {
    location = `unknown`;
  }

  try {
    const [result] = await db.query(
  `INSERT INTO drivers 
    (unit, name, dimensions, payload, license_plate, phone, location, zip, date, insurance_date, registration_date, comments, email, emergency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, // აქ 14 ?
  [
    unit,
    name,
    dimensions,
    payload,
    license_plate,
    phone,
    location,
    zip,
    date,
    insurance_date,
    registration_date,
    comments,
    email,
    emergency,
  ]
);


    const driverId = result.insertId;

if (Array.isArray(groups) && groups.length > 0) {
  const values = groups
    .map((item) => ({
      groupId: typeof item === "object" && item !== null ? item.id : item,
    }))
    .map(({ groupId }) => [driverId, groupId])
    .filter(([, groupId]) => groupId !== null && groupId !== undefined && groupId !== "");

  if (values.length > 0) {
    await db.query("INSERT INTO driver_groups (driver_id, group_id) VALUES ?", [values]);
  }
}


// გამოუშვი ახალი ინფო სოკეტით
io.emit("driverAdded", {
  id: driverId,
  unit,
  name,
  zip,
  date,
  insurance_date,
  registration_date,
  comments,
});




    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: req.user?.id || null,
      action: "create_driver",
      objectType: "driver",
      objectId: driverId,
      ip,
      device,
      details: `Created driver ${name} (${license_plate || "no plate"})`,
    });
    res.status(201).json({ message: "Driver added", id: driverId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error adding driver" });
  }
};


// გადამზიდავის განახლება
export const updateDriver = async (req, res) => {
  let {
    unit,
    name,
    dimensions,
    payload,
    license_plate,
    phone,
    zip,
    date,
    insurance_date,
    registration_date,
    comments,
    email,
    emergency,
    groups ,
  } = req.body;

  if (!Array.isArray(groups)) {
    return res.status(400).json({ message: "Groups must be an array" });
  }

  let location = "";

  const locationData = zipcodes.lookup(zip);
  if (locationData) {
    const { city, state } = locationData;
    location = `${city}, ${state}`;
  } else {
    location = `unknown`;
  }

let connection;
let transactionActive = false;
try {
  connection = await db.getConnection();
  await connection.beginTransaction();
  transactionActive = true;

  const [updateResult] = await connection.query(
    `UPDATE drivers SET
      unit = ?, name = ?, dimensions = ?, payload = ?, license_plate = ?, phone = ?, location = ?, zip = ?, date = ?, insurance_date = ?, registration_date = ?, comments = ?, email = ?, emergency = ?
    WHERE id = ?`,
    [unit, name, dimensions, payload, license_plate, phone, location, zip, date, insurance_date, registration_date, comments, email, emergency, req.params.id]
  );

  if (updateResult.affectedRows === 0) {
    await connection.rollback();
    transactionActive = false;
    return res.status(404).json({ message: "Driver not found" });
  }

  await connection.query(`DELETE FROM driver_groups WHERE driver_id = ?`, [req.params.id]);

  const values = groups
    .map((item) => ({
      groupId: typeof item === "object" && item !== null ? item.id : item,
    }))
    .map(({ groupId }) => [req.params.id, groupId])
    .filter(([, groupId]) => groupId !== null && groupId !== undefined && groupId !== "");

  if (values.length > 0) {
    await connection.query("INSERT INTO driver_groups (driver_id, group_id) VALUES ?", [values]);
  }
    await connection.commit();
    transactionActive = false;

    io.emit("driverUpdated", {
      id: req.params.id,
      unit,
      name,
      zip,
      date,
      insurance_date,
      registration_date,
      comments,
    });

    const { ip, device } = getRequestMeta(req);
    await createLogSafely({
      userId: req.user?.id || null,
      action: "update_driver",
      objectType: "driver",
      objectId: req.params.id,
      ip,
      device,
      details: `Updated driver ${req.params.id} ${name}`,
    });

    res.json({ message: "Driver updated" });
  } catch (err) {
    if (connection && transactionActive) {
      try { await connection.rollback(); }
      catch (rollbackError) { console.error("Update rollback failed:", rollbackError); }
    }
    console.error("Error updating driver:", err);
    res.status(500).json({ message: "Error updating driver" +err.message });
  } finally {
    connection?.release();
  }
};

// გადამზიდავის წაშლა
export const deleteDriver = async (req, res) => {
  const driverId = req.params.id;
  let connection;
  let transactionActive = false;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionActive = true;

    const [rows] = await connection.query(
      "SELECT * FROM drivers WHERE id = ? FOR UPDATE",
      [driverId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      transactionActive = false;
      return res.status(404).json({ message: "driver not found" });
    }

    const driver = rows[0];

   await connection.query(
  `INSERT INTO deleted_drivers (unit, name, dimensions, payload, license_plate, phone, location, zip, date, insurance_date, registration_date, comments, email, emergency)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`, // აქ ?-ები ემთხვევა სვეტების რაოდენობას
  [
    driver.unit,
    driver.name,
    driver.dimensions,
    driver.payload,
    driver.license_plate,
    driver.phone,
    driver.location,
    driver.zip,
    driver.date,
    driver.insurance_date,
    driver.registration_date || null, // თუ არ არსებობს, იყოს NULL
    driver.comments || null, // თუ არ არსებობს, იყოს NULL
    driver.email,
    driver.emergency
  ]
);

    await connection.query("DELETE FROM drivers WHERE id = ?", [driverId]);
    await connection.commit();
    transactionActive = false;

    io.emit("driverDeleted", { id: driverId });

    const { ip, device } = getRequestMeta(req);
    await createLogSafely({
      userId: req.user?.id || null,
      action: "delete_driver",
      objectType: "driver",
      objectId: driverId,
      ip,
      device,
      details: `Deleted driver ${driverId} ${driver.name}`,
    });

    res.json({ message: "Driver deleted and archived successfully" });
  } catch (err) {
    if (connection && transactionActive) {
      try { await connection.rollback(); }
      catch (rollbackError) { console.error("Delete rollback failed:", rollbackError); }
    }
    console.error("Error deleting driver:", err);
    res.status(500).json({ message: "Error deleting driver" });
  } finally {
    connection?.release();
  }
};

// წაშლილი გადამზიდავის აღდგენა
export const restoreDriver = async (req, res) => {
  const deletedDriverId = req.params.id;
  let connection;
  let transactionActive = false;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    transactionActive = true;

    const [rows] = await connection.query(
      "SELECT * FROM deleted_drivers WHERE id = ? FOR UPDATE",
      [deletedDriverId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      transactionActive = false;
      return res.status(404).json({ message: "Deleted driver not found" });
    }

    const driver = rows[0];

    // დინამიურად დავადგინოთ ID (თუ ის ახალი უნდა იყოს)
    const [insertResult] = await connection.query(
      `INSERT INTO drivers (unit, name, dimensions, payload, license_plate, phone, location, zip, date, insurance_date, registration_date, comments, email, emergency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        driver.unit,
        driver.name,
        driver.dimensions,
        driver.payload,
        driver.license_plate,
        driver.phone,
        driver.location,
        driver.zip,
        driver.date,
        driver.insurance_date,
        driver.registration_date,
        driver.comments,
        driver.email,
        driver.emergency
      ]
    );

    // წაშლილი დრაივერი ამოშალოთ
    await connection.query("DELETE FROM deleted_drivers WHERE id = ?", [deletedDriverId]);
    await connection.commit();
    transactionActive = false;

    io.emit("driverRestored", { id: insertResult.insertId });

    const { ip, device } = getRequestMeta(req);
    await createLogSafely({
      userId: req.user?.id || null,
      action: "restore_driver",
      objectType: "driver",
      objectId: insertResult.insertId,
      ip,
      device,
      details: `Restored driver ${driver.name}`,
    });

    res.json({ message: "Driver restored successfully" });
  } catch (err) {
    if (connection && transactionActive) {
      try { await connection.rollback(); }
      catch (rollbackError) { console.error("Restore rollback failed:", rollbackError); }
    }
    console.error("Error restoring driver:", err);
    res.status(500).json({ message: "Error restoring driver" });
  } finally {
    connection?.release();
  }
};

// წაშლილი გადამზიდავის სამუდამოდ წაშლა
export const permanentlyDeleteDriver = async (req, res) => {
  const deletedDriverId = req.params.id;

  try {
    const [rows] = await db.query("SELECT * FROM deleted_drivers WHERE id = ?", [deletedDriverId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Deleted driver not found" });
    }

    const driver = rows[0];

    await db.query("DELETE FROM deleted_drivers WHERE id = ?", [deletedDriverId]);

    io.emit("driverPermanentlyDeleted", { id: deletedDriverId });

    const { ip, device } = getRequestMeta(req);
    await createLogSafely({
      userId: req.user?.id || null,
      action: "permanently_delete_driver",
      objectType: "driver",
      objectId: deletedDriverId,
      ip,
      device,
      details: `Permanently deleted driver ${driver.name}`,
    });

    res.json({ message: "Driver permanently deleted" });
  } catch (err) {
    console.error("Error permanently deleting driver:", err);
    res.status(500).json({ message: "Error permanently deleting driver" });
  }
};
