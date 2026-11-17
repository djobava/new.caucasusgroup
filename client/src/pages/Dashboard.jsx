// Dashboard.jsx
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";
import Timer from "./Timer";
import { toast } from "sonner";
import getCurrentDateTime from "../components/DateTimeNow";

// Constants
const ZIP_LENGTH = 5;
const ERROR_DISPLAY_DURATION = 3000;
const DEBOUNCE_DELAY = 400;

// Helper functions
const getStatusClass = (available, onload) => {
  if (available && !onload) return "bg-green-500 text-white";
  if (onload) return "bg-amber-200 text-orange-500";
  return "bg-red-500 text-white";
};

const getStatusText = (available, onload) => {
  if (available && !onload) return "Available";
  if (onload) return "Onload";
  return "Unavailable";
};

const formatDateDDMMYYYY = (value) => {
  if (!value) return "?";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "?";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};

const getDateBadgeClass = (value) => {
  if (!value) return "bg-gray-500 text-white";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "bg-gray-500 text-white";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today ? "bg-red-500 text-white" : "bg-green-500 text-white";
};

const Dashboard = () => {
  const { role } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(false);
  const [zipError, setZipError] = useState("");
  const timeoutRef = useRef(null);

  const [search, setSearch] = useState("");
  const [sortByZip, setSortByZip] = useState("");
  const [radius, setRadius] = useState("");
  const [group, setGroup] = useState([]);
  const [hideUnavailable, setHideUnavailable] = useState(false);
  const [hideOnLoad, setHideOnLoad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [debouncedFilters, setDebouncedFilters] = useState({});
  const [groupsList, setGroupsList] = useState([]);

  const isValidZip = sortByZip.length === ZIP_LENGTH;

  const filters = useMemo(
    () => ({
      search,
      ...(group.length > 0 ? { group: group.join(",") } : {}),
      hideOnLoad,
      hideUnavailable,
      ...(isValidZip && { zip: sortByZip, radius }),
    }),
    [search, group, hideOnLoad, hideUnavailable, sortByZip, radius, isValidZip]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Debounce filters
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedFilters(filters), DEBOUNCE_DELAY);
    return () => clearTimeout(handler);
  }, [filters]);

  // Fetch drivers helper and effect
  const fetchDrivers = useCallback(async (params) => {
    setLoading(true);
    try {
      const res = await API.get("/dashboard", { params });
      setDrivers(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (Object.keys(debouncedFilters).length > 0) {
      fetchDrivers(debouncedFilters);
    }
  }, [debouncedFilters, fetchDrivers]);

  // Socket.IO listener - memoized
  const handleSocketUpdate = useCallback((updatedDriver) => {
    setDrivers((prev) =>
      prev.map((driver) =>
        driver.id === updatedDriver.id ? { ...driver, ...updatedDriver } : driver
      )
    );
  }, []);

  useEffect(() => {
    socket.on("dashboardUpdated", handleSocketUpdate);
    return () => socket.off("dashboardUpdated", handleSocketUpdate);
  }, [handleSocketUpdate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") setIsModalOpen(false);
      if (e.key === "Enter" && isModalOpen) {
        e.preventDefault();
        handleUpdate();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isModalOpen, selectedDriver]);

  // Fetch groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        let res;
        if (role === "admin" || role === "sa") {
          res = await API.get("/groups");
        } else if (role === "user") {
          res = await API.get("/groups/getGroupsOfUser");
        } else {
          setGroupsList([]);
          return;
        }
        setGroupsList(res.data);
      } catch (error) {
        console.error("Error fetching groups:", error);
        toast.error("Failed to load groups");
        setGroupsList([]);
      }
    };

    if (role) fetchGroups();
    else setGroupsList([]);
  }, [role]);

  // Reset radius when ZIP is invalid
  useEffect(() => {
    if (!isValidZip) setRadius("");
  }, [isValidZip]);

  // Load filters from localStorage on mount
  useEffect(() => {
    const savedFilters = localStorage.getItem('dashboardFilters');
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        setSearch(filters.search || '');
        setSortByZip(filters.sortByZip || '');
        setRadius(filters.radius || '');
        setGroup(filters.group || []);
        setHideUnavailable(filters.hideUnavailable || false);
        setHideOnLoad(filters.hideOnLoad || false);
      } catch (error) {
        console.error('Failed to load saved filters:', error);
      }
    }
    setHasLoaded(true);
  }, []);

  // Save filters to localStorage whenever they change (after initial load)
  useEffect(() => {
    if (!hasLoaded) return; // Don't save on initial render
    const filtersToSave = {
      search,
      sortByZip,
      radius,
      group,
      hideUnavailable,
      hideOnLoad,
    };
    localStorage.setItem('dashboardFilters', JSON.stringify(filtersToSave));
  }, [search, sortByZip, radius, group, hideUnavailable, hideOnLoad, hasLoaded]);

  const openModal = useCallback((driver) => {
    setSelectedDriver({ ...driver, date: getCurrentDateTime() });
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedDriver(null);
    setIsModalOpen(false);
    setZipError("");
    setError(false);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!selectedDriver) return;

    try {
      setZipError("");
      setError(false);

      const { data: updatedDriver } = await API.put(`/dashboard/${selectedDriver.id}`, {
        zip: selectedDriver.zip,
        date: selectedDriver.date,
        comments: selectedDriver.comments,
        onload: selectedDriver.onload ? 1 : 0,
        available: selectedDriver.available ? 1 : 0,
      });

      setDrivers((prev) =>
        prev.map((d) => (d.id === updatedDriver.id ? updatedDriver : d))
      );

      toast.success("Driver updated successfully");
      closeModal();
    } catch (err) {
      if (err.response?.status === 400 && err.response.data.message?.toLowerCase().includes("zip")) {
        setZipError("Invalid ZIP code");
        return;
      }

      const errorMsg = err.response?.data?.message || "Failed to update driver";
      toast.error(errorMsg);
      setError(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setError(false);
        timeoutRef.current = null;
      }, ERROR_DISPLAY_DURATION);
    }
  }, [selectedDriver, closeModal]);

  const handleReserve = useCallback(async (driverId) => {
    try {
      const { data: updatedDriver } = await API.post("/dashboard/reserve", { driverId });
      toast.success(updatedDriver.message);

      setDrivers((prev) =>
        prev.map((d) => (d.id === updatedDriver.id ? updatedDriver : d))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Server error");
    }
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setSortByZip("");
    setRadius("");
    setGroup([]);
    setHideUnavailable(false);
    setHideOnLoad(false);
  }, []);

  const handlePhoneCall = useCallback((phone) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }, []);

  return (
    <div className="w-full p-4 dark:bg-gray-900 text-white dark:text-white min-h-screen">
      <h1 className="text-xl font-bold mb-6"></h1>

   {/* Form Section */}
<div className="bg-blue-500 dark:bg-gray-800 text-white shadow-md rounded-lg p-2 sm:p-3 mb-4 sm:mb-6">
  <div
    className={`grid ${
      role === "admin" || role === "sa" || role === "user"
        ? "gap-2 sm:gap-2 sm:grid-cols-4"
        : "gap-1 sm:gap-2 sm:grid-cols-3"
    }`}
  >
    {/* Search input */}
    <input
      type="text"
      placeholder="Search by name"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="w-full max-w-[180px] mx-auto p-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      aria-label="Search by name"
    />

    {/* ZIP input */}
    <input
      type="text"
      placeholder="Sort by ZIP"
      value={sortByZip}
      onChange={(e) => {
        const numericValue = e.target.value.replace(/\D/g, "");
        setSortByZip(numericValue);
      }}
      maxLength={ZIP_LENGTH}
      className={`w-full max-w-[180px] mx-auto p-1.5 text-xs rounded border ${
        sortByZip && !isValidZip ? "border-red-500" : "border-gray-300"
      } dark:border-gray-600 dark:bg-gray-700 dark:text-white`}
      aria-label="Sort by ZIP code"
    />

    {/* Radius input */}
    <input
      type="number"
      placeholder="Radius (miles)"
      value={radius}
      onChange={(e) => setRadius(e.target.value)}
      disabled={!isValidZip}
      className={`w-full max-w-[180px] mx-auto p-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${
        !isValidZip ? "opacity-50 cursor-not-allowed" : ""
      }`}
      aria-label="Radius in miles"
    />

    {/* Group filter pills */}
    {(role === "admin" || role === "sa" || role === "user") && (
      <div className="col-span-full">
        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
          Filter by group
        </label>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => {
              setGroup([]);
              const params = { search, hideOnLoad, hideUnavailable, ...(isValidZip && { zip: sortByZip, radius }) };
              fetchDrivers(params);
            }}
            className={`px-2 py-1 rounded-full text-xs font-medium transition ${
              group.length === 0
                ? "bg-blue-600 text-white border border-blue-600"
                : "bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900"
            }`}
          >
            All
          </button>
          {groupsList.map((g) => {
            const groupId = String(g.id);
            const selected = group.includes(groupId);
              return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  const next = selected
                    ? group.filter((id) => id !== groupId)
                    : [...group, groupId];
                  setGroup(next);
                  const params = {
                    search,
                    ...(next.length > 0 ? { group: next.join(",") } : {}),
                    hideOnLoad,
                    hideUnavailable,
                    ...(isValidZip && { zip: sortByZip, radius }),
                  };
                  fetchDrivers(params);
                }}
                className={`px-2 py-1 rounded-full text-xs font-medium transition ${
                  selected
                    ? "bg-blue-600 text-white border border-blue-600"
                    : "bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900"
                }`}
              >
                {g.name}
              </button>
            );
          })}
        </div>
      </div>
    )}

    {/* Switch buttons */}
    <div className="flex items-center gap-2 sm:gap-3 col-span-full sm:col-span-2 flex-wrap mt-1">
      <div className="flex items-center gap-1">
        <span className="text-xs dark:text-white">
          Hide Unavailable
        </span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={hideUnavailable}
            onChange={() => setHideUnavailable(!hideUnavailable)}
            aria-label="Hide unavailable drivers"
          />
          <div className="w-8 h-4 sm:w-9 sm:h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:bg-blue-600 transition-all"></div>
          <div className="absolute left-0.5 top-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full shadow-md transform peer-checked:translate-x-full transition-transform"></div>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs dark:text-white">Hide OnLoad</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={hideOnLoad}
            onChange={() => setHideOnLoad(!hideOnLoad)}
            aria-label="Hide drivers on load"
          />
          <div className="w-8 h-4 sm:w-9 sm:h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:bg-blue-600 transition-all"></div>
          <div className="absolute left-0.5 top-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-white rounded-full shadow-md transform peer-checked:translate-x-full transition-transform"></div>
        </label>
      </div>
    </div>

    {/* Clear button */}
    <div className="col-span-full flex justify-end mt-1 sm:mt-2">
      <button
        onClick={handleClearFilters}
        className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-2 rounded text-xs"
        aria-label="Clear all filters"
      >
        Clear
      </button>
    </div>
  </div>
</div>


      <div className="mb-3 text-md font-medium text-gray-700 dark:text-gray-300">
        Total Drivers: {drivers.length}
      </div>

      {/* Mobile Card View */}
      <div className="block lg:hidden space-y-4">
        {loading ? (
          <div className="p-8 text-center bg-gray-300 dark:bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-3">
            <div className="flex gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading drivers...</p>
          </div>
        ) : drivers.length === 0 ? (
          <div className="p-4 text-center bg-gray-300 dark:bg-gray-800 rounded-lg">
            No drivers found
          </div>
        ) : (
          drivers.map((driver) => (
            <div
              key={driver.id}
              className={`p-4 rounded-lg shadow-md flex flex-col ${
                driver.reserved_by
                  ? "bg-yellow-500 dark:bg-yellow-700"
                  : "bg-gray-300  dark:bg-gray-800 text-gray-800 dark:text-gray-300"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg">{driver.name}</h3>
                  <p className="text-sm">Unit: {driver.unit}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded ${getStatusClass(driver.available, driver.onload)}`}>
                  {getStatusText(driver.available, driver.onload)}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <button
                    onClick={() => handlePhoneCall(driver.phone)}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {driver.phone}
                  </button>
                </div>

                <div className="flex justify-between">
                  <span className="font-medium">Location:</span>
                  <a
                    href={`https://www.google.com/maps?q=${driver.latitude},${driver.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {driver.zip} - {driver.location}
                  </a>
                </div>

                {driver.distance && (
                  <div className="flex justify-between">
                    <span className="font-medium">Distance:</span>
                    <span>{driver.distance}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="font-medium">Date:</span>
                  <span>{driver.date}</span>
                </div>

                {driver.comments && (
                  <div>
                    <span className="font-medium">Comments:</span>
                    <p className="text-gray-700 dark:text-gray-300">{driver.comments}</p>
                  </div>
                )}

                {driver.groups?.length > 0 && (
                  <div className="flex justify-between">
                    <span className="font-medium">Groups:</span>
                    <span>{driver.groups.map((g) => g.name).join(", ")}</span>
                  </div>
                )}

                {driver.reserved_by && (
                  <div className="mt-2 p-2 bg-yellow-200 dark:bg-yellow-900 rounded">
                    <div className="font-medium">Reserved by: {driver.reserved_by_name || "Unknown"}</div>
                    <Timer startTime={driver.reserved_at} />
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-auto pt-4 justify-center">
                <button
                  onClick={() => openModal(driver)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleReserve(driver.id)}
                  className={`flex-1 py-2 px-4 rounded font-medium text-white ${
                    driver.reserved_by
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {driver.reserved_by ? "Cancel" : "Reserve"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto rounded-lg shadow-md">
        <table className="w-full table-auto border-collapse text-center bg-white dark:bg-gray-800">
          <thead>
            <tr className="bg-slate-50  dark:bg-gray-700 text-gray-800 dark:text-gray-300  ">
              <th className="p-2 text-xs">Unit</th>
              <th className="p-2 text-xs">Driver</th>
              <th className="p-2 text-xs">Details</th>
              <th className="p-2 text-xs">Location</th>
              <th className="p-2 text-xs">Date</th>
              <th className="p-2 text-xs">Status</th>
              <th className="p-2 text-xs">Comments</th>
              <th className="p-2 text-xs">Emergency</th>
              <th className="p-2 text-xs">Distance</th>
              <th className="p-2 text-xs">Group</th>
              <th className="p-2 text-xs">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-grey-300 text-gray-800 dark:text-gray-300    divide-gray-200 dark:divide-gray-800 font-bold  ">
            {loading ? (
              <tr>
                <td colSpan="11" className="p-8 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading drivers...</p>
                  </div>
                </td>
              </tr>
            ) : drivers.length === 0 ? (
              <tr>
                <td colSpan="11" className="p-4 text-center">
                  No drivers found
                </td>
              </tr>
            ) : (
              drivers.map((driver) => (
                <tr
                  key={driver.id}
                  className={`transition-all text-xs ${
                    driver.reserved_by
                      ? "bg-yellow-600 dark:bg-yellow-700 dark:hover:bg-yellow-600 hover:bg-yellow-500"
                      : "dark:bg-gray-700"
                  } border-t dark:border-gray-800  hover:bg-slate-200  dark:hover:bg-gray-600`}
                >
                  <td className="p-1.5">{driver.unit}</td>
                  <td className="p-1.5">
                    <div className="font-bold">{driver.name}</div>
                    <button
                      onClick={() => handlePhoneCall(driver.phone)}
                      className="text-blue-500 hover:text-blue-600 hover:underline text-xs"
                      aria-label={`Call ${driver.name}`}
                    >
                      {driver.phone}
                    </button>
                  </td>
                  <td className="p-1.5">
                    <div>D: {driver.dimensions}</div>
                    <div>P: {driver.payload}</div>
                    <div>LP: {driver.license_plate}</div>
                  </td>
                  <td className="p-1.5">
                    <a
                      href={`https://www.google.com/maps?q=${driver.latitude},${driver.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                      aria-label="View location on map"
                    >
                      {driver.zip}
                    </a>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{driver.location}</div>
                  </td>
                  <td className="p-1.5 text-xs">{driver.date}</td>
                  <td className="p-1.5">
                    <div className={`text-xs font-semibold px-1.5 py-0.5 rounded mb-1 ${getStatusClass(driver.available, driver.onload)}`}>
                      {getStatusText(driver.available, driver.onload)}
                    </div>
                    <div className={`text-xs px-1.5 py-0.5 rounded mb-1 ${getDateBadgeClass(driver.insurance_date)}`}>
                      I: {formatDateDDMMYYYY(driver.insurance_date)}
                    </div>
                    <div className={`text-xs px-1.5 py-0.5 rounded ${getDateBadgeClass(driver.registration_date)}`}>
                      R: {formatDateDDMMYYYY(driver.registration_date)}
                    </div>
                  </td>
                  <td className="p-1.5 max-w-[150px] truncate" title={driver.comments}>
                    {driver.comments}
                  </td>
                  <td className="p-1.5">{driver.emergency}</td>
                  <td className="p-1.5">{driver.distance}</td>
                  <td className="p-1.5 max-w-[120px] truncate" title={driver.groups?.map((g) => g.name).join(", ")}>
                    {driver.groups?.length > 0 ? driver.groups.map((g) => g.name).join(", ") : "-"}
                  </td>
                  <td className="p-1.5 w-[110px]">
                    <div className="flex flex-col gap-0.5 min-h-[48px] justify-center">
                      <button
                        onClick={() => openModal(driver)}
                        className="text-blue-500 hover:text-blue-400 text-xs font-medium text-left leading-none"
                        aria-label={`Edit ${driver.name}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleReserve(driver.id)}
                        className={`text-xs font-medium text-left leading-none ${
                          driver.reserved_by
                            ? "text-red-500 hover:text-red-400"
                            : "text-green-500 hover:text-green-400"
                        }`}
                        aria-label={driver.reserved_by ? `Cancel reservation for ${driver.name}` : `Reserve ${driver.name}`}
                      >
                        {driver.reserved_by ? "Cancel" : "Reserve"}
                      </button>
                      <div className="text-[10px] text-gray-500 dark:text-gray-300 truncate leading-none">
                        {driver.reserved_by
                          ? driver.reserved_by_name || `User #${driver.reserved_by}`
                          : "\u00A0"}
                      </div>
                      <div className="text-[10px] leading-none">
                          {driver.reserved_by
                            ? <Timer startTime={driver.reserved_at} />
                            : "\u00A0"}
                        </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {isModalOpen && selectedDriver && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Carrier
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</label>
                <p className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  {selectedDriver.location}
                </p>
              </div>

              <div>
                <label className="block mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ZIP</label>
                <input
                  type="text"
                  value={selectedDriver.zip}
                  onChange={(e) => {
                    setSelectedDriver({ ...selectedDriver, zip: e.target.value });
                    setZipError("");
                  }}
                  className={`w-full p-2.5 rounded-lg border text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    zipError ? "border-red-500" : "border-gray-300 dark:border-gray-600"
                  }`}
                  aria-label="ZIP code"
                />
                {zipError && <p className="text-red-500 text-xs mt-1">{zipError}</p>}
                {error && <p className="text-red-500 text-xs mt-1">Something went wrong. Please try again.</p>}
              </div>

              <div>
                <label className="block mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date and Time</label>
                <input
                  type="datetime-local"
                  value={selectedDriver?.date || ""}
                  onChange={(e) =>
                    setSelectedDriver({ ...selectedDriver, date: e.target.value })
                  }
                  className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Date and time"
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <span className="text-sm font-medium">Onload:</span>
                  <div className="relative w-11 h-6">
                    <input
                      type="checkbox"
                      checked={selectedDriver.onload === 1}
                      onChange={() => {
                        setSelectedDriver({
                          ...selectedDriver,
                          onload: selectedDriver.onload === 1 ? 0 : 1,
                        });
                      }}
                      className="sr-only"
                      id="onload-switch"
                    />
                    <div
                      className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                        selectedDriver.onload === 1 ? "bg-amber-400" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    ></div>
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                        selectedDriver.onload === 1 ? "translate-x-5" : "translate-x-0"
                      }`}
                    ></div>
                  </div>
                  <span className="text-sm">{selectedDriver.onload === 1 ? "Yes" : "No"}</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <span className="text-sm font-medium">Unavailable:</span>
                  <div className="relative w-11 h-6">
                    <input
                      type="checkbox"
                      checked={selectedDriver.available === 0}
                      onChange={() => {
                        setSelectedDriver({
                          ...selectedDriver,
                          available: selectedDriver.available === 0 ? 1 : 0,
                        });
                      }}
                      className="sr-only"
                      id="unavailable-switch"
                    />
                    <div
                      className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                        selectedDriver.available === 0 ? "bg-red-500" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    ></div>
                    <div
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                        selectedDriver.available === 0 ? "translate-x-5" : "translate-x-0"
                      }`}
                    ></div>
                  </div>
                  <span className="text-sm">
                    {selectedDriver.available === 0 ? "Yes" : "No"}
                  </span>
                </label>
              </div>

              <div>
                <label className="block mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comments</label>
                <textarea
                  rows="3"
                  value={selectedDriver.comments}
                  onChange={(e) =>
                    setSelectedDriver({
                      ...selectedDriver,
                      comments: e.target.value,
                    })
                  }
                  className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Comments"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
