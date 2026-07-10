import {
  fetchChannelVideoPage,
  fetchVideosWithChannels,
  resolveChannel
} from "./youtube.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function routeFromRequest(req) {
  const queryPath = req.query?.path;
  if (Array.isArray(queryPath)) return queryPath.join("/");
  if (typeof queryPath === "string" && queryPath) return queryPath;

  const url = new URL(req.url || "/", "http://localhost");
  return url.pathname.replace(/^\/api\/?/, "").replace(/^\/+|\/+$/g, "");
}

function sendError(res, error) {
  console.error(error);
  return res.status(error?.status || 500).json({
    error: error?.message || "Erreur serveur inattendue.",
    details: Array.isArray(error?.details) ? error.details : []
  });
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();

  const route = routeFromRequest(req);

  try {
    if (req.method === "GET" && route === "health") {
      return res.status(200).json({
        ok: true,
        app: "youtube-channel-data-viewer",
        apiKeyConfigured: Boolean(process.env.YOUTUBE_API_KEY),
        version: "3.0.0"
      });
    }

    if (req.method === "POST" && route === "channel/resolve") {
      const channelInput = String(req.body?.channelInput || "").trim();
      const channel = await resolveChannel(channelInput, process.env.YOUTUBE_API_KEY);
      return res.status(200).json({ channel });
    }

    if (req.method === "POST" && route === "channel/videos") {
      const playlistId = String(req.body?.playlistId || "").trim();
      const pageToken = String(req.body?.pageToken || "").trim();
      const result = await fetchChannelVideoPage(
        { playlistId, pageToken },
        process.env.YOUTUBE_API_KEY
      );
      return res.status(200).json(result);
    }

    // Compatibilité avec la toute première version qui acceptait une liste d'IDs.
    if (req.method === "POST" && route === "videos") {
      const videoIds = Array.isArray(req.body?.videoIds) ? req.body.videoIds : [];
      if (videoIds.length === 0) {
        return res.status(400).json({
          error: "Aucun identifiant vidéo valide n'a été fourni."
        });
      }

      const result = await fetchVideosWithChannels(videoIds, process.env.YOUTUBE_API_KEY);
      return res.status(200).json(result);
    }

    return res.status(404).json({ error: "Route API introuvable." });
  } catch (error) {
    return sendError(res, error);
  }
}
