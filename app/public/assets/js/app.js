import { buildVideoSearchIndex, matchesVideoSearch, parseSearchQuery } from "./search.js";

const STORAGE_KEYS = {
  theme: "yt-channel-viewer-theme",
  exportColumns: "yt-channel-viewer-export-columns-v8",
  legacyExportColumns: ["yt-channel-viewer-export-columns-v7", "yt-channel-viewer-export-columns-v6", "yt-channel-viewer-export-columns-v5", "yt-channel-viewer-export-columns-v4"],
  adObservations: "yt-channel-viewer-ad-observations-v1",
  legacyAdvertisers: "yt-channel-viewer-advertisers-v1"
};

const ESSENTIAL_EXPORT_KEYS = [
  "title", "url", "publishedAt", "dateUtc", "timeUtc", "parisDate", "parisExactTime",
  "views", "likes", "comments", "durationReadable", "durationSeconds",
  "tags", "description", "adBrandPrimary", "adBrandsWithCounts",
  "adAdvertiserPrimary", "adAdvertisersWithCounts", "adConfidenceLatest", "adLandingDomainLatest", "adTestCount", "adShownCount"
];

const EXPORT_COLUMNS = [
  { group: "Identité", header: "Titre", key: "title", width: 44, value: (video) => video.title || "" },
  { group: "Identité", header: "URL YouTube", key: "url", width: 34, hyperlink: true, value: (video) => video.url || "" },
  { group: "Identité", header: "ID vidéo", key: "id", width: 16, value: (video) => video.id || "" },
  { group: "Identité", header: "Chaîne", key: "channelTitle", width: 26, value: (video) => video.channelTitle || "" },
  { group: "Identité", header: "ID chaîne", key: "channelId", width: 27, value: (video) => video.channelId || "" },

  { group: "Publication", header: "Publication ISO 8601 (UTC)", key: "publishedAt", width: 27, value: (video) => validIso(video.publishedAt) },
  { group: "Publication", header: "Date UTC", key: "dateUtc", width: 13, value: (video) => validIso(video.publishedAt).slice(0, 10) },
  { group: "Publication", header: "Heure exacte UTC", key: "timeUtc", width: 17, value: (video) => validIso(video.publishedAt).slice(11, 19) },
  { group: "Publication", header: "Date de Paris", key: "parisDate", width: 15, value: (video) => formatDatePartInTimeZone(video.publishedAt, "Europe/Paris") },
  { group: "Publication", header: "Heure exacte de Paris", key: "parisExactTime", width: 20, value: (video) => formatTimePartInTimeZone(video.publishedAt, "Europe/Paris") },
  { group: "Publication", header: "Statut live", key: "liveStatus", width: 15, value: (video) => video.liveBroadcastContent || "" },
  { group: "Publication", header: "Date de tournage", key: "recordingDate", width: 23, value: (video) => video.recordingDate || "" },

  { group: "Performance", header: "Vues", key: "views", width: 15, numberFormat: "#,##0", value: (video) => numericOrNull(video.viewCount) },
  { group: "Performance", header: "Likes", key: "likes", width: 15, numberFormat: "#,##0", value: (video) => numericOrNull(video.likeCount) },
  { group: "Performance", header: "Commentaires", key: "comments", width: 15, numberFormat: "#,##0", value: (video) => numericOrNull(video.commentCount) },
  { group: "Performance", header: "Taux d’engagement", key: "engagement", width: 18, numberFormat: "0.00%", value: (video) => engagement(video) },
  { group: "Performance", header: "Favoris", key: "favorites", width: 13, numberFormat: "#,##0", value: (video) => numericOrNull(video.favoriteCount) },

  { group: "Contenu", header: "Durée", key: "durationReadable", width: 12, value: (video) => isoDurationToClock(video.duration) },
  { group: "Contenu", header: "Durée en secondes", key: "durationSeconds", width: 19, numberFormat: "#,##0", value: (video) => isoDurationToSeconds(video.duration) },
  { group: "Contenu", header: "Durée ISO", key: "durationIso", width: 13, value: (video) => video.duration || "" },
  { group: "Contenu", header: "ID catégorie", key: "categoryId", width: 14, value: (video) => video.categoryId || "" },
  { group: "Contenu", header: "Langue", key: "language", width: 12, value: (video) => video.defaultLanguage || "" },
  { group: "Contenu", header: "Langue audio", key: "audioLanguage", width: 16, value: (video) => video.defaultAudioLanguage || "" },
  { group: "Contenu", header: "Tags", key: "tags", width: 45, value: (video) => (video.tags || []).join(" | ") },
  { group: "Contenu", header: "Description", key: "description", width: 70, value: (video) => video.description || "" },
  { group: "Contenu", header: "URL miniature", key: "thumbnail", width: 34, hyperlink: true, value: (video) => video.thumbnail || "" },

  { group: "Technique et statut", header: "Définition", key: "definition", width: 12, value: (video) => String(video.definition || "").toUpperCase() },
  { group: "Technique et statut", header: "Dimension", key: "dimension", width: 12, value: (video) => video.dimension || "" },
  { group: "Technique et statut", header: "Sous-titres", key: "captions", width: 13, value: (video) => video.caption === "true" ? "Oui" : "Non" },
  { group: "Technique et statut", header: "Projection", key: "projection", width: 13, value: (video) => video.projection || "" },
  { group: "Technique et statut", header: "Intégrable", key: "embeddable", width: 12, value: (video) => yesNo(video.embeddable) },
  { group: "Technique et statut", header: "Destinée aux enfants", key: "madeForKids", width: 22, value: (video) => yesNo(video.madeForKids) },
  { group: "Technique et statut", header: "Licence", key: "license", width: 13, value: (video) => video.license || "" },
  { group: "Technique et statut", header: "Pays bloqués", key: "blockedRegions", width: 30, value: (video) => video.regionRestriction?.blocked?.join(" | ") || "" },
  { group: "Technique et statut", header: "Pays autorisés", key: "allowedRegions", width: 30, value: (video) => video.regionRestriction?.allowed?.join(" | ") || "" },

  { group: "Publicité pré-roll observée", header: "Marque principale (la plus présente)", key: "adBrandPrimary", width: 36, value: (video) => mostFrequentAdValue(video.id, "brand") },
  { group: "Publicité pré-roll observée", header: "Marque pré-roll observée (dernière)", key: "adBrandLatest", width: 34, value: (video) => getPrimaryAdBrand(video.id) },
  { group: "Publicité pré-roll observée", header: "Marques observées avec nombre de présences", key: "adBrandsWithCounts", width: 54, value: (video) => formatAdValueCounts(video.id, "brand") },
  { group: "Publicité pré-roll observée", header: "Toutes les marques observées", key: "adBrandsAll", width: 45, value: (video) => uniqueAdValues(video.id, "brand").join(" | ") },
  { group: "Publicité pré-roll observée", header: "Nombre de marques distinctes", key: "adBrandDistinctCount", width: 27, numberFormat: "#,##0", value: (video) => countAdValues(video.id, "brand").length },
  { group: "Publicité pré-roll observée", header: "Entreprise annonceuse principale (la plus présente)", key: "adAdvertiserPrimary", width: 46, value: (video) => mostFrequentAdValue(video.id, "advertiserCompany") },
  { group: "Publicité pré-roll observée", header: "Entreprise annonceuse (dernière)", key: "adAdvertiserLatest", width: 36, value: (video) => latestAdValue(video.id, "advertiserCompany") },
  { group: "Publicité pré-roll observée", header: "Entreprises annonceuses avec nombre de présences", key: "adAdvertisersWithCounts", width: 58, value: (video) => formatAdValueCounts(video.id, "advertiserCompany") },
  { group: "Publicité pré-roll observée", header: "Toutes les entreprises annonceuses", key: "adAdvertisersAll", width: 48, value: (video) => uniqueAdValues(video.id, "advertiserCompany").join(" | ") },
  { group: "Publicité pré-roll observée", header: "Nombre d’entreprises annonceuses distinctes", key: "adAdvertiserDistinctCount", width: 38, numberFormat: "#,##0", value: (video) => countAdValues(video.id, "advertiserCompany").length },
  { group: "Publicité pré-roll observée", header: "Publicité affichée au dernier test", key: "adShownLatest", width: 27, value: (video) => adShownLabel(latestAdValue(video.id, "shown")) },
  { group: "Publicité pré-roll observée", header: "Date de la dernière observation", key: "adObservedDateLatest", width: 24, value: (video) => splitObservationDateTime(latestAdValue(video.id, "observedAt")).date },
  { group: "Publicité pré-roll observée", header: "Heure de la dernière observation", key: "adObservedTimeLatest", width: 25, value: (video) => splitObservationDateTime(latestAdValue(video.id, "observedAt")).time },
  { group: "Publicité pré-roll observée", header: "Pays / localisation du dernier test", key: "adLocationLatest", width: 34, value: (video) => latestAdValue(video.id, "location") },
  { group: "Publicité pré-roll observée", header: "Tous les pays / localisations observés", key: "adLocationsAll", width: 45, value: (video) => uniqueAdValues(video.id, "location").join(" | ") },
  { group: "Publicité pré-roll observée", header: "Format du dernier pré-roll", key: "adFormatLatest", width: 28, value: (video) => adFormatLabel(latestAdValue(video.id, "format")) },
  { group: "Publicité pré-roll observée", header: "Tous les formats observés", key: "adFormatsAll", width: 35, value: (video) => uniqueAdValues(video.id, "format").map(adFormatLabel).join(" | ") },
  { group: "Publicité pré-roll observée", header: "Lien / référence de preuve", key: "adEvidenceLatest", width: 48, value: (video) => latestAdValue(video.id, "evidence") },
  { group: "Publicité pré-roll observée", header: "Toutes les preuves / références", key: "adEvidenceAll", width: 70, value: (video) => uniqueAdValues(video.id, "evidence").join(" | ") },
  { group: "Publicité pré-roll observée", header: "Notes du dernier test", key: "adNotesLatest", width: 55, value: (video) => latestAdValue(video.id, "notes") },
  { group: "Publicité pré-roll observée", header: "Nombre de tests effectués", key: "adTestCount", width: 23, numberFormat: "#,##0", value: (video) => getAdObservations(video.id).length },
  { group: "Publicité pré-roll observée", header: "Tests avec publicité", key: "adShownCount", width: 21, numberFormat: "#,##0", value: (video) => getAdObservations(video.id).filter((observation) => observation.shown === "yes").length },
  { group: "Publicité pré-roll observée", header: "Tests sans publicité", key: "adNotShownCount", width: 21, numberFormat: "#,##0", value: (video) => getAdObservations(video.id).filter((observation) => observation.shown === "no").length },
  { group: "Collecte automatique pré-roll", header: "Source de la dernière observation", key: "adSourceLatest", width: 28, value: (video) => latestAdValue(video.id, "source") },
  { group: "Collecte automatique pré-roll", header: "Confiance de détection (dernière)", key: "adConfidenceLatest", width: 31, numberFormat: "0%", value: (video) => numericOrNull(latestAdRawValue(video.id, "confidence")) },
  { group: "Collecte automatique pré-roll", header: "Méthode de détection (dernière)", key: "adDetectionMethodLatest", width: 34, value: (video) => latestAdValue(video.id, "detectionMethod") },
  { group: "Collecte automatique pré-roll", header: "Domaine de destination (dernier)", key: "adLandingDomainLatest", width: 34, value: (video) => latestAdValue(video.id, "landingDomain") },
  { group: "Collecte automatique pré-roll", header: "URL de destination (dernière)", key: "adLandingUrlLatest", width: 48, hyperlink: true, value: (video) => latestAdValue(video.id, "landingUrl") },
  { group: "Collecte automatique pré-roll", header: "Texte détecté (dernier test)", key: "adRawTextLatest", width: 70, value: (video) => latestAdValue(video.id, "rawDetectedText") },
  { group: "Collecte automatique pré-roll", header: "ID du run de collecte", key: "adRunIdLatest", width: 34, value: (video) => latestAdValue(video.id, "runId") },
  { group: "Publicité pré-roll observée", header: "Historique complet des observations", key: "adHistory", width: 80, value: (video) => formatAdHistory(video.id) }
];

const state = {
  channel: null,
  videos: [],
  uploadOrder: [],
  missingIds: [],
  filtered: [],
  searchIndex: new Map(),
  selectedIds: new Set(),
  currentPage: 1,
  pageSize: 24,
  processing: false,
  controller: null,
  playlistItemsRead: 0,
  quotaEstimate: 0,
  loadCriteria: null,
  loadStopReason: "",
  adObservations: loadAdObservations(),
  exportColumnKeys: loadExportColumns(),
  exportColumnDraftKeys: null
};

const els = {
  channelInput: document.querySelector("#channelInput"),
  analyzeButton: document.querySelector("#analyzeButton"),
  cancelButton: document.querySelector("#cancelButton"),
  startDateInput: document.querySelector("#startDateInput"),
  endDateInput: document.querySelector("#endDateInput"),
  maxVideosInput: document.querySelector("#maxVideosInput"),
  resetScopeButton: document.querySelector("#resetScopeButton"),
  progressArea: document.querySelector("#progressArea"),
  progressText: document.querySelector("#progressText"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  errorBox: document.querySelector("#errorBox"),
  resultsSection: document.querySelector("#resultats"),
  channelThumbnail: document.querySelector("#channelThumbnail"),
  channelTitle: document.querySelector("#channelTitle"),
  channelHandle: document.querySelector("#channelHandle"),
  channelSubscribers: document.querySelector("#channelSubscribers"),
  channelVideoCount: document.querySelector("#channelVideoCount"),
  channelViews: document.querySelector("#channelViews"),
  channelLink: document.querySelector("#channelLink"),
  loadSummary: document.querySelector("#loadSummary"),
  missingBox: document.querySelector("#missingBox"),
  summaryFound: document.querySelector("#summaryFound"),
  summaryViews: document.querySelector("#summaryViews"),
  summaryLikes: document.querySelector("#summaryLikes"),
  summarySelected: document.querySelector("#summarySelected"),
  selectionCount: document.querySelector("#selectionCount"),
  selectPageButton: document.querySelector("#selectPageButton"),
  selectFilteredButton: document.querySelector("#selectFilteredButton"),
  clearSelectionButton: document.querySelector("#clearSelectionButton"),
  searchInput: document.querySelector("#searchInput"),
  searchStatus: document.querySelector("#searchStatus"),
  sortSelect: document.querySelector("#sortSelect"),
  pageSizeSelect: document.querySelector("#pageSizeSelect"),
  videoGrid: document.querySelector("#videoGrid"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  pageLabel: document.querySelector("#pageLabel"),
  chooseColumnsButton: document.querySelector("#chooseColumnsButton"),
  exportExcelButton: document.querySelector("#exportExcelButton"),
  openCollectorButton: document.querySelector("#openCollectorButton"),
  collectorDialog: document.querySelector("#collectorDialog"),
  closeCollectorDialogButton: document.querySelector("#closeCollectorDialogButton"),
  downloadExtensionLink: document.querySelector("#downloadExtensionLink"),
  exportCollectorQueueButton: document.querySelector("#exportCollectorQueueButton"),
  importCollectorResultsButton: document.querySelector("#importCollectorResultsButton"),
  collectorResultsInput: document.querySelector("#collectorResultsInput"),
  collectorMessage: document.querySelector("#collectorMessage"),
  detailDialog: document.querySelector("#detailDialog"),
  detailContent: document.querySelector("#detailContent"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  columnDialog: document.querySelector("#columnDialog"),
  closeColumnDialogButton: document.querySelector("#closeColumnDialogButton"),
  cancelColumnsButton: document.querySelector("#cancelColumnsButton"),
  saveColumnsButton: document.querySelector("#saveColumnsButton"),
  essentialColumnsButton: document.querySelector("#essentialColumnsButton"),
  allColumnsButton: document.querySelector("#allColumnsButton"),
  clearColumnsButton: document.querySelector("#clearColumnsButton"),
  columnGroups: document.querySelector("#columnGroups"),
  columnCountLabel: document.querySelector("#columnCountLabel"),
  columnError: document.querySelector("#columnError"),
  themeButton: document.querySelector("#themeButton")
};

function normalizeStoredExportKeys(stored) {
  if (!Array.isArray(stored)) return [];
  const migrated = [];
  for (const key of stored) {
    if (key === "parisTime") {
      migrated.push("parisDate", "parisExactTime");
    } else if (key === "advertiser") {
      migrated.push("adBrandPrimary", "adBrandsWithCounts", "adAdvertiserPrimary", "adAdvertisersWithCounts");
    } else if (key === "adBrandsAll") {
      migrated.push("adBrandsAll", "adBrandsWithCounts");
    } else if (key === "adAdvertisersAll") {
      migrated.push("adAdvertisersAll", "adAdvertisersWithCounts");
    } else {
      migrated.push(key);
    }
  }
  const validKeys = new Set(EXPORT_COLUMNS.map((column) => column.key));
  return [...new Set(migrated.filter((key) => validKeys.has(key)))];
}

function loadExportColumns() {
  try {
    const currentStored = JSON.parse(localStorage.getItem(STORAGE_KEYS.exportColumns) || "null");
    const currentKeys = normalizeStoredExportKeys(currentStored);
    if (currentKeys.length) return new Set(currentKeys);

    for (const legacyStorageKey of STORAGE_KEYS.legacyExportColumns) {
      const legacyStored = JSON.parse(localStorage.getItem(legacyStorageKey) || "null");
      const legacyKeys = normalizeStoredExportKeys(legacyStored);
      if (legacyKeys.length) {
        const migratedKeys = legacyStorageKey.endsWith("v6")
          ? [...new Set([...legacyKeys, "adBrandPrimary", "adBrandsWithCounts", "adAdvertiserPrimary", "adAdvertisersWithCounts", "adShownCount"])]
          : legacyKeys;
        localStorage.setItem(STORAGE_KEYS.exportColumns, JSON.stringify(migratedKeys));
        return new Set(migratedKeys);
      }
    }
  } catch {
    // Ignore une préférence locale corrompue.
  }
  return new Set(EXPORT_COLUMNS.map((column) => column.key));
}

function normalizeAdObservation(value) {
  if (!value || typeof value !== "object") return null;
  const clean = {
    id: String(value.id || "").trim() || createObservationId(),
    brand: String(value.brand || "").trim(),
    advertiserCompany: String(value.advertiserCompany || "").trim(),
    shown: ["yes", "no", "unknown"].includes(value.shown) ? value.shown : "unknown",
    observedAt: String(value.observedAt || "").trim(),
    location: String(value.location || "").trim(),
    format: ["skippable", "non-skippable", "bumper", "other", "unknown"].includes(value.format) ? value.format : "unknown",
    evidence: String(value.evidence || "").trim(),
    notes: String(value.notes || "").trim(),
    source: String(value.source || "manual").trim() || "manual",
    confidence: value.confidence === "" || value.confidence === null || value.confidence === undefined ? null : Math.max(0, Math.min(1, Number(value.confidence) || 0)),
    detectionMethod: String(value.detectionMethod || "").trim(),
    landingDomain: String(value.landingDomain || "").trim(),
    landingUrl: String(value.landingUrl || "").trim(),
    rawDetectedText: String(value.rawDetectedText || "").trim(),
    candidateBrands: Array.isArray(value.candidateBrands) ? value.candidateBrands.map((item) => String(item || "").trim()).filter(Boolean) : [],
    runId: String(value.runId || "").trim(),
    collectorObservationId: String(value.collectorObservationId || value.id || "").trim()
  };
  return clean;
}

function createObservationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `ad-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadAdObservations() {
  const observations = new Map();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.adObservations) || "{}");
    for (const [videoId, values] of Object.entries(stored || {})) {
      if (!Array.isArray(values)) continue;
      const normalized = values.map(normalizeAdObservation).filter(Boolean);
      if (normalized.length) observations.set(videoId, normalized);
    }
  } catch {
    // Ignore des observations locales corrompues.
  }

  // Migration de l'ancien champ unique « annonceur » vers une première observation.
  try {
    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEYS.legacyAdvertisers) || "{}");
    for (const [videoId, value] of Object.entries(legacy || {})) {
      const clean = typeof value === "string" ? value.trim() : "";
      if (!clean || observations.has(videoId)) continue;
      observations.set(videoId, [{
        id: createObservationId(),
        brand: clean,
        advertiserCompany: clean,
        shown: "yes",
        observedAt: "",
        location: "",
        format: "unknown",
        evidence: "",
        notes: "Donnée migrée depuis l’ancien champ annonceur."
      }]);
    }
  } catch {
    // Ignore une ancienne préférence locale corrompue.
  }

  return observations;
}

function persistAdObservations() {
  localStorage.setItem(STORAGE_KEYS.adObservations, JSON.stringify(Object.fromEntries(state.adObservations)));
}

function getAdObservations(videoId) {
  return state.adObservations.get(String(videoId || "")) || [];
}

function latestAdObservation(videoId) {
  const observations = getAdObservations(videoId);
  return observations.length ? observations[observations.length - 1] : null;
}

function latestAdValue(videoId, field) {
  const observations = getAdObservations(videoId);
  for (let index = observations.length - 1; index >= 0; index -= 1) {
    const value = String(observations[index]?.[field] || "").trim();
    if (value) return value;
  }
  return "";
}

function latestAdRawValue(videoId, field) {
  const observations = getAdObservations(videoId);
  for (let index = observations.length - 1; index >= 0; index -= 1) {
    const value = observations[index]?.[field];
    if (value !== "" && value !== null && value !== undefined) return value;
  }
  return null;
}

function uniqueAdValues(videoId, field) {
  return countAdValues(videoId, field).map(({ value }) => value);
}

function canonicalAdValue(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR");
}

function countAdValues(videoId, field) {
  const counts = new Map();
  for (const observation of getAdObservations(videoId)) {
    const displayValue = String(observation?.[field] || "").trim();
    if (!displayValue) continue;
    const canonical = canonicalAdValue(displayValue);
    const current = counts.get(canonical);
    if (current) current.count += 1;
    else counts.set(canonical, { value: displayValue, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "fr"));
}

function formatAdValueCounts(videoId, field) {
  return countAdValues(videoId, field).map(({ value, count }) => `${value} (${count})`).join(" | ");
}

function mostFrequentAdValue(videoId, field) {
  return countAdValues(videoId, field)[0]?.value || "";
}

function getPrimaryAdBrand(videoId) {
  return latestAdValue(videoId, "brand");
}

function adShownLabel(value) {
  return ({ yes: "Oui", no: "Non", unknown: "Non précisé" })[value] || "";
}

function adFormatLabel(value) {
  return ({
    skippable: "Ignorable",
    "non-skippable": "Non ignorable",
    bumper: "Bumper (6 s)",
    other: "Autre",
    unknown: "Non identifié"
  })[value] || "";
}

function splitObservationDateTime(value) {
  const clean = String(value || "").trim();
  if (!clean) return { date: "", time: "" };
  const [date = "", rawTime = ""] = clean.split("T");
  return { date, time: rawTime.slice(0, 8) };
}

function formatAdHistory(videoId) {
  return getAdObservations(videoId).map((observation, index) => {
    const dateTime = splitObservationDateTime(observation.observedAt);
    return [
      `Test ${index + 1}`,
      observation.brand ? `marque=${observation.brand}` : "",
      observation.advertiserCompany ? `annonceur=${observation.advertiserCompany}` : "",
      `pub=${adShownLabel(observation.shown) || "Non précisé"}`,
      dateTime.date ? `date=${dateTime.date}` : "",
      dateTime.time ? `heure=${dateTime.time}` : "",
      observation.location ? `lieu=${observation.location}` : "",
      observation.format ? `format=${adFormatLabel(observation.format)}` : "",
      observation.evidence ? `preuve=${observation.evidence}` : "",
      observation.source ? `source=${observation.source}` : "",
      observation.confidence !== null && observation.confidence !== undefined ? `confiance=${Math.round(Number(observation.confidence) * 100)}%` : "",
      observation.detectionMethod ? `méthode=${observation.detectionMethod}` : "",
      observation.landingDomain ? `domaine=${observation.landingDomain}` : "",
      observation.runId ? `run=${observation.runId}` : "",
      observation.notes ? `notes=${observation.notes}` : ""
    ].filter(Boolean).join(" ; ");
  }).join(" || ");
}

function buildAdSearchText(videoId) {
  return getAdObservations(videoId).map((observation) => [
    observation.brand,
    observation.advertiserCompany,
    adShownLabel(observation.shown),
    observation.observedAt,
    observation.location,
    adFormatLabel(observation.format),
    observation.evidence,
    observation.source,
    observation.detectionMethod,
    observation.landingDomain,
    observation.landingUrl,
    observation.rawDetectedText,
    ...(observation.candidateBrands || []),
    observation.notes
  ].filter(Boolean).join(" ")).join(" ");
}

function syncVideoAdData(videoId) {
  const id = String(videoId || "");
  const video = state.videos.find((item) => item.id === id);
  if (!video) return;
  video.adBrand = getPrimaryAdBrand(id);
  video.advertiser = uniqueAdValues(id, "advertiserCompany").join(" ");
  video.adSearchText = buildAdSearchText(id);
  state.searchIndex.set(id, buildVideoSearchIndex(video));
}

function addAdObservation(videoId, observation) {
  const id = String(videoId || "");
  if (!id) return;
  const normalized = normalizeAdObservation({ ...observation, id: createObservationId() });
  if (!normalized) return;
  const observations = [...getAdObservations(id), normalized];
  state.adObservations.set(id, observations);
  persistAdObservations();
  syncVideoAdData(id);
  applyFilters();
}

function mergeCollectorObservations(values) {
  const imported = Array.isArray(values) ? values : [];
  let added = 0;
  let skipped = 0;
  let unknownVideos = 0;
  for (const value of imported) {
    const videoId = String(value?.videoId || "").trim();
    if (!videoId) { skipped += 1; continue; }
    const normalized = normalizeAdObservation({ ...value, source: value.source || "chrome-extension" });
    if (!normalized) { skipped += 1; continue; }
    const existing = getAdObservations(videoId);
    const identity = normalized.collectorObservationId || normalized.id;
    if (existing.some((item) => (item.collectorObservationId || item.id) === identity)) { skipped += 1; continue; }
    state.adObservations.set(videoId, [...existing, normalized]);
    if (!state.videos.some((video) => video.id === videoId)) unknownVideos += 1;
    added += 1;
  }
  if (added) {
    persistAdObservations();
    for (const video of state.videos) syncVideoAdData(video.id);
    applyFilters();
  }
  return { added, skipped, unknownVideos };
}

function deleteAdObservation(videoId, observationId) {
  const id = String(videoId || "");
  const remaining = getAdObservations(id).filter((observation) => observation.id !== observationId);
  if (remaining.length) state.adObservations.set(id, remaining);
  else state.adObservations.delete(id);
  persistAdObservations();
  syncVideoAdData(id);
  applyFilters();
}

function currentLocalDateTimeInputValue() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function validIso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function dateTimePartsInTimeZone(value, timeZone) {
  if (!value) return { date: "", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year || ""}-${values.month || ""}-${values.day || ""}`,
    time: `${values.hour || ""}:${values.minute || ""}:${values.second || ""}`
  };
}

function formatDatePartInTimeZone(value, timeZone) {
  return dateTimePartsInTimeZone(value, timeZone).date;
}

function formatTimePartInTimeZone(value, timeZone) {
  return dateTimePartsInTimeZone(value, timeZone).time;
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value || 0);
  return new Intl.NumberFormat("fr-FR", {
    notation: Math.abs(number) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(number);
}

function formatFullNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("fr-FR").format(Number(value));
}

function formatDate(value, includeSeconds = true) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: includeSeconds ? "medium" : "short"
  }).format(date);
}

function formatDateOnly(value) {
  if (!value) return "sans limite";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function formatDateInTimeZone(value, timeZone) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function isoDurationToSeconds(duration) {
  const match = String(duration || "").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
}

function isoDurationToClock(duration) {
  const total = isoDurationToSeconds(duration);
  if (!duration) return "—";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0")).join(":");
}

function engagement(video) {
  const views = Number(video.viewCount || 0);
  const interactions = Number(video.likeCount || 0) + Number(video.commentCount || 0);
  return views > 0 ? interactions / views : 0;
}

function yesNo(value) {
  if (value === null || value === undefined) return "Non précisé";
  return value ? "Oui" : "Non";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showError(message) {
  els.errorBox.textContent = message;
  els.errorBox.hidden = false;
}

function hideError() {
  els.errorBox.hidden = true;
  els.errorBox.textContent = "";
}

function setProgress(done, total, text, forcePercent = null) {
  let percent = forcePercent;
  if (percent === null) percent = total > 0 ? Math.round((done / total) * 100) : 0;
  percent = Math.min(100, Math.max(0, percent));
  els.progressArea.hidden = false;
  els.progressText.textContent = text;
  els.progressPercent.textContent = `${percent} %`;
  els.progressBar.style.width = `${percent}%`;
}

function setProcessing(processing) {
  state.processing = processing;
  els.analyzeButton.disabled = processing || !els.channelInput.value.trim();
  for (const element of [els.channelInput, els.startDateInput, els.endDateInput, els.maxVideosInput, els.resetScopeButton]) {
    element.disabled = processing;
  }
  els.cancelButton.hidden = !processing;
}

async function postJson(url, body, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erreur serveur (${response.status})`);
  return data;
}

function readLoadCriteria() {
  const startDate = els.startDateInput.value || "";
  const endDate = els.endDateInput.value || "";
  const maxRaw = els.maxVideosInput.value.trim();
  const maxVideos = maxRaw === "" ? null : Number(maxRaw);

  if (startDate && endDate && startDate > endDate) {
    throw new Error("La date de début doit être antérieure ou égale à la date de fin.");
  }
  if (maxVideos !== null && (!Number.isInteger(maxVideos) || maxVideos < 1 || maxVideos > 10000)) {
    throw new Error("Le maximum de vidéos doit être un nombre entier compris entre 1 et 10 000, ou être laissé vide.");
  }

  return {
    startDate,
    endDate,
    publishedAfter: startDate ? `${startDate}T00:00:00.000Z` : "",
    publishedBefore: endDate ? `${endDate}T23:59:59.999Z` : "",
    maxVideos
  };
}

function resetResults() {
  state.channel = null;
  state.videos = [];
  state.uploadOrder = [];
  state.missingIds = [];
  state.filtered = [];
  state.searchIndex.clear();
  state.selectedIds.clear();
  state.currentPage = 1;
  state.playlistItemsRead = 0;
  state.quotaEstimate = 0;
  state.loadStopReason = "";
  els.searchInput.value = "";
  els.sortSelect.value = "upload-order";
  els.resultsSection.hidden = true;
}

function progressForLoad(expected) {
  if (state.loadCriteria?.maxVideos) {
    return Math.min(99, Math.round((state.videos.length / state.loadCriteria.maxVideos) * 100));
  }
  return expected > 0 ? Math.min(99, Math.round((state.playlistItemsRead / expected) * 100)) : 5;
}

async function analyzeChannel() {
  const channelInput = els.channelInput.value.trim();
  if (!channelInput || state.processing) return;

  let criteria;
  try {
    criteria = readLoadCriteria();
  } catch (error) {
    showError(error.message);
    return;
  }

  resetResults();
  state.loadCriteria = criteria;
  hideError();
  state.controller = new AbortController();
  setProcessing(true);
  setProgress(0, criteria.maxVideos || 1, "Identification de la chaîne…", 3);

  try {
    const resolved = await postJson("/api/resolve-channel", { channelInput }, state.controller.signal);
    state.channel = resolved.channel;
    state.quotaEstimate += Number(state.channel.resolutionQuotaEstimate || 1);
    renderChannel();
    els.resultsSection.hidden = false;

    const expectedFromChannel = Number(state.channel.videoCount || 0);
    let expected = expectedFromChannel;
    let pageToken = "";
    let pageNumber = 0;
    const seenIds = new Set();

    do {
      const remaining = criteria.maxVideos === null ? null : criteria.maxVideos - state.videos.length;
      if (remaining !== null && remaining <= 0) {
        state.loadStopReason = "Plafond atteint";
        break;
      }

      const data = await postJson("/api/channel-videos", {
        playlistId: state.channel.uploadsPlaylistId,
        pageToken,
        publishedAfter: criteria.publishedAfter,
        publishedBefore: criteria.publishedBefore,
        limit: null
      }, state.controller.signal);

      pageNumber += 1;
      state.quotaEstimate += Number(data.quotaEstimate || 0);
      state.playlistItemsRead += Number(data.playlistItemsRead || 0);
      expected = Math.max(expected, Number(data.pageInfo?.totalResults || 0), state.playlistItemsRead);

      for (const video of data.videos || []) {
        if (seenIds.has(video.id)) continue;
        if (criteria.maxVideos !== null && state.videos.length >= criteria.maxVideos) break;
        seenIds.add(video.id);
        video.channel = state.channel;
        video.adBrand = getPrimaryAdBrand(video.id);
        video.advertiser = uniqueAdValues(video.id, "advertiserCompany").join(" ");
        video.adSearchText = buildAdSearchText(video.id);
        state.videos.push(video);
        state.searchIndex.set(video.id, buildVideoSearchIndex(video));
        state.uploadOrder.push(video.id);
      }
      state.missingIds.push(...(data.notFoundIds || []));

      const capReached = criteria.maxVideos !== null && state.videos.length >= criteria.maxVideos;
      const periodStartReached = Boolean(data.reachedStartBoundary);
      pageToken = data.nextPageToken || "";

      setProgress(
        criteria.maxVideos ? state.videos.length : state.playlistItemsRead,
        criteria.maxVideos || expected || state.playlistItemsRead,
        `${formatFullNumber(state.videos.length)} vidéos chargées · ${formatFullNumber(state.playlistItemsRead)} éléments parcourus · lot ${pageNumber}`,
        capReached || periodStartReached || !pageToken ? 100 : progressForLoad(expected)
      );

      if (pageNumber === 1 || pageNumber % 4 === 0 || capReached || periodStartReached || !pageToken) updateResults();

      if (capReached) {
        state.loadStopReason = "Plafond atteint";
        break;
      }
      if (periodStartReached) {
        state.loadStopReason = "Début de période atteint";
        break;
      }
      if (pageNumber >= 1000) {
        state.loadStopReason = "Limite de sécurité atteinte";
        break;
      }
    } while (pageToken);

    if (!state.loadStopReason) state.loadStopReason = "Fin de la playlist atteinte";
    updateResults();
    setProgress(
      criteria.maxVideos ? Math.min(state.videos.length, criteria.maxVideos) : state.playlistItemsRead,
      criteria.maxVideos || Math.max(expected, state.playlistItemsRead, 1),
      `${formatFullNumber(state.videos.length)} vidéos chargées · ${state.loadStopReason.toLowerCase()}`,
      100
    );
    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (error.name === "AbortError") {
      state.loadStopReason = "Chargement arrêté manuellement";
      if (state.videos.length) {
        updateResults();
        setProgress(state.videos.length, state.loadCriteria?.maxVideos || Math.max(state.playlistItemsRead, 1), `Chargement arrêté · ${formatFullNumber(state.videos.length)} vidéos conservées`, 100);
      } else {
        setProgress(0, 1, "Chargement arrêté", 0);
      }
    } else {
      showError(error.message || "Une erreur est survenue pendant le chargement de la chaîne.");
    }
  } finally {
    state.controller = null;
    setProcessing(false);
  }
}

function renderChannel() {
  const channel = state.channel;
  if (!channel) return;
  els.channelThumbnail.src = channel.thumbnail || "";
  els.channelThumbnail.alt = channel.title ? `Photo de ${channel.title}` : "";
  els.channelTitle.textContent = channel.title || "Chaîne YouTube";
  els.channelHandle.textContent = channel.customUrl || channel.id;
  els.channelSubscribers.textContent = channel.hiddenSubscriberCount ? "Masqués" : formatNumber(channel.subscriberCount);
  els.channelVideoCount.textContent = formatFullNumber(channel.videoCount);
  els.channelViews.textContent = formatNumber(channel.viewCount);
  els.channelLink.href = channel.customUrl
    ? `https://www.youtube.com/${channel.customUrl.startsWith("@") ? channel.customUrl : `@${channel.customUrl}`}`
    : channel.url;
}

function criteriaSummary() {
  const criteria = state.loadCriteria || {};
  const period = criteria.startDate || criteria.endDate
    ? `période du ${formatDateOnly(criteria.startDate)} au ${formatDateOnly(criteria.endDate)}`
    : "toutes dates";
  const cap = criteria.maxVideos ? `plafond ${formatFullNumber(criteria.maxVideos)} vidéos` : "sans plafond vidéo";
  return `${period} · ${cap}`;
}

function updateResults() {
  const totalViews = state.videos.reduce((sum, video) => sum + Number(video.viewCount || 0), 0);
  const totalLikes = state.videos.reduce((sum, video) => sum + Number(video.likeCount || 0), 0);

  els.summaryFound.textContent = formatFullNumber(state.videos.length);
  els.summaryViews.textContent = formatNumber(totalViews);
  els.summaryLikes.textContent = formatNumber(totalLikes);
  els.loadSummary.textContent = `${formatFullNumber(state.videos.length)} vidéo${state.videos.length > 1 ? "s" : ""} disponible${state.videos.length > 1 ? "s" : ""} · ${criteriaSummary()} · ${state.loadStopReason || "chargement en cours"} · environ ${formatFullNumber(state.quotaEstimate)} unité${state.quotaEstimate > 1 ? "s" : ""} de quota`;

  if (state.missingIds.length) {
    els.missingBox.hidden = false;
    els.missingBox.textContent = `${formatFullNumber(state.missingIds.length)} élément${state.missingIds.length > 1 ? "s" : ""} de la playlist n’a pas pu être lu : vidéo privée, supprimée ou indisponible.`;
  } else {
    els.missingBox.hidden = true;
  }

  applyFilters();
  updateSelectionUi();
}

function applyFilters() {
  const parsedQuery = parseSearchQuery(els.searchInput.value);
  const sort = els.sortSelect.value;
  const uploadOrder = new Map(state.uploadOrder.map((id, index) => [id, index]));

  state.filtered = state.videos.filter((video) => {
    let index = state.searchIndex.get(video.id);
    if (!index) {
      index = buildVideoSearchIndex(video);
      state.searchIndex.set(video.id, index);
    }
    return matchesVideoSearch(index, parsedQuery);
  });

  if (sort === "views-desc") state.filtered.sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0));
  if (sort === "likes-desc") state.filtered.sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0));
  if (sort === "date-desc") state.filtered.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  if (sort === "date-asc") state.filtered.sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));
  if (sort === "upload-order") state.filtered.sort((a, b) => (uploadOrder.get(a.id) ?? 0) - (uploadOrder.get(b.id) ?? 0));

  const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.currentPage = Math.min(state.currentPage, totalPages);
  updateSearchStatus(parsedQuery);
  renderPage();
}

function updateSearchStatus(parsedQuery) {
  if (!parsedQuery.raw) {
    els.searchStatus.hidden = true;
    els.searchStatus.textContent = "";
    return;
  }
  els.searchStatus.hidden = false;
  els.searchStatus.textContent = `${formatFullNumber(state.filtered.length)} résultat${state.filtered.length > 1 ? "s" : ""} sur ${formatFullNumber(state.videos.length)} pour « ${parsedQuery.raw} »`;
}

function currentPageVideos() {
  const start = (state.currentPage - 1) * state.pageSize;
  return state.filtered.slice(start, start + state.pageSize);
}

function renderPage() {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  const pageVideos = currentPageVideos();

  els.videoGrid.innerHTML = pageVideos.map((video) => {
    const selected = state.selectedIds.has(video.id);
    const adBrand = getPrimaryAdBrand(video.id);
    const adTestCount = getAdObservations(video.id).length;
    return `
      <article class="video-card${selected ? " is-selected" : ""}" data-card-id="${escapeHtml(video.id)}">
        <label class="select-control" title="Sélectionner cette vidéo">
          <input type="checkbox" data-select-id="${escapeHtml(video.id)}" ${selected ? "checked" : ""} />
          <span>${selected ? "Sélectionnée" : "Sélectionner"}</span>
        </label>
        <div class="video-thumb-wrap">
          <img class="video-thumb" src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy" />
          <span class="duration-badge">${escapeHtml(isoDurationToClock(video.duration))}</span>
        </div>
        <div class="video-body">
          <h3 class="video-title">${escapeHtml(video.title || "Sans titre")}</h3>
          <div class="publication-line">Publié le ${escapeHtml(formatDate(video.publishedAt, true))}</div>
          ${adBrand ? `<div class="advertiser-badge">Marque pré-roll : ${escapeHtml(adBrand)}${adTestCount > 1 ? ` · ${adTestCount} tests` : ""}</div>` : adTestCount ? `<div class="advertiser-badge">Pré-roll : ${adTestCount} test${adTestCount > 1 ? "s" : ""} enregistré${adTestCount > 1 ? "s" : ""}</div>` : ""}
          <div class="metric-row">
            <div class="metric"><strong>${formatNumber(video.viewCount)}</strong><span>Vues</span></div>
            <div class="metric"><strong>${formatNumber(video.likeCount)}</strong><span>Likes</span></div>
            <div class="metric"><strong>${(engagement(video) * 100).toFixed(2).replace(".", ",")}%</strong><span>Engagement</span></div>
          </div>
          <div class="card-actions">
            <button type="button" data-detail-id="${escapeHtml(video.id)}">Voir les métadonnées</button>
            <a href="${escapeHtml(video.url)}" target="_blank" rel="noopener">YouTube ↗</a>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (pageVideos.length === 0) {
    const currentQuery = els.searchInput.value.trim();
    const message = currentQuery
      ? `Aucune vidéo ne correspond aux mots-clés « ${escapeHtml(currentQuery)} ».`
      : "Aucune vidéo disponible sur la période choisie.";
    els.videoGrid.innerHTML = `<div class="message empty-message">${message}</div>`;
  }

  els.pageLabel.textContent = `Page ${state.currentPage} / ${totalPages}`;
  els.prevButton.disabled = state.currentPage <= 1;
  els.nextButton.disabled = state.currentPage >= totalPages;
  updateSelectionUi();
}

function updateSelectionUi() {
  const count = state.selectedIds.size;
  els.summarySelected.textContent = formatFullNumber(count);
  els.selectionCount.textContent = formatFullNumber(count);
  els.exportExcelButton.disabled = count === 0 || state.exportColumnKeys.size === 0;
  els.clearSelectionButton.disabled = count === 0;
  els.selectPageButton.disabled = currentPageVideos().length === 0;
  els.selectFilteredButton.disabled = state.filtered.length === 0;
  els.chooseColumnsButton.textContent = `Colonnes Excel (${state.exportColumnKeys.size})`;
  if (els.exportCollectorQueueButton) els.exportCollectorQueueButton.disabled = count === 0;
  const status = document.querySelector(".selection-status");
  if (status?.lastChild) status.lastChild.textContent = ` vidéo${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`;
}

function setVideoSelected(id, selected) {
  if (selected) state.selectedIds.add(id);
  else state.selectedIds.delete(id);
  const card = els.videoGrid.querySelector(`[data-card-id="${CSS.escape(id)}"]`);
  if (card) {
    card.classList.toggle("is-selected", selected);
    const label = card.querySelector(".select-control span");
    if (label) label.textContent = selected ? "Sélectionnée" : "Sélectionner";
  }
  updateSelectionUi();
}

function selectVideos(videos) {
  for (const video of videos) state.selectedIds.add(video.id);
  renderPage();
}

function detailLine(label, value) {
  const rendered = value === null || value === undefined || value === "" ? "—" : String(value);
  return `<div class="data-line"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(rendered)}</dd></div>`;
}

function renderAdObservationEditor(video) {
  const observations = getAdObservations(video.id);
  const brand = mostFrequentAdValue(video.id, "brand");
  const brandCounts = formatAdValueCounts(video.id, "brand");
  const advertiserCounts = formatAdValueCounts(video.id, "advertiserCompany");
  const shownCount = observations.filter((observation) => observation.shown === "yes").length;
  const history = observations.length
    ? observations.slice().reverse().map((observation, reverseIndex) => {
      const originalIndex = observations.length - reverseIndex;
      const dateTime = splitObservationDateTime(observation.observedAt);
      return `
        <article class="ad-observation-card">
          <div class="ad-observation-head">
            <div>
              <strong>${escapeHtml(observation.brand || (observation.shown === "no" ? "Aucune publicité" : "Marque non renseignée"))}</strong>
              <span>Test ${originalIndex}${observation.advertiserCompany ? ` · ${escapeHtml(observation.advertiserCompany)}` : ""}</span>
            </div>
            <button type="button" class="button ghost small danger-text" data-delete-ad-observation="${escapeHtml(observation.id)}" data-video-id="${escapeHtml(video.id)}">Supprimer</button>
          </div>
          <dl class="ad-observation-data">
            ${detailLine("Publicité affichée", adShownLabel(observation.shown))}
            ${detailLine("Date", dateTime.date)}
            ${detailLine("Heure", dateTime.time)}
            ${detailLine("Pays / localisation", observation.location)}
            ${detailLine("Format", adFormatLabel(observation.format))}
            ${detailLine("Lien / preuve", observation.evidence)}
            ${detailLine("Source", observation.source)}
            ${detailLine("Confiance", observation.confidence === null || observation.confidence === undefined ? "" : `${Math.round(Number(observation.confidence) * 100)} %`)}
            ${detailLine("Méthode", observation.detectionMethod)}
            ${detailLine("Domaine de destination", observation.landingDomain)}
            ${detailLine("Run de collecte", observation.runId)}
            ${detailLine("Notes", observation.notes)}
          </dl>
        </article>`;
    }).join("")
    : `<div class="message empty-message compact">Aucun test pré-roll enregistré pour cette vidéo.</div>`;

  return `
    <section class="detail-section full advertiser-editor">
      <div class="ad-editor-title-row">
        <div>
          <h3>Observations pré-roll</h3>
          <p>La <strong>marque</strong> est mise en avant dans les cartes, la recherche et la sélection essentielle de l’export. Chaque ajout correspond à un test distinct, ce qui permet de conserver plusieurs marques pour une même vidéo.</p>
        </div>
        <div class="ad-summary-pill"><strong>${escapeHtml(brand || "—")}</strong><span>Marque principale</span></div>
      </div>
      <div class="ad-test-summary"><strong>${observations.length}</strong> test${observations.length > 1 ? "s" : ""} enregistré${observations.length > 1 ? "s" : ""} · <strong>${shownCount}</strong> avec publicité</div>
      ${brandCounts ? `<div class="ad-count-list"><strong>Marques recensées :</strong> ${escapeHtml(brandCounts)}</div>` : ""}
      ${advertiserCounts ? `<div class="ad-count-list"><strong>Entreprises recensées :</strong> ${escapeHtml(advertiserCounts)}</div>` : ""}

      <form class="ad-observation-form" data-ad-form-id="${escapeHtml(video.id)}">
        <div class="ad-form-grid">
          <label class="brand-field">
            <span>Marque affichée <em>prioritaire</em></span>
            <input name="brand" type="text" placeholder="Ex. Renault, Nike, Orange…" autocomplete="organization" />
          </label>
          <label>
            <span>Entreprise annonceuse</span>
            <input name="advertiserCompany" type="text" placeholder="Ex. Renault SAS, Nike France…" autocomplete="organization" />
          </label>
          <label>
            <span>Publicité affichée</span>
            <select name="shown">
              <option value="yes" selected>Oui</option>
              <option value="no">Non</option>
              <option value="unknown">Non précisé</option>
            </select>
          </label>
          <label>
            <span>Date et heure du test</span>
            <input name="observedAt" type="datetime-local" value="${escapeHtml(currentLocalDateTimeInputValue())}" />
          </label>
          <label>
            <span>Pays / localisation</span>
            <input name="location" type="text" placeholder="Ex. France, Paris" />
          </label>
          <label>
            <span>Format</span>
            <select name="format">
              <option value="unknown" selected>Non identifié</option>
              <option value="skippable">Ignorable</option>
              <option value="non-skippable">Non ignorable</option>
              <option value="bumper">Bumper (6 s)</option>
              <option value="other">Autre</option>
            </select>
          </label>
          <label class="wide-field">
            <span>Lien « À propos de cette annonce » / référence de capture</span>
            <input name="evidence" type="text" placeholder="URL, nom du fichier ou référence de la capture" />
          </label>
          <label class="wide-field">
            <span>Notes</span>
            <textarea name="notes" rows="2" placeholder="Contexte du test, compte connecté, appareil, etc."></textarea>
          </label>
        </div>
        <div class="ad-form-actions">
          <span class="ad-form-error" data-ad-form-error hidden>Renseigne au moins la marque, l’annonceur, un statut ou une note.</span>
          <button type="submit" class="button primary">Ajouter cette observation</button>
        </div>
      </form>

      <div class="ad-observation-history">
        <h4>Historique des tests</h4>
        ${history}
      </div>
    </section>`;
}

function openDetails(id) {
  const video = state.videos.find((item) => item.id === id);
  if (!video) return;
  const blocked = video.regionRestriction?.blocked?.join(", ") || "Aucun blocage déclaré";
  const allowed = video.regionRestriction?.allowed?.join(", ") || "Tous les pays, sauf blocages éventuels";
  const utc = validIso(video.publishedAt) || "—";

  els.detailContent.innerHTML = `
    <div class="detail-content-inner">
      <div class="detail-hero">
        <img src="${escapeHtml(video.thumbnail)}" alt="" />
        <div>
          <div class="eyebrow">${escapeHtml(video.id)}</div>
          <h2>${escapeHtml(video.title)}</h2>
          <p class="publication-line">${escapeHtml(formatDate(video.publishedAt, true))}</p>
          <div class="tags">
            <span class="tag">${formatFullNumber(video.viewCount)} vues</span>
            <span class="tag">${formatFullNumber(video.likeCount)} likes</span>
            <span class="tag">${escapeHtml(isoDurationToClock(video.duration))}</span>
            <span class="tag">${escapeHtml(String(video.definition || "").toUpperCase())}</span>
          </div>
        </div>
      </div>

      ${renderAdObservationEditor(video)}

      <div class="detail-grid">
        <section class="detail-section">
          <h3>Publication</h3>
          <dl class="data-list">
            ${detailLine("Date/heure exacte UTC", utc)}
            ${detailLine("Heure de Paris", formatDateInTimeZone(video.publishedAt, "Europe/Paris"))}
            ${detailLine("Diffusion", video.liveBroadcastContent)}
            ${detailLine("Date de tournage", video.recordingDate)}
          </dl>
        </section>

        <section class="detail-section">
          <h3>Statistiques</h3>
          <dl class="data-list">
            ${detailLine("Vues", formatFullNumber(video.viewCount))}
            ${detailLine("Likes", formatFullNumber(video.likeCount))}
            ${detailLine("Commentaires", formatFullNumber(video.commentCount))}
            ${detailLine("Engagement", `${(engagement(video) * 100).toFixed(3).replace(".", ",")} %`)}
          </dl>
        </section>

        <section class="detail-section">
          <h3>Détails techniques</h3>
          <dl class="data-list">
            ${detailLine("Durée ISO", video.duration)}
            ${detailLine("Durée", isoDurationToClock(video.duration))}
            ${detailLine("Définition", video.definition)}
            ${detailLine("Dimension", video.dimension)}
            ${detailLine("Sous-titres", video.caption === "true" ? "Oui" : "Non")}
            ${detailLine("Projection", video.projection)}
          </dl>
        </section>

        <section class="detail-section">
          <h3>Statut et restrictions</h3>
          <dl class="data-list">
            ${detailLine("Confidentialité", video.privacyStatus)}
            ${detailLine("Licence", video.license)}
            ${detailLine("Intégrable", video.embeddable === null ? "—" : video.embeddable ? "Oui" : "Non")}
            ${detailLine("Destinée aux enfants", video.madeForKids === null ? "Non précisé" : video.madeForKids ? "Oui" : "Non")}
            ${detailLine("Pays bloqués", blocked)}
            ${detailLine("Pays autorisés", allowed)}
          </dl>
        </section>

        <section class="detail-section full">
          <h3>Informations générales</h3>
          <dl class="data-list">
            ${detailLine("URL", video.url)}
            ${detailLine("ID vidéo", video.id)}
            ${detailLine("ID catégorie", video.categoryId)}
            ${detailLine("Langue", video.defaultLanguage)}
            ${detailLine("Langue audio", video.defaultAudioLanguage)}
          </dl>
        </section>

        <section class="detail-section full">
          <h3>Tags</h3>
          <div class="tags">${(video.tags || []).length ? video.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("") : "Aucun tag public"}</div>
        </section>

        <section class="detail-section full">
          <h3>Description complète</h3>
          <div class="description-text">${escapeHtml(video.description || "Aucune description")}</div>
        </section>
      </div>
    </div>
  `;

  if (!els.detailDialog.open) els.detailDialog.showModal();
}

function sanitizeFilename(value) {
  return String(value || "chaine-youtube")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "chaine-youtube";
}

function excelColumnName(number) {
  let value = Number(number);
  let output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output || "A";
}


function styleWorksheet(sheet, columnCount) {
  if (!sheet || columnCount < 1) return;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `${excelColumnName(columnCount)}1` };
  sheet.getRow(1).height = 30;
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0033" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FFB00022" } } };
  });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F8FA" } };
      });
    }
  });
}

function addHyperlink(cell, value) {
  const link = String(value || "").trim();
  if (!link) return;
  cell.value = { text: link, hyperlink: link };
  cell.font = { color: { argb: "FF0563C1" }, underline: true };
}

function collectSelectedAdObservations(videos) {
  const rows = [];
  for (const video of videos) {
    getAdObservations(video.id).forEach((observation, index) => {
      const dateTime = splitObservationDateTime(observation.observedAt);
      rows.push({
        videoTitle: video.title || "",
        videoUrl: video.url || "",
        videoId: video.id || "",
        observationNumber: index + 1,
        brand: observation.brand || "",
        advertiserCompany: observation.advertiserCompany || "",
        presenceCount: 1,
        shown: adShownLabel(observation.shown),
        observedDate: dateTime.date,
        observedTime: dateTime.time,
        location: observation.location || "",
        format: adFormatLabel(observation.format),
        evidence: observation.evidence || "",
        source: observation.source || "manual",
        confidence: observation.confidence === null || observation.confidence === undefined ? null : Number(observation.confidence),
        detectionMethod: observation.detectionMethod || "",
        landingDomain: observation.landingDomain || "",
        landingUrl: observation.landingUrl || "",
        rawDetectedText: observation.rawDetectedText || "",
        runId: observation.runId || "",
        notes: observation.notes || ""
      });
    });
  }
  return rows;
}

function addCountToMap(map, displayValue) {
  const clean = String(displayValue || "").trim();
  if (!clean) return;
  const key = canonicalAdValue(clean);
  const current = map.get(key);
  if (current) current.count += 1;
  else map.set(key, { value: clean, count: 1 });
}

function formatCountMap(map, labelFormatter = (value) => value) {
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "fr"))
    .map(({ value, count }) => `${labelFormatter(value)} (${count})`)
    .join(" | ");
}

function collectAdvertiserSummary(videos) {
  const summary = new Map();
  for (const video of videos) {
    for (const observation of getAdObservations(video.id)) {
      const brand = String(observation.brand || "").trim();
      const company = String(observation.advertiserCompany || "").trim();
      if (!brand && !company) continue;
      const key = `${canonicalAdValue(brand)}||${canonicalAdValue(company)}`;
      if (!summary.has(key)) {
        summary.set(key, {
          brand,
          advertiserCompany: company,
          presenceCount: 0,
          videoIds: new Set(),
          videoTitles: new Set(),
          firstObservedAt: "",
          lastObservedAt: "",
          locations: new Map(),
          formats: new Map(),
          sources: new Map(),
          methods: new Map(),
          domains: new Map(),
          confidenceTotal: 0,
          confidenceCount: 0,
          evidence: new Set(),
          notes: new Set()
        });
      }
      const entry = summary.get(key);
      entry.presenceCount += 1;
      entry.videoIds.add(video.id);
      entry.videoTitles.add(video.title || video.id);
      addCountToMap(entry.locations, observation.location);
      if (observation.format) addCountToMap(entry.formats, observation.format);
      if (observation.source) addCountToMap(entry.sources, observation.source);
      if (observation.detectionMethod) addCountToMap(entry.methods, observation.detectionMethod);
      if (observation.landingDomain) addCountToMap(entry.domains, observation.landingDomain);
      if (observation.confidence !== null && observation.confidence !== undefined && Number.isFinite(Number(observation.confidence))) {
        entry.confidenceTotal += Number(observation.confidence);
        entry.confidenceCount += 1;
      }
      if (observation.evidence) entry.evidence.add(observation.evidence);
      if (observation.notes) entry.notes.add(observation.notes);
      const observedAt = String(observation.observedAt || "").trim();
      if (observedAt) {
        if (!entry.firstObservedAt || observedAt < entry.firstObservedAt) entry.firstObservedAt = observedAt;
        if (!entry.lastObservedAt || observedAt > entry.lastObservedAt) entry.lastObservedAt = observedAt;
      }
    }
  }

  return [...summary.values()]
    .map((entry) => ({
      brand: entry.brand,
      advertiserCompany: entry.advertiserCompany,
      presenceCount: entry.presenceCount,
      distinctVideoCount: entry.videoIds.size,
      videos: [...entry.videoTitles].join(" | "),
      firstObservedAt: entry.firstObservedAt,
      lastObservedAt: entry.lastObservedAt,
      locations: formatCountMap(entry.locations),
      formats: formatCountMap(entry.formats, adFormatLabel),
      sources: formatCountMap(entry.sources),
      methods: formatCountMap(entry.methods),
      domains: formatCountMap(entry.domains),
      averageConfidence: entry.confidenceCount ? entry.confidenceTotal / entry.confidenceCount : null,
      evidence: [...entry.evidence].join(" | "),
      notes: [...entry.notes].join(" | ")
    }))
    .sort((a, b) => b.presenceCount - a.presenceCount || a.brand.localeCompare(b.brand, "fr") || a.advertiserCompany.localeCompare(b.advertiserCompany, "fr"));
}

function addAdExportSheets(workbook, selectedVideos) {
  const observationRows = collectSelectedAdObservations(selectedVideos);
  const observationSheet = workbook.addWorksheet("Observations pré-roll");
  observationSheet.columns = [
    { header: "Titre vidéo", key: "videoTitle", width: 44 },
    { header: "URL YouTube", key: "videoUrl", width: 34 },
    { header: "ID vidéo", key: "videoId", width: 16 },
    { header: "N° du test", key: "observationNumber", width: 12 },
    { header: "Marque", key: "brand", width: 28 },
    { header: "Entreprise annonceuse", key: "advertiserCompany", width: 34 },
    { header: "Nombre de présences", key: "presenceCount", width: 21 },
    { header: "Publicité affichée", key: "shown", width: 20 },
    { header: "Date d’observation", key: "observedDate", width: 20 },
    { header: "Heure d’observation", key: "observedTime", width: 20 },
    { header: "Pays / localisation", key: "location", width: 28 },
    { header: "Format", key: "format", width: 24 },
    { header: "Lien / preuve", key: "evidence", width: 46 },
    { header: "Source", key: "source", width: 24 },
    { header: "Confiance", key: "confidence", width: 16 },
    { header: "Méthode de détection", key: "detectionMethod", width: 28 },
    { header: "Domaine de destination", key: "landingDomain", width: 30 },
    { header: "URL de destination", key: "landingUrl", width: 48 },
    { header: "Texte détecté", key: "rawDetectedText", width: 70 },
    { header: "Run de collecte", key: "runId", width: 34 },
    { header: "Notes", key: "notes", width: 55 }
  ];
  if (observationRows.length) {
    for (const data of observationRows) {
      const row = observationSheet.addRow(data);
      addHyperlink(row.getCell("videoUrl"), data.videoUrl);
      if (/^https?:\/\//i.test(data.evidence)) addHyperlink(row.getCell("evidence"), data.evidence);
      if (/^https?:\/\//i.test(data.landingUrl)) addHyperlink(row.getCell("landingUrl"), data.landingUrl);
    }
  } else {
    observationSheet.addRow({ videoTitle: "Aucune observation pré-roll enregistrée pour les vidéos sélectionnées." });
  }
  observationSheet.getColumn("observationNumber").numFmt = "#,##0";
  observationSheet.getColumn("presenceCount").numFmt = "#,##0";
  observationSheet.getColumn("confidence").numFmt = "0%";
  styleWorksheet(observationSheet, observationSheet.columns.length);

  const summaryRows = collectAdvertiserSummary(selectedVideos);
  const summarySheet = workbook.addWorksheet("Synthèse annonceurs");
  summarySheet.columns = [
    { header: "Marque", key: "brand", width: 30 },
    { header: "Entreprise annonceuse", key: "advertiserCompany", width: 36 },
    { header: "Nombre de présences", key: "presenceCount", width: 21 },
    { header: "Nombre de vidéos distinctes", key: "distinctVideoCount", width: 27 },
    { header: "Vidéos concernées", key: "videos", width: 70 },
    { header: "Première observation", key: "firstObservedAt", width: 24 },
    { header: "Dernière observation", key: "lastObservedAt", width: 24 },
    { header: "Localisations avec présences", key: "locations", width: 45 },
    { header: "Formats avec présences", key: "formats", width: 40 },
    { header: "Sources avec présences", key: "sources", width: 34 },
    { header: "Méthodes de détection", key: "methods", width: 40 },
    { header: "Domaines de destination", key: "domains", width: 45 },
    { header: "Confiance moyenne", key: "averageConfidence", width: 20 },
    { header: "Preuves / références", key: "evidence", width: 60 },
    { header: "Notes", key: "notes", width: 60 }
  ];
  if (summaryRows.length) summarySheet.addRows(summaryRows);
  else summarySheet.addRow({ brand: "Aucun annonceur ou aucune marque enregistrée pour les vidéos sélectionnées." });
  summarySheet.getColumn("presenceCount").numFmt = "#,##0";
  summarySheet.getColumn("distinctVideoCount").numFmt = "#,##0";
  summarySheet.getColumn("averageConfidence").numFmt = "0%";
  styleWorksheet(summarySheet, summarySheet.columns.length);

  return { observationRows, summaryRows };
}

function selectedExportColumns() {
  return EXPORT_COLUMNS.filter((column) => state.exportColumnKeys.has(column.key));
}

function renderColumnDialog() {
  state.exportColumnDraftKeys = new Set(state.exportColumnKeys);
  const groups = new Map();
  for (const column of EXPORT_COLUMNS) {
    if (!groups.has(column.group)) groups.set(column.group, []);
    groups.get(column.group).push(column);
  }

  els.columnGroups.innerHTML = [...groups.entries()].map(([group, columns]) => `
    <fieldset class="column-group">
      <legend>${escapeHtml(group)}</legend>
      <div class="column-options">
        ${columns.map((column) => {
          const inputId = `export-column-${column.key}`;
          return `
          <label class="column-option" for="${escapeHtml(inputId)}">
            <input id="${escapeHtml(inputId)}" type="checkbox" data-column-key="${escapeHtml(column.key)}" ${state.exportColumnDraftKeys.has(column.key) ? "checked" : ""} />
            <span>${escapeHtml(column.header)}</span>
          </label>`;
        }).join("")}
      </div>
    </fieldset>
  `).join("");
  updateColumnDialogCount();
  els.columnError.hidden = true;
}

function currentColumnDraftKeys() {
  if (!(state.exportColumnDraftKeys instanceof Set)) {
    state.exportColumnDraftKeys = new Set(state.exportColumnKeys);
  }
  return state.exportColumnDraftKeys;
}

function setColumnDialogKeys(keys) {
  state.exportColumnDraftKeys = new Set(keys);
  for (const input of els.columnGroups.querySelectorAll("[data-column-key]")) {
    input.checked = state.exportColumnDraftKeys.has(input.dataset.columnKey);
  }
  els.columnError.hidden = true;
  updateColumnDialogCount();
}

function updateColumnDialogCount() {
  const count = currentColumnDraftKeys().size;
  els.columnCountLabel.textContent = `${count} colonne${count > 1 ? "s" : ""}`;
}

function handleColumnDialogChange(event) {
  const input = event.target.closest("[data-column-key]");
  if (!input) return;
  const draft = currentColumnDraftKeys();
  if (input.checked) draft.add(input.dataset.columnKey);
  else draft.delete(input.dataset.columnKey);
  els.columnError.hidden = true;
  updateColumnDialogCount();
}

function saveColumnSelection() {
  const keys = new Set(currentColumnDraftKeys());
  if (!keys.size) {
    els.columnError.hidden = false;
    return;
  }
  state.exportColumnKeys = keys;
  localStorage.setItem(STORAGE_KEYS.exportColumns, JSON.stringify([...keys]));
  els.columnError.hidden = true;
  state.exportColumnDraftKeys = null;
  els.columnDialog.close();
  updateSelectionUi();
}

function closeColumnDialog() {
  state.exportColumnDraftKeys = null;
  els.columnDialog.close();
}

function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCollectorQueue() {
  const videos = state.videos.filter((video) => state.selectedIds.has(video.id)).map((video) => ({
    videoId: video.id,
    title: video.title || "",
    url: video.url || `https://www.youtube.com/watch?v=${video.id}`,
    publishedAt: video.publishedAt || "",
    channelId: video.channelId || "",
    channelTitle: video.channelTitle || ""
  }));
  if (!videos.length) return;
  downloadJsonFile(`file-collecte-preroll-${sanitizeFilename(state.channel?.title)}-${new Date().toISOString().slice(0, 10)}.json`, {
    schema: "yt-preroll-collector-queue-v1",
    createdAt: new Date().toISOString(),
    channel: state.channel ? { id: state.channel.id, title: state.channel.title, url: state.channel.url } : null,
    videos
  });
  els.collectorMessage.hidden = false;
  els.collectorMessage.className = "message info";
  els.collectorMessage.textContent = `${videos.length} vidéo${videos.length > 1 ? "s" : ""} ajoutée${videos.length > 1 ? "s" : ""} à la file JSON. Importe ce fichier dans l’extension Chrome.`;
}

async function importCollectorResults(file) {
  const parsed = JSON.parse(await file.text());
  const observations = Array.isArray(parsed) ? parsed : parsed.observations;
  if (!Array.isArray(observations)) throw new Error("Le fichier ne contient pas d’observations reconnues.");
  const result = mergeCollectorObservations(observations);
  els.collectorMessage.hidden = false;
  els.collectorMessage.className = result.added ? "message success" : "message warning";
  els.collectorMessage.textContent = `${result.added} observation${result.added > 1 ? "s" : ""} importée${result.added > 1 ? "s" : ""}. ${result.skipped} doublon${result.skipped > 1 ? "s" : ""} ou ligne${result.skipped > 1 ? "s" : ""} ignorée${result.skipped > 1 ? "s" : ""}.${result.unknownVideos ? ` ${result.unknownVideos} concernent des vidéos non chargées actuellement mais restent mémorisées.` : ""}`;
}

async function exportExcel() {
  const selectedVideos = state.videos.filter((video) => state.selectedIds.has(video.id));
  const columns = selectedExportColumns();
  if (!selectedVideos.length || !columns.length) return;
  if (!window.ExcelJS) {
    showError("Le module Excel n’a pas pu être chargé. Recharge la page puis réessaie.");
    return;
  }

  const originalLabel = els.exportExcelButton.textContent;
  els.exportExcelButton.disabled = true;
  els.exportExcelButton.textContent = "Création du fichier…";
  hideError();

  try {
    const workbook = new window.ExcelJS.Workbook();
    workbook.creator = "YouTube Channel Data Viewer";
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet("Vidéos sélectionnées", {
      views: [{ state: "frozen", ySplit: 1 }]
    });
    sheet.columns = columns.map(({ header, key, width }) => ({ header, key, width }));

    for (const video of selectedVideos) {
      const rowData = Object.fromEntries(columns.map((column) => [column.key, column.value(video)]));
      const row = sheet.addRow(rowData);
      for (const column of columns.filter((item) => item.hyperlink)) {
        const linkValue = rowData[column.key];
        if (!linkValue) continue;
        row.getCell(column.key).value = { text: String(linkValue), hyperlink: String(linkValue) };
        row.getCell(column.key).font = { color: { argb: "FF0563C1" }, underline: true };
      }
    }

    sheet.autoFilter = { from: "A1", to: `${excelColumnName(columns.length)}1` };
    sheet.getRow(1).height = 30;
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0033" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFB00022" } } };
    });

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.alignment = { vertical: "top", wrapText: true };
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F8FA" } };
        });
      }
    });
    for (const column of columns.filter((item) => item.numberFormat)) sheet.getColumn(column.key).numFmt = column.numberFormat;

    // Ces deux feuilles recensent toujours toutes les observations saisies pour les vidéos sélectionnées,
    // indépendamment des colonnes optionnelles choisies pour la feuille principale.
    const adExport = addAdExportSheets(workbook, selectedVideos);
    const distinctBrands = new Set(adExport.observationRows.map((row) => canonicalAdValue(row.brand)).filter(Boolean)).size;
    const distinctAdvertisers = new Set(adExport.observationRows.map((row) => canonicalAdValue(row.advertiserCompany)).filter(Boolean)).size;

    const channelSheet = workbook.addWorksheet("Chaîne");
    const criteria = state.loadCriteria || {};
    const channelRows = [
      ["Information", "Valeur"],
      ["Nom de la chaîne", state.channel?.title || ""],
      ["URL", state.channel?.url || ""],
      ["@handle / URL personnalisée", state.channel?.customUrl || ""],
      ["ID chaîne", state.channel?.id || ""],
      ["Abonnés", state.channel?.hiddenSubscriberCount ? "Masqués" : Number(state.channel?.subscriberCount || 0)],
      ["Nombre de vidéos publiques", Number(state.channel?.videoCount || 0)],
      ["Vues de la chaîne", Number(state.channel?.viewCount || 0)],
      ["Création de la chaîne", state.channel?.publishedAt || ""],
      ["Pays", state.channel?.country || ""],
      ["Langue par défaut", state.channel?.defaultLanguage || ""],
      ["Période demandée - début", criteria.startDate || "Sans limite"],
      ["Période demandée - fin", criteria.endDate || "Sans limite"],
      ["Plafond demandé", criteria.maxVideos || "Sans plafond"],
      ["Arrêt du chargement", state.loadStopReason || ""],
      ["Éléments de playlist parcourus", state.playlistItemsRead],
      ["Vidéos chargées", state.videos.length],
      ["Vidéos sélectionnées", selectedVideos.length],
      ["Colonnes exportées", columns.map((column) => column.header).join(" | ")],
      ["Observations pré-roll exportées", adExport.observationRows.length],
      ["Marques distinctes recensées", distinctBrands],
      ["Entreprises annonceuses distinctes recensées", distinctAdvertisers],
      ["Lignes de synthèse annonceurs", adExport.summaryRows.length],
      ["Feuilles pré-roll", "« Observations pré-roll » contient une ligne par test ; « Synthèse annonceurs » recense chaque couple marque / entreprise avec son nombre de présences."],
      ["Observations pré-roll", "Données saisies manuellement par test. Elles ne sont pas fournies automatiquement par YouTube."],
      ["Export généré le", new Date().toISOString()],
      ["Description", state.channel?.description || ""]
    ];
    channelSheet.addRows(channelRows);
    channelSheet.columns = [{ width: 34 }, { width: 90 }];
    channelSheet.views = [{ state: "frozen", ySplit: 1 }];
    channelSheet.getRow(1).height = 28;
    channelSheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0033" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    channelSheet.getColumn(1).font = { bold: true };
    channelSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) row.alignment = { vertical: "top", wrapText: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFilename(state.channel?.title)}-videos-selectionnees-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    showError(error.message || "Impossible de créer le fichier Excel.");
  } finally {
    els.exportExcelButton.textContent = originalLabel;
    updateSelectionUi();
  }
}

els.channelInput.addEventListener("input", () => {
  els.analyzeButton.disabled = state.processing || !els.channelInput.value.trim();
});
els.channelInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") analyzeChannel();
});
els.analyzeButton.addEventListener("click", analyzeChannel);
els.cancelButton.addEventListener("click", () => state.controller?.abort());
els.resetScopeButton.addEventListener("click", () => {
  els.startDateInput.value = "";
  els.endDateInput.value = "";
  els.maxVideosInput.value = "500";
  hideError();
});

let pendingSearchFrame = null;
function scheduleSearch() {
  if (pendingSearchFrame !== null) cancelAnimationFrame(pendingSearchFrame);
  pendingSearchFrame = requestAnimationFrame(() => {
    pendingSearchFrame = null;
    state.currentPage = 1;
    applyFilters();
  });
}

els.searchInput.addEventListener("input", scheduleSearch);
els.searchInput.addEventListener("search", scheduleSearch);
els.searchInput.addEventListener("change", scheduleSearch);
els.searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.searchInput.value) {
    els.searchInput.value = "";
    scheduleSearch();
  }
});
els.sortSelect.addEventListener("change", () => { state.currentPage = 1; applyFilters(); });
els.pageSizeSelect.addEventListener("change", () => {
  state.pageSize = Number(els.pageSizeSelect.value);
  state.currentPage = 1;
  applyFilters();
});
els.prevButton.addEventListener("click", () => {
  state.currentPage -= 1;
  renderPage();
  window.scrollTo({ top: els.resultsSection.offsetTop, behavior: "smooth" });
});
els.nextButton.addEventListener("click", () => {
  state.currentPage += 1;
  renderPage();
  window.scrollTo({ top: els.resultsSection.offsetTop, behavior: "smooth" });
});
els.videoGrid.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-select-id]");
  if (checkbox) setVideoSelected(checkbox.dataset.selectId, checkbox.checked);
});
els.videoGrid.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-detail-id]");
  if (detailButton) openDetails(detailButton.dataset.detailId);
});
els.selectPageButton.addEventListener("click", () => selectVideos(currentPageVideos()));
els.selectFilteredButton.addEventListener("click", () => selectVideos(state.filtered));
els.clearSelectionButton.addEventListener("click", () => {
  state.selectedIds.clear();
  renderPage();
});

els.detailContent.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-ad-form-id]");
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const observation = {
    brand: data.get("brand"),
    advertiserCompany: data.get("advertiserCompany"),
    shown: data.get("shown"),
    observedAt: data.get("observedAt"),
    location: data.get("location"),
    format: data.get("format"),
    evidence: data.get("evidence"),
    notes: data.get("notes"),
    source: "manual",
    confidence: null,
    detectionMethod: "manual",
    landingDomain: "",
    landingUrl: "",
    rawDetectedText: "",
    candidateBrands: [],
    runId: ""
  };
  const hasUsefulValue = [observation.brand, observation.advertiserCompany, observation.location, observation.evidence, observation.notes].some((value) => String(value || "").trim()) || observation.shown !== "unknown";
  const error = form.querySelector("[data-ad-form-error]");
  if (!hasUsefulValue) {
    if (error) error.hidden = false;
    return;
  }
  addAdObservation(form.dataset.adFormId, observation);
  openDetails(form.dataset.adFormId);
});
els.detailContent.addEventListener("input", (event) => {
  const form = event.target.closest("[data-ad-form-id]");
  const error = form?.querySelector("[data-ad-form-error]");
  if (error) error.hidden = true;
});
els.detailContent.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-ad-observation]");
  if (!button) return;
  deleteAdObservation(button.dataset.videoId, button.dataset.deleteAdObservation);
  openDetails(button.dataset.videoId);
});
els.closeDialogButton.addEventListener("click", () => els.detailDialog.close());
els.detailDialog.addEventListener("click", (event) => {
  if (event.target === els.detailDialog) els.detailDialog.close();
});

els.openCollectorButton.addEventListener("click", () => {
  els.collectorMessage.hidden = true;
  els.collectorDialog.showModal();
});
els.closeCollectorDialogButton.addEventListener("click", () => els.collectorDialog.close());
els.collectorDialog.addEventListener("click", (event) => {
  if (event.target === els.collectorDialog) els.collectorDialog.close();
});
els.exportCollectorQueueButton.addEventListener("click", exportCollectorQueue);
els.importCollectorResultsButton.addEventListener("click", () => els.collectorResultsInput.click());
els.collectorResultsInput.addEventListener("change", async () => {
  const file = els.collectorResultsInput.files?.[0];
  if (!file) return;
  try {
    await importCollectorResults(file);
  } catch (error) {
    els.collectorMessage.hidden = false;
    els.collectorMessage.className = "message error";
    els.collectorMessage.textContent = error.message || "Impossible d’importer le fichier.";
  } finally {
    els.collectorResultsInput.value = "";
  }
});

els.chooseColumnsButton.addEventListener("click", () => {
  renderColumnDialog();
  els.columnDialog.showModal();
});
els.columnGroups.addEventListener("change", handleColumnDialogChange);
els.essentialColumnsButton.addEventListener("click", () => setColumnDialogKeys(ESSENTIAL_EXPORT_KEYS));
els.allColumnsButton.addEventListener("click", () => setColumnDialogKeys(EXPORT_COLUMNS.map((column) => column.key)));
els.clearColumnsButton.addEventListener("click", () => setColumnDialogKeys([]));
els.saveColumnsButton.addEventListener("click", saveColumnSelection);
els.cancelColumnsButton.addEventListener("click", closeColumnDialog);
els.closeColumnDialogButton.addEventListener("click", closeColumnDialog);
els.columnDialog.addEventListener("click", (event) => {
  if (event.target === els.columnDialog) closeColumnDialog();
});
els.exportExcelButton.addEventListener("click", exportExcel);

const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
if (savedTheme === "dark") document.documentElement.dataset.theme = "dark";
els.themeButton.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark";
  if (dark) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = "dark";
  localStorage.setItem(STORAGE_KEYS.theme, dark ? "light" : "dark");
});

updateSelectionUi();
