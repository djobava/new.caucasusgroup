import { useEffect, useState, useCallback } from "react";
import API from "../../api/axios";
import socket from "../../socket";
import { useAuth } from "../../context/AuthContext";

const ACTION_COLORS = {
  login:          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  logout:         "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  create_user:    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  create_driver:  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  update_driver:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  delete_billing: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  reserve_driver: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  create_group:   "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

const ActionBadge = ({ action }) => {
  const cls = ACTION_COLORS[action] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {action.replace(/_/g, " ")}
    </span>
  );
};

const EMPTY_FILTERS = { userId: "", action: "", from: "", to: "" };

export default function Logs() {
  const { role } = useAuth();
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [newCount, setNewCount] = useState(0); // live indicator

  const fetchLogs = useCallback(async (p = 1, f = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 50, page: p });
      if (f.userId) params.append("userId", f.userId);
      if (f.action) params.append("action", f.action);
      if (f.from)   params.append("from", f.from);
      if (f.to)     params.append("to", f.to);
      const res = await API.get(`/logs?${params.toString()}`);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || p);
      setNewCount(0);
    } catch (err) {
      console.error("Failed to load logs", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Join superadmin room and listen for real-time logs
  useEffect(() => {
    if (role === "sa") {
      socket.emit("join_room");

      socket.on("new_log", (log) => {
        setLogs((prev) => [log, ...prev.slice(0, 49)]);
        setTotal((prev) => prev + 1);
        setNewCount((prev) => prev + 1);
      });
    }

    fetchLogs(1);

    return () => {
      socket.off("new_log");
    };
  }, []);

  const handleFilter = (e) => { e.preventDefault(); fetchLogs(1, filters); };
  const handleReset  = () => { setFilters(EMPTY_FILTERS); fetchLogs(1, EMPTY_FILTERS); };
  const totalPages   = Math.ceil(total / 50) || 1;

  return (
    <div className="p-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Audit Logs</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Superadmin — all system activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          {newCount > 0 && (
            <span className="px-3 py-1 bg-green-500 text-white text-xs rounded-full animate-pulse">
              +{newCount} new
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-ping inline-block"></span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">User ID</label>
          <input type="number" placeholder="e.g. 3" value={filters.userId}
            onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-28" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Action</label>
          <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
            <option value="">All actions</option>
            <option value="login">login</option>
            <option value="logout">logout</option>
            <option value="create_user">create user</option>
            <option value="create_driver">create driver</option>
            <option value="update_driver">update driver</option>
            <option value="delete_billing">delete billing</option>
            <option value="reserve_driver">reserve driver</option>
            <option value="create_group">create group</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">From</label>
          <input type="datetime-local" value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">To</label>
          <input type="datetime-local" value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
        </div>
        <button type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium">
          Filter
        </button>
        <button type="button" onClick={handleReset}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-lg font-medium">
          Reset
        </button>
      </form>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Total: <strong className="text-gray-900 dark:text-white">{total}</strong> records
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Page <strong className="text-gray-900 dark:text-white">{page}</strong> of {totalPages}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Object</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No records found</td></tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono text-xs">#{l.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-200">
                          {l.user_id || "?"}
                        </div>
                        <span className="text-gray-700 dark:text-gray-300 text-xs">
                          {l.username || `User #${l.user_id}` || "System"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><ActionBadge action={l.action} /></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                      {l.object_type || "—"}
                      {l.object_id ? <span className="ml-1 text-gray-400">#{l.object_id}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{l.ip_address || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{l.device_info || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-xs truncate" title={l.details}>{l.details || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap font-mono">{l.created_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <button onClick={() => fetchLogs(Math.max(1, page - 1))} disabled={page <= 1 || loading}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            ← Previous
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">{page} / {totalPages}</span>
          <button onClick={() => fetchLogs(page + 1)} disabled={page >= totalPages || loading}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
