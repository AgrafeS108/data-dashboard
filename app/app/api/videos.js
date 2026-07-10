import { fetchVideosWithChannels } from "../lib/youtube.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée." });
  }

  try {
    const videoIds = Array.isArray(req.body?.videoIds) ? req.body.videoIds : [];
    if (videoIds.length === 0) {
      return res.status(400).json({ error: "Aucun identifiant vidéo valide n'a été fourni." });
    }

    const result = await fetchVideosWithChannels(videoIds, process.env.YOUTUBE_API_KEY);
    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "Erreur serveur inattendue.",
      details: error.details || []
    });
  }
}
