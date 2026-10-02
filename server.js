import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "https:", "blob:"],
      connectSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));
app.use(express.json({ limit: "12kb" }));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const inputSchema = z.object({
  url: z.string().trim().min(8).max(2048).url(),
  rightsConfirmed: z.literal(true)
});

const platformHosts = {
  tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch"]
};

function platformFor(hostname) {
  const host = hostname.toLowerCase();
  for (const [platform, hosts] of Object.entries(platformHosts)) {
    if (hosts.includes(host) || hosts.some(h => host.endsWith("." + h))) return platform;
  }
  return null;
}

function isDirectMedia(url) {
  return /\.(mp4|webm|mov|m4v)(?:$|[?#])/i.test(url.pathname + url.search);
}

function safeHttpsUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP(S) links are supported.");
  if (url.username || url.password) throw new Error("Links containing embedded credentials are not accepted.");
  return url;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Dev Brian Video Downloader" }));

app.post("/api/resolve", async (req, res) => {
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Paste a valid video URL and confirm you have permission to download it." });
  }

  let url;
  try { url = safeHttpsUrl(parsed.data.url); }
  catch (err) { return res.status(400).json({ error: err.message }); }

  const platform = platformFor(url.hostname);
  const direct = isDirectMedia(url);

  if (!platform && !direct) {
    return res.status(400).json({
      error: "Unsupported link. Use a TikTok, Instagram, or Facebook post URL, or a direct MP4/WebM/MOV media URL."
    });
  }

  if (direct) {
    return res.json({
      source: "direct",
      platform: "Direct video URL",
      title: "Your video is ready",
      formats: [{ url: url.href, quality: "Original quality", ext: path.extname(url.pathname).slice(1) || "mp4" }],
      note: "The file is served by the original host. Download behavior depends on that host's response headers and your browser."
    });
  }

  // Integrate only a provider you are authorized to use. No scraping, login-cookie
  // collection, DRM circumvention, or private/restricted-content access is performed here.
  if (!process.env.MEDIA_PROVIDER_URL) {
    return res.status(422).json({
      source: "platform",
      platform,
      originalUrl: url.href,
      error: `This is a ${platform} link. A platform-approved or otherwise authorized media provider must be configured before this site can retrieve a downloadable file.`,
      note: "For now, open the post and use the platform's built-in Save/Download option when available. This starter does not bypass platform restrictions."
    });
  }

  try {
    const providerUrl = new URL(process.env.MEDIA_PROVIDER_URL);
    if (providerUrl.protocol !== "https:") {
      return res.status(500).json({ error: "MEDIA_PROVIDER_URL must use HTTPS." });
    }
    const headers = { "content-type": "application/json" };
    if (process.env.MEDIA_PROVIDER_TOKEN) headers.authorization = `Bearer ${process.env.MEDIA_PROVIDER_TOKEN}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let providerResponse;
    try {
      providerResponse = await fetch(providerUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: url.href }),
        signal: controller.signal
      });
    } finally { clearTimeout(timeout); }

    if (!providerResponse.ok) {
      return res.status(502).json({ error: "The configured media provider could not process this link. Please try again later." });
    }
    const data = await providerResponse.json();
    if (!data || !Array.isArray(data.formats) || data.formats.length === 0) {
      return res.status(502).json({ error: "The provider returned no downloadable formats." });
    }

    const formats = data.formats.slice(0, 8).filter(f => {
      try {
        const fUrl = new URL(f.url);
        return fUrl.protocol === "https:" && ["mp4", "webm", "mov", "m4v"].includes(String(f.ext || "").toLowerCase());
      } catch { return false; }
    }).map(f => ({
      url: f.url,
      quality: String(f.quality || "Available quality").slice(0, 50),
      ext: String(f.ext || "mp4").toLowerCase()
    }));

    if (!formats.length) return res.status(502).json({ error: "The provider returned no safe HTTPS video formats." });
    return res.json({
      source: "provider",
      platform,
      title: String(data.title || "Video ready").slice(0, 200),
      thumbnail: typeof data.thumbnail === "string" && data.thumbnail.startsWith("https://") ? data.thumbnail : null,
      formats,
      note: "Only download content you own or are authorized to save."
    });
  } catch {
    return res.status(502).json({ error: "Could not contact the configured media provider. Check its URL and try again." });
  }
});

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"],
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.use((err, _req, res, _next) => {
  console.error("Request error:", err?.message || "unknown");
  res.status(500).json({ error: "An unexpected server error occurred. Please try again." });
});

app.listen(port, () => console.log(`Dev Brian Video Downloader running on port ${port}`));
