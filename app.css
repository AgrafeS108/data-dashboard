import { setCommonHeaders, handleOptions, methodNotAllowed, sendApiError } from "../lib/http.js";
import { fetchVideosWithChannels } from "../lib/youtube.js";

export default async function handler(req, res) {
  setCommonHeaders(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const videoIds = Array.isArray(req.body?.videoIds) ? req.body.videoIds : [];
    if (videoIds.length === 0) {
      return res.status(400).json({
        error: "Aucun identifiant vidéo valide n'a été fourni."
      });
    }

    const result = await fetchVideosWithChannels(videoIds, process.env.YOUTUBE_API_KEY);
    return res.status(200).json(result);
  } catch (error) {
    return sendApiError(res, error);
  }
}
