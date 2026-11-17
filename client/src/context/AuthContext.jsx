import { createContext, useContext, useState, useEffect, useRef } from "react";
import API from "../api/axios";
import socket from "../socket";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [role, setRole]     = useState(null);
  const [email, setEmail]   = useState(null);
  const [name, setName]     = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const loggedInRef = useRef(false);

  const emitConnected = (id) => {
    if (id) {
      if (!socket.connected) socket.connect();
      socket.emit("user_connected");
    }
  };

  const login = (userRole, userEmail, userName, userIdVal) => {
    setRole(userRole);
    setEmail(userEmail);
    setName(userName);
    setUserId(userIdVal);
    loggedInRef.current = true;
    emitConnected(userIdVal);
  };

  const logout = async () => {
    setRole(null);
    setEmail(null);
    setName(null);
    setUserId(null);
    loggedInRef.current = false;
    socket.disconnect();
    try { await API.post("/auth/logout"); }
    catch (err) { console.error("Logout error:", err.message); }
  };

  // Initial auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await API.get("/auth/check");
        setEmail(res.data.email);
        setRole(res.data.role);
        setName(res.data.name);
        setUserId(res.data.id);
        loggedInRef.current = true;
        emitConnected(res.data.id);
      } catch {
        if (!loggedInRef.current) {
          setRole(null); setEmail(null); setName(null); setUserId(null);
        }
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) return <div className="p-4 text-center dark:text-gray-300">Authenticating...</div>;

  return (
    <AuthContext.Provider value={{ role, email, name, userId, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
