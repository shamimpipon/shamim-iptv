function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    const params = new URLSearchParams(u.search);
    const sorted = new URLSearchParams([...params.entries()].sort());
    u.search = sorted.toString();
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function dedupeChannelsByUrl(channels) {
  const map = new Map();
  const order = [];
  for (const ch of channels) {
    const key = normalizeUrl(ch.url);
    if (!map.has(key)) {
      map.set(key, { ...ch, normalizedUrl: key, duplicatesOf: [] });
      order.push(key);
    } else {
      map.get(key).duplicatesOf.push(ch.name);
    }
  }
  return order.map((k) => map.get(k));
}

function groupKeyFor(result) {
  if (result.tvgId) return `id:${result.tvgId.toLowerCase()}`;
  return `name:${(result.name || "").trim().toLowerCase()}`;
}

function pickBestPerGroup(results) {
  const groups = new Map();
  for (const r of results) {
    const key = groupKeyFor(r);
    const existing = groups.get(key);
    if (!existing || r.score > existing.score) {
      groups.set(key, r);
    }
  }
  return [...groups.values()];
}

module.exports = {
  normalizeUrl,
  dedupeChannelsByUrl,
  groupKeyFor,
  pickBestPerGroup,
};
