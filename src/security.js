const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isBlockedUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (!["http:", "https:"].includes(u.protocol)) return true;
    const hostname = u.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname)) return true;
    if (isPrivateIPv4(hostname)) return true;
    if (hostname.endsWith(".local")) return true;
    if (hostname.startsWith("[")) return true; // raw IPv6 literals blocked for safety
    return false;
  } catch {
    return true;
  }
}

module.exports = { isBlockedUrl, isPrivateIPv4 };
