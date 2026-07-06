/**
 * Shamim IPTV Gateway v2
 * Configuration File
 */

const CONFIG = {
   ...
}

  // GitHub Pages (Primary Source)
  githubPages: "https://shamimpipon.github.io/Shamim-live-tv",

  // GitHub Raw (Backup Source)
  githubRaw: "https://raw.githubusercontent.com/shamimpipon/Shamim-live-tv/main",

  // Cloudflare R2 (Future)
  r2: "",

  // channels.json
  channelsFile: "channels.json",

  // Cache Settings
  cache: {
    browserTTL: 300,   // 5 Minutes
    edgeTTL: 300
  },

  // Debug Mode
  debug: false,

  // Analytics
  analytics: true,

  // Cloudflare KV Namespace
  kvNamespace: "CHANNELS",

  // Default Playlist
  defaultPlaylist: "Channel.m3u"

};
