import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/axios";
import { toast } from "sonner";

const DriverForm = ({ onSubmit, initialData = {}, isEditing = false }) => {
  const [formData, setFormData] = useState({
    unit: "",
    name: "",
    dimensions: "",
    payload: "",
    license_plate: "",
    phone: "",
    location: "",
    zip: "",
    date: "",
    insurance_date: "",
    registration_date: "",
    comments: "",
    email: "",
    emergency: "",
    groups: [],
  });
  const navigate = useNavigate();

  const [, setDrivers] = useState([]);
  const [groups, setGroups] = useState([]);

  const normalizeGroups = (groupsValue) => {
    if (!Array.isArray(groupsValue)) return [];
    return groupsValue
      .map((g) => (typeof g === "object" && g !== null ? g.id : g))
      .filter((id) => id !== null && id !== undefined && id !== "");
  };

  const normalizeDateForInput = (value) => {
    if (!value) return "";
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}[ T].*/.test(trimmed)) return trimmed.slice(0, 10);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
    }
    return "";
  };

  const normalizeDriverDates = (data) => ({
    ...data,
    date: normalizeDateForInput(data.date),
    insurance_date: normalizeDateForInput(data.insurance_date),
    registration_date: normalizeDateForInput(data.registration_date),
  });

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData((prev) => ({
        ...prev,
        ...normalizeDriverDates(initialData),
        groups: normalizeGroups(initialData.groups),
      }));
    }
  }, [initialData]);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await API.get("/groups");
      setGroups(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Server error");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleGroup = (groupId) => {
    setFormData((prev) => ({
      ...prev,
      groups: prev.groups.includes(groupId)
        ? prev.groups.filter((id) => id !== groupId)
        : [...prev.groups, groupId],
    }));
  };

 const handleAddDriver = async (newDriver) => {
  if (!newDriver.unit || !newDriver.name || !newDriver.phone) {
     toast.error("'unit', 'name' და 'phone' is required");
    return;
  }

  try {
    const res = await API.post("/drivers", newDriver);
    setDrivers((prev) => [...prev, { ...newDriver, id: res.data.id }]);
    toast.success("successfully added new driver");
    navigate("/drivers"); // გადამისამართება გადამზიდავების სიაში
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || "error adding driver");
  }
};


const handleUpdateDriver = async (id, updatedDriver) => {
  if (!updatedDriver.unit || !updatedDriver.name || !updatedDriver.phone) {
    toast.error("'unit', 'name' და 'phone' is required");
    return;
  }

  try {
    await API.put(`/drivers/${id}`, updatedDriver);
    setDrivers((prev) =>
      prev.map((driver) => (driver.id === id ? { ...driver, ...updatedDriver } : driver))
    );
    toast.success("updated successfully");
     navigate("/drivers");
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || "update error");
  }
};


const normalizeDateForSubmit = (value) => {
  if (!value || typeof value !== "string") return value;
  return value.trim();
};

const handleSubmit = (e) => {
  e.preventDefault();
  const normalized = {
    ...formData,
    groups: normalizeGroups(formData.groups),
    date: normalizeDateForSubmit(formData.date),
    insurance_date: normalizeDateForSubmit(formData.insurance_date),
    registration_date: normalizeDateForSubmit(formData.registration_date),
  };
  if (onSubmit) {
    onSubmit(normalized);
    return;
  }
  if (normalized.id) {
    handleUpdateDriver(normalized.id, normalized);
  } else {
    handleAddDriver(normalized);
  }
};





  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg"
    >
      {[
        { name: "unit", label: "Unit", required: true },
        { name: "name", label: "Driver Name", required: true },
        { name: "phone", label: "Phone", required: true },
        { name: "email", label: "Email", type: "email" },
        { name: "emergency", label: "Emergency Contact" },
        { name: "license_plate", label: "License Plate" },
        { name: "payload", label: "Payload Capacity" },
        { name: "dimensions", label: "Vehicle Dimensions" },
        { name: "zip", label: "ZIP Code" },
        { name: "location", label: "Location" },
        { name: "date", label: "Date", type: "date" },
        { name: "insurance_date", label: "Insurance Date", type: "date" },
        { name: "registration_date", label: "Registration Date", type: "date" },
        { name: "comments", label: "Comments" },
      ].map(({ name, label, type = "text", required = false }) => (
        <div key={name} className="flex flex-col">
          <label
            htmlFor={name}
            className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
            {required && <span className="text-red-500"> *</span>}
          </label>
          <input
            type={type}
            name={name}
            id={name}
            placeholder={label}
            value={formData[name] || ""}
            onChange={handleChange}
            required={required}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      ))}
      <div className="col-span-full">
        <label
          htmlFor="groups"
          className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300 block"
        >
          Groups
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {groups.map((group) => {
            const selected = formData.groups.includes(group.id);
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
                  selected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900"
                }`}
              >
                {group.name}
              </button>
            );
          })}
          {groups.length === 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">No groups available</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Tap groups to select or deselect.</p>
      </div>

      <div className="col-span-full flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded transition duration-200"
        >
          {isEditing ? "Update Driver" : "Add Driver"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/drivers")}
          className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded transition duration-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default DriverForm;
