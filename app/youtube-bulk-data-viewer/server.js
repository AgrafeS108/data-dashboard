import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchChannelVideoPage, fetchVideosWithChannels, resolveChannel } from "./lib/youtube.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(currentDir, "public")));

app.post("/api/channel/resolve", async (req, res) => {
  try {
    const channelInput = String(req.body?.channelInput || "").trim();
    const channel = await resolveChannel(channelInput, process.env.YOUTUBE_API_KEY);
    return res.json({ channel });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "Erreur serveur inattendue.",
      details: error.details || []
    });
  }
});

app.post("/api/channel/videos", async (req, res) => {
  try {
    const playlistId = String(req.body?.playlistId || "").trim();
    const pageToken = String(req.body?.pageToken || "").trim();
    const result = await fetchChannelVideoPage({ playlistId, pageToken }, process.env.YOUTUBE_API_KEY);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "Erreur serveur inattendue.",
      details: error.details || []
    });
  }
});

// Endpoint conservé pour la compatibilité avec l'ancienne version.
app.post("/api/videos", async (req, res) => {
  try {
    const videoIds = Array.isArray(req.body?.videoIds) ? req.body.videoIds : [];
    if (videoIds.length === 0) {
      return res.status(400).json({ error: "Aucun identifiant vidéo valide n'a été fourni." });
    }

    const result = await fetchVideosWithChannels(videoIds, process.env.YOUTUBE_API_KEY);
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "Erreur serveur inattendue.",
      details: error.details || []
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(currentDir, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`YouTube Channel Data Viewer : http://localhost:${port}`);
});
