/**
 * ===========================================
 * Shamim IPTV Gateway v2 (Final Optimized)
 * Permanent Link & Dynamic Proxy System
 * ===========================================
 */

const CONFIG = {
  // ১. আপনার GitHub-এ রাখা channels.json ফাইলটির Raw লিঙ্ক এখানে দিন
  // উদাহরণ: https://raw.githubusercontent.com/user/repo/main/channels.json
  databaseURL: "https://your-github-username.github.io/repo-name/channels.json", 
  
  // ২. আপনার মেইন প্লে-লিস্ট ফাইল (Channel.m3u) এর লিঙ্ক
  playlistURL: "https://your-github-username.github.io/repo-name/Channel.m3u",
  
  cacheTTL: 60 // ৬০ সেকেন্ড ক্যাশ (যাতে লিঙ্ক পরিবর্তন করলে দ্রুত আপডেট হয়)
};

const ANALYTICS = {
  total: 0,
  channels: 0,
  playlist: 0,
  notFound: 0
};

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // ১. অ্যানালিটিক্স চেক
  if (pathname === "/analytics") {
    return new Response(JSON.stringify(ANALYTICS, null, 2), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // ২. রুট পাথ বা প্লে-লিস্ট রিকোয়েস্ট
  if (pathname === "/" || pathname.includes("Channel.m3u")) {
    ANALYTICS.total++;
    ANALYTICS.playlist++;
    return fetchPlaylist();
  }

  // ৩. চ্যানেল আইডি এক্সট্রাক্ট করা (যেমন: /ShamimBTVNATIONALHD.m3u8 থেকে ShamimBTVNATIONALHD বের করা)
  let id = pathname.replace("/", "").replace(".m3u8", "").trim();

  if (id) {
    return await handleChannelProxy(id);
  }

  return new Response("Shamim IPTV Gateway is Active", { status: 200 });
}

/**
 * চ্যানেলের আসল লিঙ্ক খুঁজে বের করে প্রক্সি করা
 */
async function handleChannelProxy(id) {
  ANALYTICS.total++;
  ANALYTICS.channels++;

  try {
    // GitHub থেকে আপনার দেওয়া চ্যানেলের লিস্টটি লোড করা
    const res = await fetch(CONFIG.databaseURL, {
      cf: { cacheTtl: CONFIG.cacheTTL }
    });

    if (!res.ok) return new Response("Database missing on GitHub", { status: 500 });

    const channels = await res.json();
    const channelData = channels[id];

    // যদি আইডি খুঁজে পাওয়া না যায়
    if (!channelData || !channelData.url) {
      ANALYTICS.notFound++;
      return new Response("Channel '" + id + "' not found in database", { status: 404 });
    }

    // আসল ইউআরএল থেকে স্ট্রিম প্রক্সি করা
    return proxyStream(channelData.url);

  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
}

/**
 * প্লে-লিস্ট সরাসরি GitHub থেকে সার্ভ করা
 */
async function fetchPlaylist() {
  const res = await fetch(CONFIG.playlistURL);
  if (!res.ok) return new Response("Playlist not found", { status: 404 });
  
  const content = await res.text();
  return new Response(content, {
    headers: {
      "Content-Type": "application/x-mpegURL",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

/**
 * স্ট্রিম প্রক্সি ফাংশন (আসল লিঙ্ক হাইড রাখার জন্য)
 */
async function proxyStream(streamUrl) {
  const response = await fetch(streamUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "*/*"
    }
  });

  if (!response.ok) {
    return new Response("Original Stream is Offline", { status: 502 });
  }

  // অরিজিনাল ডাটা সরাসরি পাস করা
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "video/mp2t",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache"
    }
  });
}
