/**
 * ===========================================
 * Shamim IPTV Gateway v2
 * Worker.js
 * Part-1
 * ===========================================
 */
const CONFIG = {

...

};

const ISP = {

...

};

function detectISP(name){

...

}

addEventListener("fetch",event=>{

...

});

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {

  const url = new URL(request.url);

  const pathname = url.pathname;

  const debug = url.searchParams.has("debug");

  const cf = request.cf || {};

  const asn = cf.asn || 0;

  const ispName = (cf.asOrganization || "").toLowerCase();

  try {
// Analytics API
if (pathname === "/analytics") {
    return analyticsAPI();
}

// Direct Channel
if (pathname.endsWith(".m3u8")) {

    const id = pathname
      .replace("/", "")
      .replace(".m3u8", "");

    addAnalytics("channel");

    const channelsURL =
      `${CONFIG.githubPages}/${CONFIG.channelsFile}`;

    const channels = await fetch(channelsURL, {
        cf: {
            cacheEverything: true,
            cacheTtl: CONFIG.cache.edgeTTL
        }
    }).then(r => r.json());

    if (!channels[id]) {
        ANALYTICS.notFound++;
        return new Response("Channel Not Found", {
            status: 404
        });
    }

    return proxyStream(channels[id].url);
}
    // Root
    if (pathname === "/") {

      return new Response("Shamim IPTV Gateway v2", {

        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        }

      });

    }

    // Channel API

    if (pathname.startsWith("/channel/")) {

      return await handleChannel(pathname);

    }

    // Playlist

    return await handlePlaylist(asn, ispName, debug);

  }

  catch (err) {

    return new Response(err.toString(), {

      status: 500

    });

  }

}
/**
 * ===========================================
 * Worker.js
 * Part-2
 * ISP Detect + Playlist + Failover
 * ===========================================
 */

async function handlePlaylist(asn, ispName, debug = false) {

  // ISP Detect
  let isp = ISP[asn] || detectISP(ispName);

  if (!isp) isp = "default";

  // routes.json
  const routesURL =
    `${CONFIG.githubPages}/routes.json`;

  const routes = await fetch(routesURL, {
    cf: {
      cacheEverything: true,
      cacheTtl: CONFIG.cache.edgeTTL
    }
  }).then(r => r.json());

  const route = routes[isp] || routes.default;

  // Primary URL (GitHub Pages)
  const primary =
    `${CONFIG.githubPages}/${route.playlist}`;

  // Backup URL (GitHub Raw)
  const backup =
    `${CONFIG.githubRaw}/${route.playlist}`;

  // ---------- Primary ----------
  let response = await fetch(primary, {
    cf: {
      cacheEverything: true,
      cacheTtl: CONFIG.cache.edgeTTL
    }
  });

  // ---------- Backup ----------
  if (
    !response.ok ||
    response.status === 404 ||
    response.status === 429 ||
    response.status >= 500
  ) {

    response = await fetch(backup, {
      cf: {
        cacheEverything: true,
        cacheTtl: CONFIG.cache.edgeTTL
      }
    });

  }

  // ---------- Future R2 ----------
  if (
    (!response.ok || response.status >= 500) &&
    CONFIG.r2
  ) {

    response = await fetch(
      `${CONFIG.r2}/${route.playlist}`
    );

  }

  // সব Source ব্যর্থ
  if (!response.ok) {

    return new Response(
      "Playlist unavailable",
      {
        status: 503
      }
    );

  }

  const playlist = await response.text();

  // Debug Mode
  if (debug) {

    return new Response(
      JSON.stringify({
        asn,
        isp,
        playlist: route.playlist,
        primary,
        backup,
        status: response.status
      }, null, 2),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

  }

  // Playlist Return
  return new Response(playlist, {
    headers: {
      "Content-Type": "application/x-mpegURL",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300"
    }
  });

}
/**
 * ===========================================
 * Worker.js
 * Part-3
 * Channel API + Smart Cache
 * ===========================================
 */

async function handleChannel(pathname) {

  // /channel/ShamimBTV
  let id = pathname
    .replace("/channel/", "")
    .replace(".m3u8", "")
    .trim();

  if (!id) {

    return new Response("Channel ID Missing", {
      status: 400
    });

  }

  // channels.json
  const channelsURL =
    `${CONFIG.githubPages}/${CONFIG.channelsFile}`;

  const response = await fetch(channelsURL, {

    cf: {

      cacheEverything: true,

      cacheTtl: CONFIG.cache.edgeTTL

    }

  });

  if (!response.ok) {

    return new Response("channels.json not found", {

      status: 500

    });

  }

  const channels = await response.json();

  const channel = channels[id];

  if (!channel) {

    return new Response("Channel Not Found", {

      status: 404

    });

  }

  // Future:
  // এখানে Token Check করা যাবে

  // Future:
  // এখানে User Authentication যোগ করা যাবে

  // Future:
  // Analytics Count

  return Response.redirect(channel.url,302);

}
/**
 * ===========================================
 * Worker.js
 * Part-4 (Final)
 * Proxy + Analytics + Final Router
 * ===========================================
 */

// Simple in-memory analytics (Cloudflare isolate lifetime পর্যন্ত)
const ANALYTICS = {
  totalRequests: 0,
  playlistRequests: 0,
  channelRequests: 0,
  notFound: 0
};

// Proxy Stream
async function proxyStream(streamUrl) {

  const response = await fetch(streamUrl, {

    headers: {
      "User-Agent": "Shamim-IPTV-Gateway/2.0"
    }

  });

  if (!response.ok) {

    return new Response("Stream Offline", {
      status: 502
    });

  }

  return new Response(response.body, {

    status: response.status,

    headers: {

      "Content-Type":
        response.headers.get("Content-Type") ||
        "application/vnd.apple.mpegurl",

      "Access-Control-Allow-Origin": "*",

      "Cache-Control": "public,max-age=10"

    }

  });

}


// Analytics

function addAnalytics(type){

  ANALYTICS.totalRequests++;

  if(type==="playlist")
      ANALYTICS.playlistRequests++;

  if(type==="channel")
      ANALYTICS.channelRequests++;

}


// Debug Analytics

async function analyticsAPI(){

   return new Response(

      JSON.stringify(ANALYTICS,null,2),

      {

        headers:{
          "Content-Type":"application/json"
        }

      }

   );

}
