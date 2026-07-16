import { setCommonHeaders, handleOptions, methodNotAllowed } from "../lib/http.js";

export default async function handler(req, res) {
  setCommonHeaders(res);
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  return res.status(200).json({
    ok: true,
    app: "youtube-channel-data-viewer",
    apiKeyConfigured: Boolean(process.env.YOUTUBE_API_KEY),
    version: "3.1.0"
  });
}
