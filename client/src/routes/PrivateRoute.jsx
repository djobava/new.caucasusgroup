// client/src/routes/PrivateRoute.jsx

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PrivateRoute = ({ children, allowedRoles }) => {
  const { role, loading } = useAuth();

  // ✅ მნიშვნელოვანია - loading state-ის შემოწმება
  if (loading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  // ✅ თუ არ არის authenticated
  if (!role) {
    return <Navigate to="/login" replace />;
  }

  // ✅ თუ allowedRoles მითითებულია და role არ შედის
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PrivateRoute;