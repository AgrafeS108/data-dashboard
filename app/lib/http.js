export function setCommonHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

export function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  setCommonHeaders(res);
  res.status(204).end();
  return true;
}

export function methodNotAllowed(res, allowed = ["POST"]) {
  res.setHeader("Allow", allowed.join(", "));
  return res.status(405).json({ error: "Méthode HTTP non autorisée." });
}

export function sendApiError(res, error) {
  console.error(error);
  return res.status(error?.status || 500).json({
    error: error?.message || "Erreur serveur inattendue.",
    details: Array.isArray(error?.details) ? error.details : []
  });
}
