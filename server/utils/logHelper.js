export const getRequestMeta = (req) => {
  const ip = req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.ip
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || "Unknown";
  const device = req.headers?.["user-agent"] || "Unknown";
  return { ip, device };
};
