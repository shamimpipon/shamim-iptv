// Resolves a possibly-relative URL (e.g. "/stream.ts" or "stream.ts") against
// a base URL. Real-world M3U playlists almost always use absolute URLs, but
// some serve relative paths meant to be resolved against the playlist's own
// URL — this keeps the checker robust for those cases too.
function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).toString();
  } catch {
    return relative;
  }
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

module.exports = { resolveUrl, isAbsoluteHttpUrl };
