const { isBlockedUrl } = require("./security");

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      redirect: "follow",
      signal: controller.signal,
    });
    return { res, error: null };
  } catch (error) {
    return { res: null, error };
  } finally {
    clearTimeout(timer);
  }
}

async function safeRequest(
  url,
  {
    method = "GET",
    headers = {},
    timeoutMs = 8000,
    allowPrivateHosts = false,
  } = {},
) {
  if (!allowPrivateHosts && isBlockedUrl(url)) {
    return { blocked: true };
  }
  return fetchWithTimeout(url, { method, headers }, timeoutMs);
}

module.exports = { fetchWithTimeout, safeRequest };
