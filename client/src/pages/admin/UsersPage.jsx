import { useEffect, useState } from "react";
import API from "../../api/axios";
import { toast } from "sonner";

const ROLE_BADGE = {
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  hr:    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  user:  "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  sa:    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

const EMPTY_FORM = { name: "", email: "", password: "", role: "user", groups: [] };

const UsersPage = () => {
  const [users, setUsers]         = useState([]);
  const [groups, setGroups]       = useState([]);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { fetchUsers(); fetchGroups(); }, []);

  const fetchUsers = async () => {
    try { const res = await API.get("/users"); setUsers(res.data); }
    catch { toast.error("Failed to load users"); }
  };

  const fetchGroups = async () => {
    try { const res = await API.get("/groups"); setGroups(res.data); }
    catch { toast.error("Failed to load groups"); }
  };

  const resetForm = () => { setForm(EMPTY_FORM); setEditingUser(null); };

  const handleField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleGroup = (id) => {
    setForm((f) => ({
      ...f,
      groups: f.groups.includes(id)
        ? f.groups.filter((g) => g !== id)
        : [...f.groups, id],
    }));
  };

  const handleEditUser = (user) => {
    if (user.role === "sa") return;
    // user.groups is array of names — map to IDs
    const groupIds = groups
      .filter((g) => user.groups.includes(g.name))
      .map((g) => g.id);
    setForm({ name: user.name, email: user.email, password: "", role: user.role, groups: groupIds });
    setEditingUser(user);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email) { toast.error("Name and email are required"); return; }
    if (!editingUser && !form.password) { toast.error("Password is required"); return; }
    if (form.role === "sa") { toast.error("Cannot assign Super Admin role"); return; }

    setLoading(true);
    try {
      if (editingUser) {
        await API.put(`/users/${editingUser.id}`, {
          name: form.name,
          email: form.email,
          role: form.role,
          password: form.password || undefined,
          groups: form.groups,
        });
        toast.success("User updated successfully");
      } else {
        await API.post("/users", {
          name: form.name,
          email: form.email,
          role: form.role,
          password: form.password,
          groups: form.groups,
        });
        toast.success("User added successfully");
      }
      resetForm();
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/users/${id}`);
      toast.success("User deleted");
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete user");
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto dark:bg-gray-900 min-h-screen">
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">User Management</h2>

      {/* Form Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-8 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          {editingUser ? `Editing: ${editingUser.name}` : "Add New User"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Full Name</label>
            <input type="text" placeholder="John Doe" value={form.name}
              onChange={(e) => handleField("name", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email</label>
            <input type="email" placeholder="john@example.com" value={form.email}
              onChange={(e) => handleField("email", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Password {editingUser && <span className="text-gray-400">(leave blank to keep current)</span>}
            </label>
            <input type="password" placeholder={editingUser ? "New password (optional)" : "Password"}
              value={form.password} onChange={(e) => handleField("password", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Role</label>
            <select value={form.role} onChange={(e) => handleField("role", e.target.value)} className={inputCls}>
              <option value="user">User</option>
              <option value="hr">HR</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {/* Groups */}
        <div className="mb-5">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Groups</label>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const selected = form.groups.includes(g.id);
              return (
                <button key={g.id} type="button" onClick={() => toggleGroup(g.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selected
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color || "#6b7280" }} />
                  {g.name}
                  {selected && <span className="ml-0.5">✓</span>}
                </button>
              );
            })}
            {groups.length === 0 && <span className="text-xs text-gray-400">No groups available</span>}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleSubmit} disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition">
            {loading ? "Saving..." : editingUser ? "Update User" : "Add User"}
          </button>
          {editingUser && (
            <button onClick={resetForm}
              className="px-5 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Users <span className="ml-1 text-gray-400 font-normal">({users.length})</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Groups</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No users found</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-200 flex-shrink-0">
                          {user.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{user.email}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${ROLE_BADGE[user.role] || ROLE_BADGE.user}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.groups?.length > 0 ? (
                          user.groups.map((gName) => {
                            const g = groups.find((gr) => gr.name === gName);
                            return (
                              <span key={gName}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                                <span className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: g?.color || "#6b7280" }} />
                                {gName}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {user.role !== "sa" ? (
                          <>
                            <button onClick={() => handleEditUser(user)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                              Edit
                            </button>
                            {deleteConfirm === user.id ? (
                              <span className="flex items-center gap-1.5">
                                <button onClick={() => handleDelete(user.id)}
                                  className="text-xs font-medium text-red-600 hover:text-red-500">Confirm</button>
                                <button onClick={() => setDeleteConfirm(null)}
                                  className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                              </span>
                            ) : (
                              <button onClick={() => setDeleteConfirm(user.id)}
                                className="text-xs font-medium text-red-500 hover:text-red-400">
                                Delete
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
