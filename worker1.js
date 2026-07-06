addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

// আপনার GitHub Pages-এর channels.json URL এখানে দিন
const CHANNELS_URL =
  "https://shamimpipon.github.io/Shamim-live-tv/channels.json";

async function handleRequest(request) {
  const url = new URL(request.url);

  // উদাহরণ:
  // https://your-worker.workers.dev/ShamimBTV.m3u8
  const channelId = url.pathname
    .replace(/^\/+/, "")
    .replace(/\.m3u8$/i, "");

  // Root URL হলে তথ্য দেখাবে
  if (!channelId) {
    return new Response("Shamim IPTV Gateway v2", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  // channels.json ক্যাশসহ লোড
  const res = await fetch(CHANNELS_URL, {
    cf: {
      cacheEverything: true,
      cacheTtl: 300
    }
  });

  if (!res.ok) {
    return new Response("channels.json load failed", {
      status: 500
    });
  }

  const channels = await res.json();

  const channel = channels[channelId];

  if (!channel) {
    return new Response("Channel Not Found", {
      status: 404
    });
  }

  // আসল URL-এ Redirect
  return Response.redirect(channel.url, 302);
}
