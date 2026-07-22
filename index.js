#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { parseM3U } = require("./src/parser");
const { checkChannel } = require("./src/checker");
const { runWithConcurrency } = require("./src/pool");
const { dedupeChannelsByUrl, pickBestPerGroup } = require("./src/dedupe");
const { toM3U } = require("./src/exporter");
const { resolveUrl, isAbsoluteHttpUrl } = require("./src/urls");
const baseConfig = require("./config");

function parseArgs(argv) {
  const args = { inputs: [], output: "./output" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input" || a === "-i") args.inputs.push(argv[++i]);
    else if (a === "--output" || a === "-o") args.output = argv[++i];
    else if (a === "--concurrency" || a === "-c")
      args.concurrency = parseInt(argv[++i], 10);
    else if (a === "--timeout" || a === "-t")
      args.timeoutMs = parseInt(argv[++i], 10);
    else if (a === "--retries") args.retries = parseInt(argv[++i], 10);
    else if (a === "--allow-private-hosts") args.allowPrivateHosts = true;
    else if (a === "--no-history") args.noHistory = true;
    else if (!a.startsWith("-")) args.inputs.push(a);
  }
  return args;
}

async function readSource(source) {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source, {
      headers: { "User-Agent": baseConfig.userAgent },
    });
    if (!res.ok)
      throw new Error(
        `Failed to fetch playlist source ${source}: HTTP ${res.status}`,
      );
    return res.text();
  }
  return fs.readFileSync(path.resolve(source), "utf8");
}

async function withRetries(channel, cfg) {
  let last;
  const maxRetries = cfg.retries ?? baseConfig.retries;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    last = await checkChannel(channel, cfg);
    if (["online", "unstable"].includes(last.status)) return last;
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, baseConfig.retryDelayMs));
    }
  }
  return last;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.inputs.length === 0) {
    console.error(
      "Usage: node index.js --input <playlist-url-or-file> [--output ./output] [--concurrency 20]",
    );
    process.exit(1);
  }

  const cfg = {
    ...baseConfig,
    concurrency: args.concurrency || baseConfig.concurrency,
    timeoutMs: args.timeoutMs || baseConfig.timeoutMs,
    retries: args.retries ?? baseConfig.retries,
    allowPrivateHosts: !!args.allowPrivateHosts,
  };

  console.log(`[iptv-checker] Loading ${args.inputs.length} source(s)...`);
  let allChannels = [];
  for (const source of args.inputs) {
    const text = await readSource(source);
    let parsed = parseM3U(text);
    if (isAbsoluteHttpUrl(source)) {
      // Resolve relative channel URLs (rare, but some playlists use them)
      // against the playlist's own source URL.
      parsed = parsed.map((ch) => ({ ...ch, url: resolveUrl(source, ch.url) }));
    }
    console.log(
      `[iptv-checker] Parsed ${parsed.length} entries from ${source}`,
    );
    allChannels = allChannels.concat(parsed);
  }

  const deduped = dedupeChannelsByUrl(allChannels);
  console.log(
    `[iptv-checker] ${allChannels.length} entries -> ${deduped.length} unique URLs after dedupe`,
  );

  const startedAt = Date.now();
  console.log(
    `[iptv-checker] Checking with concurrency=${cfg.concurrency}, timeout=${cfg.timeoutMs}ms...`,
  );

  const results = await runWithConcurrency(
    deduped,
    cfg.concurrency,
    (channel) => withRetries(channel, cfg),
  );

  const durationMs = Date.now() - startedAt;
  console.log(
    `[iptv-checker] Checked ${results.length} channels in ${durationMs}ms`,
  );

  const summary = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  fs.mkdirSync(args.output, { recursive: true });

  const output = {
    generatedAt: new Date().toISOString(),
    durationMs,
    totalChecked: results.length,
    summary,
    results,
  };

  fs.writeFileSync(
    path.join(args.output, "results.json"),
    JSON.stringify(output, null, 2),
  );

  const workingResults = results.filter((r) =>
    ["online", "unstable"].includes(r.status),
  );
  fs.writeFileSync(
    path.join(args.output, "working.m3u"),
    toM3U(workingResults),
  );

  const bestResults = pickBestPerGroup(workingResults).sort(
    (a, b) => b.score - a.score,
  );
  fs.writeFileSync(
    path.join(args.output, "best_working.m3u"),
    toM3U(bestResults),
  );

  if (!args.noHistory) {
    const historyDir = path.join(args.output, "history");
    fs.mkdirSync(historyDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(
      path.join(historyDir, `${stamp}.json`),
      JSON.stringify(output, null, 2),
    );
  }

  console.log("[iptv-checker] Summary:", summary);
  console.log(
    `[iptv-checker] Wrote results.json, working.m3u, best_working.m3u to ${args.output}`,
  );
}

main().catch((err) => {
  console.error("[iptv-checker] Fatal error:", err);
  process.exit(1);
});
