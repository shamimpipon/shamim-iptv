const { safeRequest } = require("./http");
const { resolveUrl } = require("./urls");
const config = require("../config");

function nowMs() {
  return Date.now();
}

function classifyByStatusCode(status) {
  if (status === 403) return "forbidden";
  if (status === 451) return "geo_blocked";
  if (status >= 200 && status < 300) return "ok";
  if (status >= 300 && status < 400) return "redirect";
  if (status === 404 || status >= 400) return "offline";
  return "unknown";
}

function isM3U8Url(url) {
  return /\.m3u8?(\?|$)/i.test(url);
}

async function headOrRangeGet(url, headers, cfg) {
  let result = await safeRequest(url, {
    method: "HEAD",
    headers,
    timeoutMs: cfg.timeoutMs,
    allowPrivateHosts: cfg.allowPrivateHosts,
  });
  if (result.blocked) return { blocked: true };
  if (
    result.error ||
    !result.res ||
    result.res.status >= 400 ||
    result.res.status === 405
  ) {
    result = await safeRequest(url, {
      method: "GET",
      headers: { ...headers, Range: "bytes=0-2048" },
      timeoutMs: cfg.timeoutMs,
      allowPrivateHosts: cfg.allowPrivateHosts,
    });
  }
  return result;
}

async function fetchText(url, headers, cfg) {
  const result = await safeRequest(url, {
    method: "GET",
    headers,
    timeoutMs: cfg.timeoutMs,
    allowPrivateHosts: cfg.allowPrivateHosts,
  });
  if (result.blocked || result.error || !result.res || !result.res.ok)
    return null;
  try {
    return await result.res.text();
  } catch {
    return null;
  }
}

async function validateHls(url, headers, cfg, depth = 0) {
  const body = await fetchText(url, headers, cfg);
  if (body === null) return { valid: false, reason: "unreachable_manifest" };
  if (!body.includes("#EXTM3U")) return { valid: false, reason: "not_m3u8" };

  if (body.includes("#EXT-X-STREAM-INF")) {
    if (depth >= 1) return { valid: true, type: "master", segmentsChecked: 0 };
    const variantLine = body
      .split(/\r?\n/)
      .find((l) => l.trim() && !l.startsWith("#"));
    if (!variantLine)
      return { valid: false, reason: "no_variant_found", type: "master" };
    const variantUrl = resolveUrl(url, variantLine.trim());
    const mediaResult = await validateHls(variantUrl, headers, cfg, depth + 1);
    return { ...mediaResult, type: "master" };
  }

  const segmentLines = body
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#"))
    .slice(0, cfg.segmentCheckCount);

  if (segmentLines.length === 0) {
    return { valid: false, reason: "no_segments_found", type: "media" };
  }

  let reachable = 0;
  for (const segLine of segmentLines) {
    const segUrl = resolveUrl(url, segLine.trim());
    const segResult = await headOrRangeGet(segUrl, headers, cfg);
    if (
      !segResult.blocked &&
      !segResult.error &&
      segResult.res &&
      segResult.res.status < 400
    ) {
      reachable++;
    }
  }

  return {
    valid: reachable > 0,
    type: "media",
    segmentsChecked: segmentLines.length,
    segmentsReachable: reachable,
  };
}

function computeScore({
  status,
  latencyMs,
  type,
  segmentsChecked,
  segmentsReachable,
}) {
  let score = 0;
  if (status === "online") score += 50;
  if (status === "unstable") score += 25;
  if (type === "hls") score += 15;
  if (segmentsChecked && segmentsReachable === segmentsChecked) score += 15;
  else if (segmentsReachable > 0) score += 7;
  const latencyPenalty = Math.min(30, Math.floor((latencyMs || 0) / 200));
  score -= latencyPenalty;
  if (status === "online" || status === "unstable") score = Math.max(score, 5);
  return Math.max(0, Math.min(100, score));
}

function finalize(channel, start, partial) {
  const latencyMs = nowMs() - start;
  const score = computeScore({ ...partial, latencyMs });
  return {
    name: channel.name,
    url: channel.url,
    group: channel.group || "Uncategorized",
    tvgId: channel.tvgId || null,
    logo: channel.logo || null,
    ...partial,
    latencyMs,
    score,
    lastChecked: new Date().toISOString(),
  };
}

async function checkChannel(channel, cfgOverrides = {}) {
  const cfg = { ...config, ...cfgOverrides };
  const headers = { "User-Agent": cfg.userAgent, ...(channel.headers || {}) };
  const start = nowMs();

  const primary = await headOrRangeGet(channel.url, headers, cfg);

  if (primary.blocked) {
    return finalize(channel, start, {
      status: "blocked",
      httpStatus: null,
      contentType: null,
      type: "unknown",
    });
  }

  if (primary.error) {
    const isTimeout = primary.error.name === "AbortError";
    return finalize(channel, start, {
      status: isTimeout ? "timeout" : "offline",
      httpStatus: null,
      contentType: null,
      type: "unknown",
    });
  }

  const res = primary.res;
  const httpStatus = res.status;
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  const category = classifyByStatusCode(httpStatus);

  if (category === "forbidden") {
    return finalize(channel, start, {
      status: "forbidden",
      httpStatus,
      contentType,
      type: "unknown",
    });
  }
  if (category === "geo_blocked") {
    return finalize(channel, start, {
      status: "geo_blocked",
      httpStatus,
      contentType,
      type: "unknown",
    });
  }
  if (category === "offline") {
    return finalize(channel, start, {
      status: "offline",
      httpStatus,
      contentType,
      type: "unknown",
    });
  }

  const looksLikeHls =
    isM3U8Url(channel.url) ||
    contentType.includes("mpegurl") ||
    contentType.includes("m3u8");

  if (looksLikeHls) {
    const hls = await validateHls(channel.url, headers, cfg);
    if (!hls.valid) {
      return finalize(channel, start, {
        status: "invalid_playlist",
        httpStatus,
        contentType,
        type: "hls",
        hlsReason: hls.reason,
      });
    }
    const partial =
      hls.segmentsChecked && hls.segmentsReachable < hls.segmentsChecked;
    return finalize(channel, start, {
      status: partial ? "unstable" : "online",
      httpStatus,
      contentType,
      type: "hls",
      segmentsChecked: hls.segmentsChecked || 0,
      segmentsReachable: hls.segmentsReachable || 0,
      hlsType: hls.type,
    });
  }

  const isUnsupportedType = contentType.includes("text/html");
  if (isUnsupportedType) {
    return finalize(channel, start, {
      status: "unsupported",
      httpStatus,
      contentType,
      type: "unknown",
    });
  }

  return finalize(channel, start, {
    status: "online",
    httpStatus,
    contentType,
    type: "direct",
  });
}

module.exports = { checkChannel, computeScore, validateHls, headOrRangeGet };
