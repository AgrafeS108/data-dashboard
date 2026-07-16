(function attachShared(globalScope) {
  const COMMON_DOMAINS = new Set([
    "youtube.com", "youtu.be", "google.com", "googleadservices.com", "doubleclick.net",
    "googlesyndication.com", "gstatic.com", "googleapis.com"
  ]);

  const STOP_LINES = [
    /^(annonce|publicité|sponsorisé|sponsored|ad|ads)$/i,
    /^(ignorer|passer|skip|en savoir plus|learn more|acheter|buy now|visiter|visit|ouvrir|open)$/i,
    /^\d+\s*(s|sec|secondes?)$/i,
    /^(www\.)?youtube\.com$/i
  ];

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();
  }

  function normalizeDomain(value) {
    const raw = cleanText(value);
    if (!raw) return "";
    try {
      const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      const redirected = ["adurl", "url", "q", "dest", "destination", "redirect", "redirect_url"]
        .map((key) => url.searchParams.get(key))
        .find(Boolean);
      if (redirected) return normalizeDomain(redirected);
      return url.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return raw.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/^www\./, "").toLowerCase();
    }
  }

  function domainBrand(domain) {
    const clean = normalizeDomain(domain);
    if (!clean || COMMON_DOMAINS.has(clean)) return "";
    const parts = clean.split(".").filter(Boolean);
    if (parts.length < 2) return "";
    const commonSecondLevel = new Set(["co", "com", "net", "org", "gouv", "gov"]);
    let label = parts.at(-2);
    if (commonSecondLevel.has(label) && parts.length >= 3) label = parts.at(-3);
    if (!label || label.length < 2) return "";
    return label
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function candidateLines(text) {
    const lines = String(text || "")
      .split(/[\n|•·]+/)
      .map(cleanText)
      .filter(Boolean)
      .filter((line) => line.length >= 2 && line.length <= 80)
      .filter((line) => !STOP_LINES.some((pattern) => pattern.test(line)))
      .filter((line) => !/^https?:\/\//i.test(line))
      .filter((line) => !/^\d+[\d :.,%-]*$/.test(line));
    return [...new Set(lines)];
  }

  function extractAdvertiserCompany(text) {
    const clean = cleanText(text);
    const patterns = [
      /(?:sponsorisé|sponsored|payé|paid|présenté|presented)\s+(?:par|by)\s+([^|•\n]{2,80})/i,
      /(?:annonceur|advertiser)\s*[:\-]\s*([^|•\n]{2,80})/i
    ];
    for (const pattern of patterns) {
      const match = clean.match(pattern);
      if (match?.[1]) return cleanText(match[1]);
    }
    return "";
  }

  function scoreLine(line, domainCandidate) {
    let score = 0;
    if (/^[A-ZÀ-ÖØ-Ý0-9][\wÀ-ÿ&'’ .+\-]{1,40}$/.test(line)) score += 2;
    if (line.split(" ").length <= 5) score += 1;
    if (/[A-ZÀ-ÖØ-Ý]{2,}/.test(line)) score += 1;
    if (domainCandidate && line.toLowerCase().includes(domainCandidate.toLowerCase())) score += 4;
    if (/^(découvrez|profitez|essayez|nouveau|offre|jusqu'à|réservez)/i.test(line)) score -= 2;
    if (/[.!?]$/.test(line) && line.split(" ").length > 5) score -= 1;
    return score;
  }

  function inferAdvertiser({ visibleText = "", landingUrl = "", linkTexts = [] } = {}) {
    const landingDomain = normalizeDomain(landingUrl);
    const fromDomain = domainBrand(landingDomain);
    const allText = [visibleText, ...(Array.isArray(linkTexts) ? linkTexts : [])].filter(Boolean).join("\n");
    const company = extractAdvertiserCompany(allText);
    const lines = candidateLines(allText);
    const ranked = lines
      .map((line) => ({ line, score: scoreLine(line, fromDomain) }))
      .sort((a, b) => b.score - a.score || a.line.length - b.line.length);
    const fromText = ranked[0]?.score > 0 ? ranked[0].line : "";

    let brand = fromDomain || fromText || company;
    let confidence = 0;
    let detectionMethod = "none";
    if (fromDomain && fromText) {
      const domainToken = fromDomain.toLowerCase().replace(/\s+/g, "");
      const textToken = fromText.toLowerCase().replace(/\s+/g, "");
      const agrees = domainToken.includes(textToken) || textToken.includes(domainToken);
      confidence = agrees ? 0.95 : 0.78;
      detectionMethod = agrees ? "domain+text" : "domain";
      if (!agrees) brand = fromDomain;
    } else if (fromDomain) {
      confidence = 0.82;
      detectionMethod = "domain";
    } else if (company) {
      brand = company;
      confidence = 0.7;
      detectionMethod = "advertiser-label";
    } else if (fromText) {
      confidence = 0.55;
      detectionMethod = "visible-text";
    }

    return {
      brand: cleanText(brand),
      advertiserCompany: cleanText(company || brand),
      landingDomain,
      confidence,
      detectionMethod,
      candidateLines: ranked.slice(0, 8).map((item) => item.line)
    };
  }

  function videoIdFromUrl(value) {
    const raw = cleanText(value);
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (url.hostname.includes("youtu.be")) return cleanText(url.pathname.split("/").filter(Boolean)[0]);
      return cleanText(url.searchParams.get("v"));
    } catch {
      return /^[A-Za-z0-9_-]{11}$/.test(raw) ? raw : "";
    }
  }

  function buildObservationId(runId, videoId, observedAt) {
    const base = `${runId || "run"}:${videoId || "video"}:${observedAt || Date.now()}`;
    let hash = 2166136261;
    for (let index = 0; index < base.length; index += 1) {
      hash ^= base.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `collector-${(hash >>> 0).toString(16)}`;
  }

  globalScope.YTPreRollShared = {
    cleanText,
    normalizeDomain,
    domainBrand,
    candidateLines,
    extractAdvertiserCompany,
    inferAdvertiser,
    videoIdFromUrl,
    buildObservationId
  };
})(globalThis);
