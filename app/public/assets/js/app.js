import { buildVideoSearchIndex, matchesVideoSearch, parseSearchQuery } from "./search.js";

const STORAGE_KEYS = {
  theme: "yt-channel-viewer-theme",
  exportColumns: "yt-channel-viewer-export-columns-v4",
  advertisers: "yt-channel-viewer-advertisers-v1"
};

const ESSENTIAL_EXPORT_KEYS = [
  "title", "url", "publishedAt", "dateUtc", "timeUtc", "parisTime",
  "views", "likes", "comments", "durationReadable", "durationSeconds",
  "tags", "description", "advertiser"
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
  { group: "Publication", header: "Date et heure de Paris", key: "parisTime", width: 23, value: (video) => formatDateInTimeZone(video.publishedAt, "Europe/Paris") },
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

  { group: "Publicité", header: "Annonceur pré-roll (saisie manuelle)", key: "advertiser", width: 34, value: (video) => getAdvertiser(video.id) }
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
  advertisers: loadAdvertisers(),
  exportColumnKeys: loadExportColumns()
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

function loadExportColumns() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.exportColumns) || "null");
    const validKeys = new Set(EXPORT_COLUMNS.map((column) => column.key));
    if (Array.isArray(stored)) {
      const filtered = stored.filter((key) => validKeys.has(key));
      if (filtered.length) return new Set(filtered);
    }
  } catch {
    // Ignore une préférence locale corrompue.
  }
  return new Set(EXPORT_COLUMNS.map((column) => column.key));
}

function loadAdvertisers() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.advertisers) || "{}");
    return new Map(Object.entries(stored).filter(([, value]) => typeof value === "string" && value.trim()));
  } catch {
    return new Map();
  }
}

function persistAdvertisers() {
  localStorage.setItem(STORAGE_KEYS.advertisers, JSON.stringify(Object.fromEntries(state.advertisers)));
}

function getAdvertiser(videoId) {
  return state.advertisers.get(String(videoId || "")) || "";
}

function setAdvertiser(videoId, value) {
  const id = String(videoId || "");
  const clean = String(value || "").trim();
  if (!id) return;
  if (clean) state.advertisers.set(id, clean);
  else state.advertisers.delete(id);
  const video = state.videos.find((item) => item.id === id);
  if (video) {
    video.advertiser = clean;
    state.searchIndex.set(id, buildVideoSearchIndex(video));
  }
  persistAdvertisers();
  applyFilters();
}

function validIso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
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
        video.advertiser = getAdvertiser(video.id);
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
    const advertiser = getAdvertiser(video.id);
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
          ${advertiser ? `<div class="advertiser-badge">Pré-roll : ${escapeHtml(advertiser)}</div>` : ""}
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

      <section class="detail-section full advertiser-editor">
        <h3>Entreprise annonceuse en pré-roll</h3>
        <p>Cette information n’est pas exposée par l’API YouTube et l’annonce peut changer selon le spectateur. Tu peux saisir ici l’annonceur observé ; il sera mémorisé dans ce navigateur et exportable dans Excel.</p>
        <label>
          <span>Annonceur observé</span>
          <input type="text" data-advertiser-id="${escapeHtml(video.id)}" value="${escapeHtml(getAdvertiser(video.id))}" placeholder="Ex. Renault, Nike, Orange…" />
        </label>
      </section>

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

  els.detailDialog.showModal();
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

function selectedExportColumns() {
  return EXPORT_COLUMNS.filter((column) => state.exportColumnKeys.has(column.key));
}

function renderColumnDialog() {
  const groups = new Map();
  for (const column of EXPORT_COLUMNS) {
    if (!groups.has(column.group)) groups.set(column.group, []);
    groups.get(column.group).push(column);
  }

  els.columnGroups.innerHTML = [...groups.entries()].map(([group, columns]) => `
    <fieldset class="column-group">
      <legend>${escapeHtml(group)}</legend>
      <div class="column-options">
        ${columns.map((column) => `
          <label class="column-option">
            <input type="checkbox" data-column-key="${escapeHtml(column.key)}" ${state.exportColumnKeys.has(column.key) ? "checked" : ""} />
            <span>${escapeHtml(column.header)}</span>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `).join("");
  updateColumnDialogCount();
  els.columnError.hidden = true;
}

function columnDialogCheckedKeys() {
  return new Set([...els.columnGroups.querySelectorAll("[data-column-key]:checked")].map((input) => input.dataset.columnKey));
}

function setColumnDialogKeys(keys) {
  const selected = new Set(keys);
  for (const input of els.columnGroups.querySelectorAll("[data-column-key]")) input.checked = selected.has(input.dataset.columnKey);
  updateColumnDialogCount();
}

function updateColumnDialogCount() {
  const count = columnDialogCheckedKeys().size;
  els.columnCountLabel.textContent = `${count} colonne${count > 1 ? "s" : ""}`;
}

function saveColumnSelection() {
  const keys = columnDialogCheckedKeys();
  if (!keys.size) {
    els.columnError.hidden = false;
    return;
  }
  state.exportColumnKeys = keys;
  localStorage.setItem(STORAGE_KEYS.exportColumns, JSON.stringify([...keys]));
  els.columnError.hidden = true;
  els.columnDialog.close();
  updateSelectionUi();
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
      ["Annonceur pré-roll", "Non disponible automatiquement via l’API YouTube ; valeurs éventuellement saisies manuellement dans l’application."],
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

els.detailContent.addEventListener("change", (event) => {
  const input = event.target.closest("[data-advertiser-id]");
  if (input) setAdvertiser(input.dataset.advertiserId, input.value);
});
els.detailContent.addEventListener("keydown", (event) => {
  const input = event.target.closest("[data-advertiser-id]");
  if (input && event.key === "Enter") {
    event.preventDefault();
    setAdvertiser(input.dataset.advertiserId, input.value);
    input.blur();
  }
});
els.closeDialogButton.addEventListener("click", () => els.detailDialog.close());
els.detailDialog.addEventListener("click", (event) => {
  if (event.target === els.detailDialog) els.detailDialog.close();
});

els.chooseColumnsButton.addEventListener("click", () => {
  renderColumnDialog();
  els.columnDialog.showModal();
});
els.columnGroups.addEventListener("change", updateColumnDialogCount);
els.essentialColumnsButton.addEventListener("click", () => setColumnDialogKeys(ESSENTIAL_EXPORT_KEYS));
els.allColumnsButton.addEventListener("click", () => setColumnDialogKeys(EXPORT_COLUMNS.map((column) => column.key)));
els.clearColumnsButton.addEventListener("click", () => setColumnDialogKeys([]));
els.saveColumnsButton.addEventListener("click", saveColumnSelection);
els.cancelColumnsButton.addEventListener("click", () => els.columnDialog.close());
els.closeColumnDialogButton.addEventListener("click", () => els.columnDialog.close());
els.columnDialog.addEventListener("click", (event) => {
  if (event.target === els.columnDialog) els.columnDialog.close();
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
