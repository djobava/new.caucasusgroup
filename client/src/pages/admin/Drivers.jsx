import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../../api/axios";
import { toast } from 'sonner';

const getDateBadgeClass = (value) => {
  if (!value) return "text-gray-500 dark:text-gray-400";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "text-gray-500 dark:text-gray-400";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  if (date <= today) {
    return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
  }
  return "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200";
};

const formatDateDDMMYYYY = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};

const DriversPage = () => {
  const [drivers, setDrivers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");


  useEffect(() => {
    fetchDrivers();
    fetchGroups();
  }, []);

  const fetchDrivers = async (groupIds = []) => {
    try {
      const params = Array.isArray(groupIds) && groupIds.length > 0
        ? { group: groupIds.join(",") }
        : {};
      const res = await API.get("/drivers", { params });
      setDrivers(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Server error");
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await API.get("/groups");
      setGroups(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Server error");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this driver?")) {
      try {
        await API.delete(`/drivers/${id}`);
        setDrivers((prev) => prev.filter((driver) => driver.id !== id));
        toast.success("Driver deleted successfully");
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || "Server error");
      }
    }
  };

  const filteredDrivers = drivers.filter((driver) => {
    const term = searchTerm.toLowerCase();
    return (
      driver.unit?.toLowerCase().includes(term) ||
      driver.name?.toLowerCase().includes(term) ||
      driver.phone?.toLowerCase().includes(term) ||
      driver.email?.toLowerCase().includes(term) ||
      driver.emergency?.toLowerCase().includes(term) ||
      driver.payload?.toLowerCase().includes(term) ||
      driver.groups?.some((g) => g.name.toLowerCase().includes(term))
    );
  });


  return (
    <div className="max-w-8xl mx-auto p-4 md:p-6 dark:bg-gray-900 dark:text-white min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Drivers</h2>
        <div className="flex gap-3 flex-wrap">
          <Link
            to="/drivers/deleted"
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition duration-200"
          >
            🗑 Deleted Drivers
          </Link>
          <Link
            to="/drivers/new"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition duration-200"
          >
            + Add New Driver
          </Link>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <div className="flex flex-col">
          <label className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Search
          </label>
          <input
            type="text"
            placeholder="Search by unit, name, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <div className="xl:col-span-2 flex flex-col gap-3">
          <label className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Filter by Group
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedGroups([]);
                fetchDrivers([]);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                selectedGroups.length === 0
                  ? "bg-blue-600 text-white border border-blue-600"
                  : "bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900"
              }`}
            >
              All Groups
            </button>
            {groups.map((group) => {
              const groupId = String(group.id);
              const selected = selectedGroups.includes(groupId);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    const next = selected
                      ? selectedGroups.filter((id) => id !== groupId)
                      : [...selectedGroups, groupId];
                    setSelectedGroups(next);
                    fetchDrivers(next);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    selected
                      ? "bg-blue-600 text-white border border-blue-600"
                      : "bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900"
                  }`}
                >
                  {group.name}
                </button>
              );
            })}
          </div>
          {groups.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">No groups available.</p>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm font-medium text-gray-600 dark:text-gray-400">
        Total Drivers: <span className="text-lg font-bold text-gray-900 dark:text-white">{filteredDrivers.length}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow min-w-full">
        <table className="min-w-[1100px] w-full table-auto text-sm bg-white dark:bg-gray-800">
          <thead className="hidden md:table-header-group bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="p-3 text-left font-semibold text-gray-700 dark:text-gray-300">Unit</th>
              <th className="p-3 text-left font-semibold text-gray-700 dark:text-gray-300">Driver Info</th>
              <th className="p-3 text-left font-semibold text-gray-700 dark:text-gray-300">Address</th>
              <th className="p-3 text-left font-semibold text-gray-700 dark:text-gray-300">Vehicle Details</th>
              <th className="p-3 text-left font-semibold text-gray-700 dark:text-gray-300">Created Date</th>
              <th className="p-3 text-left font-semibold text-gray-700 dark:text-gray-300">Dates</th>
              <th className="p-3 text-left font-semibold text-gray-700 dark:text-gray-300">Groups</th>
              <th className="p-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {filteredDrivers.length === 0 ? (
              <tr className="block md:table-row">
                <td colSpan="8" className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No drivers found
                </td>
              </tr>
            ) : (
              filteredDrivers.map((driver) => (
                <tr
                  key={driver.id}
                  className="block md:table-row border md:border-b md:border-x-0 md:border-t-0 border-gray-200 dark:border-gray-700 mb-4 md:mb-0 p-4 md:p-0 rounded-lg md:rounded-none dark:md:bg-gray-800 hover:md:bg-gray-50 dark:hover:md:bg-gray-700 transition"
                >
                  {/* Unit */}
                  <td className="p-3 md:p-3 before:content-['Unit:_'] before:font-bold before:block md:before:hidden text-gray-900 dark:text-gray-100">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{driver.unit}</span>
                  </td>

                  {/* Driver Info */}
                  <td className="p-3 md:p-3 before:content-['Driver:_'] before:font-bold before:block md:before:hidden text-gray-900 dark:text-gray-100">
                    <div className="space-y-1 text-sm">
                      <div><strong>Name:</strong> {driver.name || "-"}</div>
                      <div><strong>Phone:</strong> {driver.phone || "-"}</div>
                      <div><strong>Email:</strong> {driver.email || "-"}</div>
                    </div>
                  </td>

                  {/* Address */}
                  <td className="p-3 md:p-3 before:content-['Location:_'] before:font-bold before:block md:before:hidden text-gray-900 dark:text-gray-100">
                    <div className="space-y-1 text-sm">
                      <div><strong>ZIP:</strong> {driver.zip || "-"}</div>
                      <div><strong>City:</strong> {driver.location || "-"}</div>
                    </div>
                  </td>

                  {/* Vehicle Details */}
                  <td className="p-3 md:p-3 before:content-['Vehicle:_'] before:font-bold before:block md:before:hidden text-gray-900 dark:text-gray-100">
                    <div className="space-y-1 text-sm">
                      <div><strong>Plate:</strong> <span className="font-mono">{driver.license_plate || "-"}</span></div>
                      <div><strong>Payload:</strong> {driver.payload || "-"}</div>
                      <div><strong>Dimensions:</strong> {driver.dimensions || "-"}</div>
                    </div>
                  </td>

                  {/* Created Date */}
                  <td className="p-3 md:p-3 before:content-['Created:_'] before:font-bold before:block md:before:hidden text-gray-700 dark:text-gray-300 text-sm">
                    {formatDateDDMMYYYY(driver.date)}
                  </td>

                  {/* Insurance & Registration Dates */}
                  <td className="p-3 md:p-3 before:content-['Dates:_'] before:font-bold before:block md:before:hidden text-gray-900 dark:text-gray-100">
                    <div className="space-y-1 text-sm">
                      <div className={`${getDateBadgeClass(driver.insurance_date)} px-2 py-1 rounded`}>
                        <strong>Ins:</strong> {formatDateDDMMYYYY(driver.insurance_date)}
                      </div>
                      <div className={`${getDateBadgeClass(driver.registration_date)} px-2 py-1 rounded`}>
                        <strong>Reg:</strong> {formatDateDDMMYYYY(driver.registration_date)}
                      </div>
                    </div>
                  </td>

                  {/* Groups */}
                  <td className="p-3 md:p-3 before:content-['Groups:_'] before:font-bold before:block md:before:hidden text-gray-900 dark:text-gray-100 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {driver.groups?.length > 0
                        ? driver.groups.map((g) => (
                            <span key={g.id} className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs font-medium">
                              {g.name}
                            </span>
                          ))
                        : <span className="text-gray-500 dark:text-gray-400 text-xs">No groups</span>}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="p-3 md:p-3 before:content-['Actions:_'] before:font-bold before:block md:before:hidden text-center">
                    <div className="flex gap-2 justify-center flex-wrap">
                      <Link
                        to={`/drivers/${driver.id}/edit`}
                        className="px-3 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded transition"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(driver.id)}
                        className="px-3 py-1 text-xs font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 rounded transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DriversPage;
