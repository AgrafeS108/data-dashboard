import { setCommonHeaders, handleOptions, methodNotAllowed, sendApiError } from "../lib/http.js";
import { fetchChannelVideoPage } from "../lib/youtube.js";

export default async function handler(req, res) {
  setCommonHeaders(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const playlistId = String(req.body?.playlistId || "").trim();
    const pageToken = String(req.body?.pageToken || "").trim();
    const result = await fetchChannelVideoPage(
      { playlistId, pageToken },
      process.env.YOUTUBE_API_KEY
    );
    return res.status(200).json(result);
  } catch (error) {
    return sendApiError(res, error);
  }
}
