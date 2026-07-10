const state = {
  channel: null,
  videos: [],
  uploadOrder: [],
  missingIds: [],
  filtered: [],
  selectedIds: new Set(),
  currentPage: 1,
  pageSize: 24,
  processing: false,
  controller: null,
  playlistItemsRead: 0,
  quotaEstimate: 0
};

const els = {
  channelInput: document.querySelector("#channelInput"),
  analyzeButton: document.querySelector("#analyzeButton"),
  cancelButton: document.querySelector("#cancelButton"),
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
  sortSelect: document.querySelector("#sortSelect"),
  pageSizeSelect: document.querySelector("#pageSizeSelect"),
  videoGrid: document.querySelector("#videoGrid"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  pageLabel: document.querySelector("#pageLabel"),
  exportExcelButton: document.querySelector("#exportExcelButton"),
  detailDialog: document.querySelector("#detailDialog"),
  detailContent: document.querySelector("#detailContent"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  themeButton: document.querySelector("#themeButton")
};

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
  if (percent === null) {
    percent = total > 0 ? Math.round((done / total) * 100) : 0;
  }
  percent = Math.min(100, Math.max(0, percent));
  els.progressArea.hidden = false;
  els.progressText.textContent = text;
  els.progressPercent.textContent = `${percent} %`;
  els.progressBar.style.width = `${percent}%`;
}

function setProcessing(processing) {
  state.processing = processing;
  els.analyzeButton.disabled = processing || !els.channelInput.value.trim();
  els.channelInput.disabled = processing;
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

function resetResults() {
  state.channel = null;
  state.videos = [];
  state.uploadOrder = [];
  state.missingIds = [];
  state.filtered = [];
  state.selectedIds.clear();
  state.currentPage = 1;
  state.playlistItemsRead = 0;
  state.quotaEstimate = 0;
  els.searchInput.value = "";
  els.sortSelect.value = "upload-order";
  els.resultsSection.hidden = true;
}

async function analyzeChannel() {
  const channelInput = els.channelInput.value.trim();
  if (!channelInput || state.processing) return;

  resetResults();
  hideError();
  state.controller = new AbortController();
  setProcessing(true);
  setProgress(0, 1, "Identification de la chaîne…", 3);

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
      const data = await postJson("/api/channel-videos", {
        playlistId: state.channel.uploadsPlaylistId,
        pageToken
      }, state.controller.signal);

      pageNumber += 1;
      state.quotaEstimate += Number(data.quotaEstimate || 0);
      state.playlistItemsRead += Number(data.playlistItemsRead || 0);
      expected = Math.max(expected, Number(data.pageInfo?.totalResults || 0), state.playlistItemsRead);

      for (const video of data.videos || []) {
        if (seenIds.has(video.id)) continue;
        seenIds.add(video.id);
        video.channel = state.channel;
        state.videos.push(video);
        state.uploadOrder.push(video.id);
      }
      state.missingIds.push(...(data.notFoundIds || []));

      pageToken = data.nextPageToken || "";
      const done = state.playlistItemsRead;
      const percent = pageToken && expected > 0 ? Math.min(99, Math.round((done / expected) * 100)) : 100;
      setProgress(done, expected || done, `${formatFullNumber(state.videos.length)} vidéos récupérées · lot ${pageNumber}`, percent);

      if (pageNumber === 1 || pageNumber % 4 === 0 || !pageToken) {
        updateResults();
      }
    } while (pageToken);

    updateResults();
    setProgress(state.playlistItemsRead, Math.max(expected, state.playlistItemsRead), `${formatFullNumber(state.videos.length)} vidéos publiques chargées`, 100);
    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (error.name === "AbortError") {
      if (state.videos.length) {
        updateResults();
        setProgress(state.playlistItemsRead, Math.max(state.playlistItemsRead, Number(state.channel?.videoCount || 0)), `Chargement arrêté · ${formatFullNumber(state.videos.length)} vidéos conservées`, null);
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

function updateResults() {
  const totalViews = state.videos.reduce((sum, video) => sum + Number(video.viewCount || 0), 0);
  const totalLikes = state.videos.reduce((sum, video) => sum + Number(video.likeCount || 0), 0);

  els.summaryFound.textContent = formatFullNumber(state.videos.length);
  els.summaryViews.textContent = formatNumber(totalViews);
  els.summaryLikes.textContent = formatNumber(totalLikes);
  els.loadSummary.textContent = `${formatFullNumber(state.videos.length)} vidéo${state.videos.length > 1 ? "s" : ""} disponible${state.videos.length > 1 ? "s" : ""} · environ ${formatFullNumber(state.quotaEstimate)} unité${state.quotaEstimate > 1 ? "s" : ""} de quota utilisée${state.quotaEstimate > 1 ? "s" : ""}`;

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
  const query = els.searchInput.value.trim().toLowerCase();
  const sort = els.sortSelect.value;
  const uploadOrder = new Map(state.uploadOrder.map((id, index) => [id, index]));

  state.filtered = state.videos.filter((video) => {
    if (!query) return true;
    return [video.id, video.title, video.description, ...(video.tags || [])]
      .some((value) => String(value || "").toLowerCase().includes(query));
  });

  if (sort === "views-desc") state.filtered.sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0));
  if (sort === "likes-desc") state.filtered.sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0));
  if (sort === "date-desc") state.filtered.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  if (sort === "date-asc") state.filtered.sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));
  if (sort === "upload-order") state.filtered.sort((a, b) => (uploadOrder.get(a.id) ?? 0) - (uploadOrder.get(b.id) ?? 0));

  const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.currentPage = Math.min(state.currentPage, totalPages);
  renderPage();
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
    els.videoGrid.innerHTML = `<div class="message empty-message">Aucune vidéo ne correspond à la recherche.</div>`;
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
  els.exportExcelButton.disabled = count === 0;
  els.clearSelectionButton.disabled = count === 0;
  els.selectPageButton.disabled = currentPageVideos().length === 0;
  els.selectFilteredButton.disabled = state.filtered.length === 0;
  document.querySelector(".selection-status").lastChild.textContent = ` vidéo${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`;
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
  const utc = video.publishedAt ? new Date(video.publishedAt).toISOString() : "—";

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

function yesNo(value) {
  if (value === null || value === undefined) return "Non précisé";
  return value ? "Oui" : "Non";
}

function sanitizeFilename(value) {
  return String(value || "chaine-youtube")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "chaine-youtube";
}

async function exportExcel() {
  const selectedVideos = state.videos.filter((video) => state.selectedIds.has(video.id));
  if (!selectedVideos.length) return;
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

    sheet.columns = [
      { header: "Titre", key: "title", width: 44 },
      { header: "URL YouTube", key: "url", width: 34 },
      { header: "ID vidéo", key: "id", width: 16 },
      { header: "Chaîne", key: "channelTitle", width: 26 },
      { header: "ID chaîne", key: "channelId", width: 27 },
      { header: "Publication ISO 8601 (UTC)", key: "publishedAt", width: 27 },
      { header: "Date UTC", key: "dateUtc", width: 13 },
      { header: "Heure exacte UTC", key: "timeUtc", width: 17 },
      { header: "Date et heure de Paris", key: "parisTime", width: 23 },
      { header: "Vues", key: "views", width: 15 },
      { header: "Likes", key: "likes", width: 15 },
      { header: "Commentaires", key: "comments", width: 15 },
      { header: "Taux d’engagement", key: "engagement", width: 18 },
      { header: "Durée", key: "durationReadable", width: 12 },
      { header: "Durée en secondes", key: "durationSeconds", width: 19 },
      { header: "Durée ISO", key: "durationIso", width: 13 },
      { header: "Statut live", key: "liveStatus", width: 15 },
      { header: "Définition", key: "definition", width: 12 },
      { header: "Sous-titres", key: "captions", width: 13 },
      { header: "ID catégorie", key: "categoryId", width: 14 },
      { header: "Langue", key: "language", width: 12 },
      { header: "Langue audio", key: "audioLanguage", width: 16 },
      { header: "Tags", key: "tags", width: 45 },
      { header: "Description", key: "description", width: 70 },
      { header: "URL miniature", key: "thumbnail", width: 34 },
      { header: "Intégrable", key: "embeddable", width: 12 },
      { header: "Destinée aux enfants", key: "madeForKids", width: 22 },
      { header: "Licence", key: "license", width: 13 },
      { header: "Pays bloqués", key: "blockedRegions", width: 30 },
      { header: "Pays autorisés", key: "allowedRegions", width: 30 }
    ];

    for (const video of selectedVideos) {
      const date = video.publishedAt ? new Date(video.publishedAt) : null;
      const iso = date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
      const row = sheet.addRow({
        title: video.title,
        url: video.url,
        id: video.id,
        channelTitle: video.channelTitle,
        channelId: video.channelId,
        publishedAt: iso,
        dateUtc: iso ? iso.slice(0, 10) : "",
        timeUtc: iso ? iso.slice(11, 19) : "",
        parisTime: formatDateInTimeZone(video.publishedAt, "Europe/Paris"),
        views: Number(video.viewCount || 0),
        likes: video.likeCount === null || video.likeCount === undefined ? null : Number(video.likeCount),
        comments: video.commentCount === null || video.commentCount === undefined ? null : Number(video.commentCount),
        engagement: engagement(video),
        durationReadable: isoDurationToClock(video.duration),
        durationSeconds: isoDurationToSeconds(video.duration),
        durationIso: video.duration,
        liveStatus: video.liveBroadcastContent,
        definition: String(video.definition || "").toUpperCase(),
        captions: video.caption === "true" ? "Oui" : "Non",
        categoryId: video.categoryId,
        language: video.defaultLanguage,
        audioLanguage: video.defaultAudioLanguage,
        tags: (video.tags || []).join(" | "),
        description: video.description,
        thumbnail: video.thumbnail,
        embeddable: yesNo(video.embeddable),
        madeForKids: yesNo(video.madeForKids),
        license: video.license,
        blockedRegions: video.regionRestriction?.blocked?.join(" | ") || "",
        allowedRegions: video.regionRestriction?.allowed?.join(" | ") || ""
      });

      row.getCell("url").value = { text: video.url, hyperlink: video.url };
      row.getCell("url").font = { color: { argb: "FF0563C1" }, underline: true };
      row.getCell("thumbnail").value = video.thumbnail ? { text: video.thumbnail, hyperlink: video.thumbnail } : "";
      if (video.thumbnail) row.getCell("thumbnail").font = { color: { argb: "FF0563C1" }, underline: true };
    }

    sheet.autoFilter = { from: "A1", to: "AD1" };
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
    sheet.getColumn("views").numFmt = "#,##0";
    sheet.getColumn("likes").numFmt = "#,##0";
    sheet.getColumn("comments").numFmt = "#,##0";
    sheet.getColumn("durationSeconds").numFmt = "#,##0";
    sheet.getColumn("engagement").numFmt = "0.00%";

    const channelSheet = workbook.addWorksheet("Chaîne");
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
      ["Vidéos sélectionnées", selectedVideos.length],
      ["Export généré le", new Date().toISOString()],
      ["Description", state.channel?.description || ""]
    ];
    channelSheet.addRows(channelRows);
    channelSheet.columns = [{ width: 31 }, { width: 85 }];
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
els.searchInput.addEventListener("input", () => { state.currentPage = 1; applyFilters(); });
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
els.exportExcelButton.addEventListener("click", exportExcel);
els.closeDialogButton.addEventListener("click", () => els.detailDialog.close());
els.detailDialog.addEventListener("click", (event) => {
  const rect = els.detailDialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) els.detailDialog.close();
});
els.themeButton.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("yt-channel-theme", next);
});

const savedTheme = localStorage.getItem("yt-channel-theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
els.analyzeButton.disabled = true;
