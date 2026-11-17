import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const RoleRedirect = () => {
  const { role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!role) return;
    if (role === "hr") navigate("/hr");
    else navigate("/dashboard");
  }, [role, navigate]);

  return null;
};

export default RoleRedirect;