import { useState } from "react";
import API from "../api/axios";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      const res = await API.post("/auth/register", { name, email, password });
      console.log(res.data);
      alert("Registration successful!");
    } catch {
      alert("Registration failed");
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl mb-4">Register</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="border p-2 w-full mb-2"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="border p-2 w-full mb-2"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="border p-2 w-full mb-2"
      />
      <button
        onClick={handleRegister}
        className="bg-blue-500 text-white px-4 py-2 w-full"
      >
        Register
      </button>
    </div>
  );
};

export default Register;
