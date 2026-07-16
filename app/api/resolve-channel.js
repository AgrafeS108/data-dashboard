import { setCommonHeaders, handleOptions, methodNotAllowed, sendApiError } from "../lib/http.js";
import { resolveChannel } from "../lib/youtube.js";

export default async function handler(req, res) {
  setCommonHeaders(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return methodNotAllowed(res);

  try {
    const channelInput = String(req.body?.channelInput || "").trim();
    const channel = await resolveChannel(channelInput, process.env.YOUTUBE_API_KEY);
    return res.status(200).json({ channel });
  } catch (error) {
    return sendApiError(res, error);
  }
}
