import { setCommonHeaders, handleOptions, methodNotAllowed, sendApiError } from "../lib/http.js";
import { fetchChannelVideoPage } from "../lib/youtube.js";

export default async function handler(req, res) {
  setCommonHeaders(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const playlistId = String(req.body?.playlistId || "").trim();
    const pageToken = String(req.body?.pageToken || "").trim();
    const publishedAfter = String(req.body?.publishedAfter || "").trim();
    const publishedBefore = String(req.body?.publishedBefore || "").trim();
    const limitRaw = req.body?.limit;
    const limit = limitRaw === null || limitRaw === undefined || limitRaw === "" ? null : Number(limitRaw);

    if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 10000)) {
      return res.status(400).json({ error: "La limite doit être un entier compris entre 0 et 10 000." });
    }

    const result = await fetchChannelVideoPage(
      { playlistId, pageToken, publishedAfter, publishedBefore, limit },
      process.env.YOUTUBE_API_KEY
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendApiError(res, error);
  }
}
