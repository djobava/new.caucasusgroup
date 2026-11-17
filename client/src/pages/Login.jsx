import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaChecked, setCaptchaChecked] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!captchaChecked) {
      setError(true);
      setTimeout(() => setError(false), 3000);
      return;
    }

    try {
      const res = await API.post("/auth/login", { email, password });
      // save to auth context (role, email, name) so other components see auth immediately
      login(res.data.role, res.data.email, res.data.name, res.data.id);
      const role = res.data.role;

      // Need to remove this console log before production
      console.log("Login successful:", res.data);
      
      // Redirect based on role
      if (role === "hr") {
        navigate("/hr");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err.message);
      setError(true);
      setTimeout(() => setError(false), 3000);
    }
  };

  const inputClass =
    "border p-1.5 w-full rounded-lg transition outline-none focus:border-blue-500 " +
    (error ? "border-red-500" : "border-gray-300 dark:border-gray-600") +
    " bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm";

  return (
    <div className="p-4 max-w-sm mx-auto min-h-[70vh] mt-[5px] flex flex-col justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white overflow-auto">
      <div className="max-h-[80vh] flex flex-col justify-center space-y-3">
        <h2 className="text-xl font-bold mb-4 text-center">Login</h2>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={`${inputClass} mb-3`}
            required
            autoComplete="on"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={`${inputClass} mb-3`}
            required
            autoComplete="on"
          />

          <div className="flex items-center gap-3 mb-3">
            <input
              id="captcha-check"
              type="checkbox"
              checked={captchaChecked}
              onChange={(e) => setCaptchaChecked(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="captcha-check" className="text-sm text-gray-700 dark:text-gray-300">
              I am not a robot
            </label>
          </div>

          {error && (
            <p className="text-red-500 mb-3 text-sm text-center">
              {captchaChecked ? "Invalid email or password" : "Please confirm you are not a robot"}
            </p>
          )}

          <button
            type="submit"
            disabled={!captchaChecked}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold px-4 py-1.5 w-full rounded-lg transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;