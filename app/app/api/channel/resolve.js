import { resolveChannel } from "../../lib/youtube.js";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });

  try {
    const channelInput = String(req.body?.channelInput || "").trim();
    const channel = await resolveChannel(channelInput, process.env.YOUTUBE_API_KEY);
    return res.status(200).json({ channel });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "Erreur serveur inattendue.",
      details: error.details || []
    });
  }
}
