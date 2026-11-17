import { io } from "socket.io-client";

// Single-service mode: same origin. Split mode: set VITE_SOCKET_URL at build time
// to the backend public URL (e.g. https://back-production.up.railway.app).
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : window.location.origin);

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  withCredentials: true,
  autoConnect: false,
});

export default socket;
