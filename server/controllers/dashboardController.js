import { db } from "../config/config.js";
import { io } from "../index.js";
import zipcodes from "zipcodes"; // ✅ დაამატე zipcodes ბიბლიოთეკა
import { createLog } from "./logsController.js";
import { getRequestMeta } from "../utils/logHelper.js";

const canAccessDriver = async (userId, driverId) => {
  const [rows] = await db.query(
    `SELECT 1
     FROM driver_groups dg
     JOIN user_groups ug ON ug.group_id = dg.group_id
     WHERE dg.driver_id = ? AND ug.user_id = ?
     LIMIT 1`,
    [driverId, userId]
  );
  return rows.length > 0;
};

export const updateDashboardFields = async (req, res) => {
  const { id } = req.params;
  const updatedFields = req.body;

  if (req.user.role === "user" && !(await canAccessDriver(req.user.id, id))) {
    return res.status(403).json({ message: "Forbidden: Driver is outside your groups" });
  }

  // დაამატე ახალი valid fields
  const validFields = ['zip', 'date', 'comments', 'onload', 'available'];
  const updates = [];
  const values = [];


  for (const [field, newValue] of Object.entries(updatedFields)) {
    if (validFields.includes(field)) {
      updates.push(`${field} = ?`);
      values.push(newValue);

      // თუ zip იცვლება, დაამატე location-ც
      if (field === 'zip') {
        const locationInfo = zipcodes.lookup(newValue);
        if (locationInfo) {
          const locationString = `${locationInfo.city}, ${locationInfo.state}`;
          updates.push(`location = ?`);
          values.push(locationString);
        } else {
          return res.status(400).json({ message: "Invalid ZIP code" });
        }
      }
    } else {
      return res.status(400).json({ message: `Invalid field name: ${field}` });
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No valid fields to update" });
  }

  values.push(id);

  try {
    const q = `UPDATE drivers SET ${updates.join(", ")} WHERE id = ?`;
    await db.query(q, values);

    // Socket.IO-თი აცნობე ცვლილებები
    io.emit("dashboardUpdated", { updatedFields, driverId: id });
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId: req.user?.id || null,
      action: "update_dashboard_fields",
      objectType: "driver",
      objectId: id,
      ip,
      device,
      details: `Updated dashboard fields for driver ${id}: ${Object.keys(updatedFields).join(",")}`,
    });

    res.status(200).json({ message: "Driver updated successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating dashboard fields" });
  }
};







export const getDashboardData = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { zip: filterZip, radius, search, group, hideOnLoad, hideUnavailable } = req.query;

  try {
    let drivers;

    // Prepare group filtering: allow comma-separated names or ids
    const groupParam = group;
    let groupItems = [];
    if (groupParam && groupParam !== "all") {
      groupItems = String(groupParam)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    if (userRole === "admin" || userRole === "sa") {
      if (groupItems.length > 0) {
        // Determine if items are numeric ids or names
        const areIds = groupItems.every((it) => /^\d+$/.test(it));
        if (areIds) {
          const placeholders = groupItems.map(() => '?').join(',');
          [drivers] = await db.query(
            `
            SELECT DISTINCT c.*, u.name AS reserved_by_name
            FROM drivers c
            LEFT JOIN users u ON c.reserved_by = u.id
            JOIN driver_groups cg ON c.id = cg.driver_id
            WHERE cg.group_id IN (${placeholders})
            `,
            groupItems
          );
        } else {
          const placeholders = groupItems.map(() => '?').join(',');
          [drivers] = await db.query(
            `
            SELECT DISTINCT c.*, u.name AS reserved_by_name
            FROM drivers c
            LEFT JOIN users u ON c.reserved_by = u.id
            JOIN driver_groups cg ON c.id = cg.driver_id
            JOIN groups g ON cg.group_id = g.id
            WHERE g.name IN (${placeholders})
            `,
            groupItems
          );
        }
      } else {
        [drivers] = await db.query(`
          SELECT c.*, u.name AS reserved_by_name 
          FROM drivers c
          LEFT JOIN users u ON c.reserved_by = u.id
        `);
      }
    } else {
      // user role: only drivers linked to user's groups
      if (groupItems.length > 0) {
        const areIds = groupItems.every((it) => /^\d+$/.test(it));
        if (areIds) {
          const placeholders = groupItems.map(() => '?').join(',');
          [drivers] = await db.query(
            `
            SELECT DISTINCT c.*, u.name AS reserved_by_name 
            FROM drivers c
            LEFT JOIN users u ON c.reserved_by = u.id
            JOIN driver_groups cg ON c.id = cg.driver_id
            JOIN user_groups ug ON cg.group_id = ug.group_id
            WHERE ug.user_id = ? AND cg.group_id IN (${placeholders})
            `,
            [userId, ...groupItems]
          );
        } else {
          const placeholders = groupItems.map(() => '?').join(',');
          [drivers] = await db.query(
            `
            SELECT DISTINCT c.*, u.name AS reserved_by_name 
            FROM drivers c
            LEFT JOIN users u ON c.reserved_by = u.id
            JOIN driver_groups cg ON c.id = cg.driver_id
            JOIN user_groups ug ON cg.group_id = ug.group_id
            WHERE ug.user_id = ? AND cg.group_id IN (SELECT id FROM groups WHERE name IN (${placeholders}))
            `,
            [userId, ...groupItems]
          );
        }
      } else {
        [drivers] = await db.query(
          `
          SELECT DISTINCT c.*, u.name AS reserved_by_name 
          FROM drivers c
          LEFT JOIN users u ON c.reserved_by = u.id
          JOIN driver_groups cg ON c.id = cg.driver_id
          JOIN user_groups ug ON cg.group_id = ug.group_id
          WHERE ug.user_id = ?
          `,
          [userId]
        );
      }
    }

    const filterZipValid = zipcodes.lookup(filterZip);
    const radiusNumber = Number(radius);

    
drivers = drivers.map((driver) => {
  const driverZipValid = zipcodes.lookup(driver.zip);
  let distance = null;

  if (filterZipValid && driverZipValid) {
    distance = zipcodes.distance(filterZip, driver.zip);
  }


    // Format date
  let formattedDate = null;
  if (driver.date) {
    const dateObj = new Date(driver.date);
    formattedDate = dateObj.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,

    });
  }







  // Format insurance_date
  let formattedInsuranceDate = null;
  if (driver.insurance_date) {
    const dateObj = new Date(driver.insurance_date);
    formattedInsuranceDate = dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  // Format regisration_date
  let formattedRegistrationDate = null;
  if (driver.registration_date) {
    const dateObj = new Date(driver.registration_date);
    formattedRegistrationDate = dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

 // console.log(driver.registration_date, formattedRegistrationDate);


  const lat = driverZipValid?.latitude || null;
  const lng = driverZipValid?.longitude || null;

  return {
    ...driver,
    distance: distance !== null ? distance : Infinity,
     date: formattedDate,
    insurance_date: formattedInsuranceDate,
    registration_date: formattedRegistrationDate,
    latitude: lat,
    longitude: lng,
  };
});


    // Filter by hideOnLoad if true: exclude drivers where onload = 1
    if (hideOnLoad === "true") {
      drivers = drivers.filter((driver) => driver.onload !== 1);
    }

    // Filter by hideUnavailable if true: exclude drivers where available = 0
    if (hideUnavailable === "true") {
      drivers = drivers.filter((driver) => driver.available !== 0);
    }

    // Filter by radius if provided
    if (filterZipValid && radius && !isNaN(radiusNumber)) {
      drivers = drivers.filter((driver) => driver.distance <= radiusNumber);
    }

    // Sort by distance
    drivers.sort((a, b) => a.distance - b.distance);

    // Optional search filter

      if (search && search.trim() !== "") {
        const searchLower = search.toLowerCase();
        drivers = drivers.filter((driver) => {
          return (
            driver.name?.toLowerCase().includes(searchLower) ||
            driver.zip?.toString().includes(searchLower) ||
            driver.distance?.toString().includes(searchLower) ||
            driver.unit?.toLowerCase().includes(searchLower)
          );
        });
      }





    // Load associated group names for each driver
// Load associated group names for each driver (only for admin or sa)
if (userRole === "admin" || userRole === "sa" || userRole === "hr" || userRole === "user") {
  for (let driver of drivers) {
    const [groupRows] = await db.query(
      `SELECT g.name, g.description 
       FROM driver_groups cg 
       JOIN groups g ON cg.group_id = g.id 
       WHERE cg.driver_id = ?`,
      [driver.id]
    );
    driver.groups = groupRows.map((row) => ({
      name: row.name,
      description: row.description,
    }));
  }
} else {
  // For 'user' role, send empty groups array
  drivers = drivers.map(driver => ({
    ...driver,
    groups: []
  }));
}


    res.json(drivers);
  } catch (err) {
    console.error("Error in getDashboardData:", err);
    res.status(500).json({ message: "Error loading drivers" });
  }
};








export const reserveDriver = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { driverId } = req.body;

  try {
    if (userRole === "user" && !(await canAccessDriver(userId, driverId))) {
      return res.status(403).json({ message: "Forbidden: Driver is outside your groups" });
    }

    // გადაამოწმე გადამზიდავის სტატუსი
    const [driverRows] = await db.query(
      "SELECT reserved_by FROM drivers WHERE id = ?",
      [driverId]
    );

    if (driverRows.length === 0) {
      return res.status(404).json({ message: "driver not found" });
    }

    const reservedBy = driverRows[0].reserved_by;

    // თუ დარეზერვებულია სხვაზე და არც admin/sa ხარ — ვერ დააჯავშნე
    if (reservedBy && reservedBy !== userId && userRole !== "admin" && userRole !== "sa") {
      return res.status(400).json({ message: "you have no access!" });
    }

    // თუ დარეზერვებულია იმავე user-ზე ან admin/sa ხარ — გაუქმება
    if (reservedBy && (reservedBy === userId || userRole === "admin" || userRole === "sa")) {
      await db.query(
        "UPDATE drivers SET reserved_by = NULL, reserved_at = NULL WHERE id = ?",
        [driverId]
      );
      const [updatedDriver] = await db.query(
        "SELECT d.*, u.name AS reserved_by_name FROM drivers d LEFT JOIN users u ON d.reserved_by = u.id WHERE d.id = ?",
        [driverId]
      );
      io.emit("dashboardUpdated", updatedDriver[0]);
      const { ip, device } = getRequestMeta(req);
      await createLog({
        userId,
        action: "cancel_reservation",
        objectType: "driver",
        objectId: driverId,
        ip,
        device,
        details: `Cancelled reservation for driver ${driverId}`,
      });
      return res.status(200).json({ message: "Reservation cancelled" });
    }

    const now = new Date();
    await db.query(
      "UPDATE drivers SET reserved_by = ?, reserved_at = ? WHERE id = ?",
      [userId, now, driverId]
    );
    const [updatedDriver] = await db.query(
      "SELECT d.*, u.name AS reserved_by_name FROM drivers d LEFT JOIN users u ON d.reserved_by = u.id WHERE d.id = ?",
      [driverId]
    );
    io.emit("dashboardUpdated", updatedDriver[0]);
    const { ip, device } = getRequestMeta(req);
    await createLog({
      userId,
      action: "reserve_driver",
      objectType: "driver",
      objectId: driverId,
      ip,
      device,
      details: `Reserved driver ${driverId}`,
    });
    res.status(200).json({ message: "driver reserved successfully!" });

    // ავტომატური გაუქმება 15 წუთში
    setTimeout(async () => {
      const [checkAgain] = await db.query(
        "SELECT reserved_by FROM drivers WHERE id = ?",
        [driverId]
      );
   
      

      // თუ ისევ იმავე user-ზეა, გააუქმე
      if (checkAgain[0].reserved_by === userId) {
        await db.query(
          "UPDATE drivers SET reserved_by = NULL, reserved_at = NULL WHERE id = ?",
          [driverId]
        );
      const [updatedDriver] = await db.query(
        "SELECT d.*, u.name AS reserved_by_name FROM drivers d LEFT JOIN users u ON d.reserved_by = u.id WHERE d.id = ?",
        [driverId]
      );
      io.emit("dashboardUpdated", updatedDriver[0]);
      }
    }, 15 * 60 * 1000);
    
  } catch (err) {
    console.error("Error reserving driver:", err);
    res.status(500).json({ message: "Failed to reserve driver" });
  }
};


