/**
 * Recherche locale robuste pour les vidéos YouTube.
 * - insensible aux majuscules et aux accents ;
 * - plusieurs mots-clés peuvent être répartis entre titre, tags et description ;
 * - les guillemets recherchent une expression exacte ;
 * - un mot précédé de - est exclu.
 */
export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’`´]/g, "'")
    .toLocaleLowerCase("fr-FR")
    .replace(/https?:\/\/(?:www\.)?/g, " ")
    .replace(/[^a-z0-9@#_'-]+/g, " ")
    .replace(/['-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function parseSearchQuery(query) {
  const include = [];
  const exclude = [];
  const source = String(query ?? "").trim();
  const matcher = /(-?)"([^"]+)"|(-?)(\S+)/g;
  let match;

  while ((match = matcher.exec(source)) !== null) {
    const isExcluded = (match[1] || match[3]) === "-";
    const rawValue = match[2] ?? match[4] ?? "";
    const normalized = normalizeSearchText(rawValue);
    if (!normalized) continue;

    // Une expression entre guillemets reste un seul critère. Les autres
    // éléments sont découpés pour que « equipe-france » fonctionne aussi.
    const terms = match[2] !== undefined ? [normalized] : normalized.split(" ");
    (isExcluded ? exclude : include).push(...terms);
  }

  return {
    raw: source,
    include: unique(include),
    exclude: unique(exclude)
  };
}

export function buildVideoSearchIndex(video) {
  const fields = {
    id: normalizeSearchText(video?.id),
    title: normalizeSearchText(video?.title),
    tags: normalizeSearchText(Array.isArray(video?.tags) ? video.tags.join(" ") : video?.tags),
    description: normalizeSearchText(video?.description),
    channel: normalizeSearchText(`${video?.channelTitle || ""} ${video?.channel?.title || ""} ${video?.channel?.customUrl || ""}`),
    advertiser: normalizeSearchText(`${video?.adBrand || ""} ${video?.advertiser || ""} ${video?.adSearchText || ""}`),
    metadata: normalizeSearchText([
      video?.publishedAt,
      String(video?.publishedAt || "").replace(/[TZ]/g, " "),
      video?.categoryId,
      video?.defaultLanguage,
      video?.defaultAudioLanguage,
      video?.liveBroadcastContent,
      video?.duration
    ].filter(Boolean).join(" "))
  };

  const all = Object.values(fields).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return {
    ...fields,
    all,
    compact: all.replace(/\s+/g, ""),
    words: new Set(all.split(" ").filter(Boolean))
  };
}

function indexContains(index, term) {
  if (!term) return true;

  // Pour les sigles très courts comme « OM », on exige un mot entier afin
  // d’éviter les faux positifs dans « commentaire ».
  if (!term.includes(" ") && term.length <= 2) {
    return index.words.has(term);
  }

  if (index.all.includes(term)) return true;
  const compactTerm = term.replace(/\s+/g, "");
  return compactTerm.length >= 3 && index.compact.includes(compactTerm);
}

export function matchesVideoSearch(index, parsedQuery) {
  if (!parsedQuery?.include?.length && !parsedQuery?.exclude?.length) return true;
  const includesMatch = parsedQuery.include.every((term) => indexContains(index, term));
  const excludesMatch = parsedQuery.exclude.every((term) => !indexContains(index, term));
  return includesMatch && excludesMatch;
}
