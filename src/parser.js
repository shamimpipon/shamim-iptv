function parseExtinf(line) {
  const commaIdx = line.indexOf(",");
  const attrsPart = commaIdx >= 0 ? line.slice(0, commaIdx) : line;
  const name = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : "";
  const attrs = {};
  const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
  let m;
  while ((m = attrRegex.exec(attrsPart))) {
    attrs[m[1].toLowerCase()] = m[2];
  }
  return {
    name: name || attrs["tvg-name"] || "Unknown",
    tvgId: attrs["tvg-id"] || null,
    tvgName: attrs["tvg-name"] || null,
    logo: attrs["tvg-logo"] || null,
    group: attrs["group-title"] || "Uncategorized",
  };
}

function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const channels = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTM3U")) continue;

    if (line.startsWith("#EXTINF")) {
      current = parseExtinf(line);
      continue;
    }

    if (
      line.startsWith("#EXTVLCOPT") ||
      line.startsWith("#EXTGRP") ||
      line.startsWith("#KODIPROP")
    ) {
      if (current) {
        const uaMatch = line.match(/http-user-agent=(.+)/i);
        const refMatch = line.match(/http-referrer=(.+)/i);
        if (uaMatch)
          current.headers = {
            ...(current.headers || {}),
            "User-Agent": uaMatch[1].trim(),
          };
        if (refMatch)
          current.headers = {
            ...(current.headers || {}),
            Referer: refMatch[1].trim(),
          };
      }
      continue;
    }

    if (line.startsWith("#")) continue;

    // URL line
    if (current) {
      channels.push({ ...current, url: line });
      current = null;
    } else {
      channels.push({ name: line, url: line, group: "Uncategorized" });
    }
  }

  return channels;
}

module.exports = { parseM3U, parseExtinf };
