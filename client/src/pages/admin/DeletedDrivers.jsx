import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/axios";
import { toast } from "sonner";

const formatDateDDMMYYYY = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};

const DeletedDriversPage = () => {
  const [deletedDrivers, setDeletedDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchDeletedDrivers();
  }, []);

  const fetchDeletedDrivers = async () => {
    try {
      setLoading(true);
      const res = await API.get("/drivers/deleted-drivers");
      setDeletedDrivers(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    if (window.confirm("Restore this driver?")) {
      try {
        await API.put(`/drivers/deleted-drivers/${id}/restore`);
        setDeletedDrivers((prev) => prev.filter((driver) => driver.id !== id));
        toast.success("Driver restored successfully");
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || "Server error");
      }
    }
  };

  const handlePermanentDelete = async (id) => {
    if (window.confirm("Permanently delete this driver? This action cannot be undone.")) {
      try {
        await API.delete(`/drivers/deleted-drivers/${id}`);
        setDeletedDrivers((prev) => prev.filter((driver) => driver.id !== id));
        toast.success("Driver permanently deleted");
      } catch (err) {
        toast.error(err.response?.data?.message || err.message || "Server error");
      }
    }
  };

  const filteredDrivers = deletedDrivers.filter((driver) => {
    const term = searchTerm.toLowerCase();
    return (
      driver.unit?.toLowerCase().includes(term) ||
      driver.name?.toLowerCase().includes(term) ||
      driver.phone?.toLowerCase().includes(term) ||
      driver.email?.toLowerCase().includes(term) ||
      driver.license_plate?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-black dark:text-white">
        <div className="text-lg font-medium">Loading deleted drivers...</div>
      </div>
    );
  }

  return (
    <div className="max-w-8xl mx-auto p-4 md:p-6 dark:bg-gray-900 dark:text-white min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Deleted Drivers</h2>
        <button
          onClick={() => navigate("/drivers")}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition duration-200"
        >
          ← Back to Drivers
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="flex flex-col">
          <label className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Search Deleted Drivers
          </label>
          <input
            type="text"
            placeholder="Search by unit, name, phone, email, plate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-4 text-sm font-medium text-gray-600 dark:text-gray-400">
        Total Deleted: <span className="text-lg font-bold text-gray-900 dark:text-white">{filteredDrivers.length}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow">
        <table className="w-full text-sm bg-white dark:bg-gray-800">
          <thead className="sticky top-0 bg-gradient-to-r from-red-500 to-red-600 dark:from-red-700 dark:to-red-800 text-white font-semibold">
            <tr>
              <th className="p-3 text-left whitespace-nowrap">Unit</th>
              <th className="p-3 text-left whitespace-nowrap">Driver Name</th>
              <th className="p-3 text-left whitespace-nowrap">Email</th>
              <th className="p-3 text-left whitespace-nowrap">Phone</th>
              <th className="p-3 text-left whitespace-nowrap">License Plate</th>
              <th className="p-3 text-left whitespace-nowrap">Location</th>
              <th className="p-3 text-left whitespace-nowrap">Insurance Date</th>
              <th className="p-3 text-left whitespace-nowrap">Registration Date</th>
              <th className="p-3 text-left whitespace-nowrap">Deleted Date</th>
              <th className="p-3 text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.length === 0 ? (
              <tr>
                <td colSpan="10" className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No deleted drivers found
                </td>
              </tr>
            ) : (
              filteredDrivers.map((driver) => (
                <tr
                  key={driver.id}
                  className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <td className="p-3">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{driver.unit || "—"}</span>
                  </td>
                  <td className="p-3">{driver.name || "—"}</td>
                  <td className="p-3 text-blue-600 dark:text-blue-400">{driver.email || "—"}</td>
                  <td className="p-3">{driver.phone || "—"}</td>
                  <td className="p-3 font-mono">{driver.license_plate || "—"}</td>
                  <td className="p-3">{driver.location || "—"}</td>
                  <td className="p-3">{formatDateDDMMYYYY(driver.insurance_date)}</td>
                  <td className="p-3">{formatDateDDMMYYYY(driver.registration_date)}</td>
                  <td className="p-3 text-gray-600 dark:text-gray-400 text-xs">{formatDateDDMMYYYY(driver.created_at)}</td>
                  <td className="p-3 flex gap-2 justify-center items-center flex-wrap">
                    <button
                      onClick={() => handleRestore(driver.id)}
                      className="px-3 py-1 text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800 rounded transition"
                    >
                      ↻ Restore
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(driver.id)}
                      className="px-3 py-1 text-xs font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 rounded transition"
                    >
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Empty State Message */}
      {deletedDrivers.length === 0 && !loading && (
        <div className="mt-8 p-8 text-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No deleted drivers yet. All drivers are safe and sound!
          </p>
        </div>
      )}
    </div>
  );
};

export default DeletedDriversPage;
