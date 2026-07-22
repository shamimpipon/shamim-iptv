function toM3U(results) {
  const lines = ["#EXTM3U"];
  for (const r of results) {
    const attrs = [];
    if (r.tvgId) attrs.push(`tvg-id="${r.tvgId}"`);
    if (r.logo) attrs.push(`tvg-logo="${r.logo}"`);
    attrs.push(`group-title="${r.group || "Uncategorized"}"`);
    lines.push(`#EXTINF:-1 ${attrs.join(" ")},${r.name}`);
    lines.push(r.url);
  }
  return lines.join("\n") + "\n";
}

module.exports = { toM3U };
