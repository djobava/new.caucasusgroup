import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PublicRoute = ({ children }) => {
  const { role, loading } = useAuth();
  if (loading) return null;
  return !role ? children : <Navigate to="/" />;
};

export default PublicRoute;
