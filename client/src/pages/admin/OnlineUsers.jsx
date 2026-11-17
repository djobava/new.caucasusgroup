import { useEffect, useState, useRef, useContext } from "react";
import API from "../../api/axios";
import { AuthContext } from "../../context/AuthContext";
import socket from "../../socket";

const ROLE_BADGE = {
  sa:    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  hr:    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  user:  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const avatar = (name = "") => name.charAt(0).toUpperCase();

const fmtDuration = (seconds) => {
  const s = parseInt(seconds, 10);
  if (!s || s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const fmtDate = (dt) => {
  if (!dt) return "—";
  const d = new Date(dt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

// ─── Live duration counter for current online users ───────────────────────────
const LiveDuration = ({ connectedAt }) => {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const start = new Date(connectedAt).getTime();
    const tick = () => setSecs(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [connectedAt]);
  return <span className="font-mono text-xs text-green-600 dark:text-green-400">{fmtDuration(secs)}</span>;
};

const StatCard = ({ label, value, color, sub }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color || "text-gray-900 dark:text-white"}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

export default function OnlineUsers() {
  const [online, setOnline]   = useState([]);
  const [summary, setSummary] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [kickingOff, setKickingOff] = useState(null);
  const initialized = useRef(false);
  const { role } = useContext(AuthContext);

  const fetchOnline = async () => {
    try {
      const res = await API.get("/online");
      setOnline(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchStats = async () => {
    try {
      const res = await API.get("/online/stats");
      setSummary(res.data.summary || []);
      setSessions(res.data.sessions || []);
    } catch (err) { console.error(err); }
  };

  const handleClearSessionHistory = async () => {
    if (!window.confirm("Are you sure you want to clear all session history? This cannot be undone.")) {
      return;
    }
    try {
      setLoading(true);
      await API.delete("/online/sessions/clear");
      setSessions([]);
      setSelectedUser(null);
      alert("Session history cleared successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to clear session history");
    } finally {
      setLoading(false);
    }
  };

  const handleKickOff = async (userId, userName, userRole) => {
    if (userRole === "sa") {
      alert("Cannot kick off super admin users");
      return;
    }
    
    if (!window.confirm(`Kick off ${userName}?`)) {
      return;
    }

    try {
      setKickingOff(userId);
      await API.post(`/online/${userId}/kick-off`);
      setOnline((prev) => prev.filter((u) => u.id !== userId));
      alert(`${userName} has been kicked off successfully`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to kick off user");
    } finally {
      setKickingOff(null);
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    Promise.all([fetchOnline(), fetchStats()]).finally(() => setLoading(false));

    socket.on("onlineUsersUpdated", (users) => setOnline(users || []));
    return () => socket.off("onlineUsersUpdated");
  }, []);

  // Sessions for selected user (or all if none selected)
  const visibleSessions = selectedUser
    ? sessions.filter((s) => s.user_id === selectedUser)
    : sessions;

  const selectedUserName = summary.find((u) => u.id === selectedUser)?.name;

  const totalOnlineSeconds = summary.reduce((a, u) => a + (u.total_seconds || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>
  );

  return (
    <div className="p-4 max-w-7xl mx-auto dark:bg-gray-900 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Online Users</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Session tracking & history</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-ping inline-block"></span>
          <span className="text-xs text-gray-500 dark:text-gray-400">Live</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Online Now"     value={online.length}
          color="text-green-600 dark:text-green-400"
          sub={online.length === 0 ? "nobody online" : "active now"} />
        <StatCard label="Total Users"    value={summary.length}
          color="text-gray-900 dark:text-white" />
        <StatCard label="Total Sessions" value={sessions.length}
          color="text-blue-600 dark:text-blue-400" />
        <StatCard label="Total Online Time" value={fmtDuration(totalOnlineSeconds)}
          color="text-purple-600 dark:text-purple-400" />
      </div>

      {/* ── Currently Online ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          Currently Online ({online.length})
        </h3>

        {online.length === 0 ? (
          <p className="text-sm text-gray-400">No users online</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {online.map((u) => (
              <div key={u.id}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {avatar(u.name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-none">{u.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{u.email}</p>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                    <LiveDuration connectedAt={u.connected_at} />
                  </div>
                </div>
                {(role === "admin" || role === "sa") && u.role !== "sa" && (
                  <button
                    onClick={() => handleKickOff(u.id, u.name, u.role)}
                    disabled={kickingOff === u.id}
                    className="ml-2 px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {kickingOff === u.id ? "..." : "Kick"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Session Summary Table ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Session Summary</span>
          <span className="ml-2 text-xs text-gray-400">click a row to see their sessions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Sessions</th>
                <th className="px-5 py-3 text-center">This Week</th>
                <th className="px-5 py-3 text-center">This Month</th>
                <th className="px-5 py-3 text-center">Total</th>
                <th className="px-5 py-3">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {summary.map((u) => {
                const isOnline  = online.some((o) => o.id === u.id);
                const isSelected = selectedUser === u.id;
                return (
                  <tr key={u.id}
                    onClick={() => setSelectedUser(isSelected ? null : u.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : isOnline
                        ? "bg-green-50/40 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                          isOnline ? "bg-green-500" : "bg-gray-400 dark:bg-gray-600"
                        }`}>
                          {avatar(u.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white leading-none">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${ROLE_BADGE[u.role] || ROLE_BADGE.user}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          Online
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Offline</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center font-mono text-sm text-gray-700 dark:text-gray-300">
                      {u.total_sessions}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-sm font-mono text-blue-600 dark:text-blue-400">
                        {fmtDuration(u.week_seconds)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-sm font-mono text-purple-600 dark:text-purple-400">
                        {fmtDuration(u.month_seconds)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">
                        {fmtDuration(u.total_seconds)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 font-mono">
                      {fmtDate(u.last_seen)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Session History ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              Session History
            </span>
            {selectedUser && (
              <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                — {selectedUserName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedUser && (
              <button onClick={() => setSelectedUser(null)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                Show all ✕
              </button>
            )}
            <button onClick={handleClearSessionHistory}
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-medium transition">
              Clear Data
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Connected</th>
                <th className="px-5 py-3">Disconnected</th>
                <th className="px-5 py-3 text-center">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {visibleSessions.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No sessions yet</td></tr>
              ) : (
                visibleSessions.slice(0, 50).map((s) => {
                  const user = summary.find((u) => u.id === s.user_id);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                            {avatar(user?.name)}
                          </div>
                          <span className="text-xs text-gray-700 dark:text-gray-300">{user?.name || `User #${s.user_id}`}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {fmtDate(s.connected_at)}
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {fmtDate(s.disconnected_at)}
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <span className={`font-mono text-xs font-medium px-2 py-0.5 rounded ${
                          s.duration_seconds > 3600
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                            : s.duration_seconds > 600
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        }`}>
                          {fmtDuration(s.duration_seconds)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
