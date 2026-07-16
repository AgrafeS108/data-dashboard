const els = {
  queueFile: document.querySelector("#queueFile"),
  queueSummary: document.querySelector("#queueSummary"),
  sessionMode: document.querySelector("#sessionMode"),
  incognitoPanel: document.querySelector("#incognitoPanel"),
  incognitoStatus: document.querySelector("#incognitoStatus"),
  openExtensionSettingsButton: document.querySelector("#openExtensionSettingsButton"),
  collectorMode: document.querySelector("#collectorMode"),
  detectTimeout: document.querySelector("#detectTimeout"),
  betweenVideos: document.querySelector("#betweenVideos"),
  location: document.querySelector("#location"),
  mutePlayback: document.querySelector("#mutePlayback"),
  saveScreenshots: document.querySelector("#saveScreenshots"),
  closeWindow: document.querySelector("#closeWindow"),
  status: document.querySelector("#status"),
  pageStatus: document.querySelector("#pageStatus"),
  currentUrl: document.querySelector("#currentUrl"),
  logs: document.querySelector("#logs"),
  progressBar: document.querySelector("#progressBar"),
  progressLabel: document.querySelector("#progressLabel"),
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  resumeButton: document.querySelector("#resumeButton"),
  openCollectorButton: document.querySelector("#openCollectorButton"),
  results: document.querySelector("#results"),
  resultCount: document.querySelector("#resultCount"),
  exportButton: document.querySelector("#exportButton"),
  clearButton: document.querySelector("#clearButton")
};

let currentState = null;

async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
  return response;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" })[char]);
}

function confidenceLabel(value) {
  const percent = Math.round(Number(value || 0) * 100);
  if (percent >= 80) return { text: `${percent}%`, className: "good" };
  return { text: `${percent}%`, className: "warn" };
}

function renderIncognito(state) {
  const privateMode = (state.settings?.sessionMode || "incognito-tabs") === "incognito-tabs";
  els.incognitoPanel.hidden = !privateMode;
  els.incognitoPanel.classList.toggle("allowed", state.incognitoAllowed === true);
  els.incognitoPanel.classList.toggle("blocked", state.incognitoAllowed === false);

  if (!privateMode) {
    els.incognitoStatus.textContent = "Mode standard sélectionné";
    return;
  }
  if (state.incognitoAllowed === true) {
    els.incognitoStatus.textContent = "Accès navigation privée autorisé";
  } else if (state.incognitoAllowed === false) {
    els.incognitoStatus.textContent = "Accès navigation privée non autorisé";
  } else {
    els.incognitoStatus.textContent = "Vérification de l’accès privé…";
  }
}

function render(state) {
  currentState = state;
  const total = state.queue?.length || 0;
  const completed = state.results?.length || 0;
  const current = Math.min(total, state.currentIndex + (state.running ? 1 : 0));
  const privateMode = (state.settings?.sessionMode || "incognito-tabs") === "incognito-tabs";
  const privateBlocked = privateMode && state.incognitoAllowed === false;

  els.queueSummary.textContent = total ? `${total} vidéo${total > 1 ? "s" : ""} dans la file` : "Aucune vidéo chargée";
  els.status.textContent = state.lastError ? `${state.status} — ${state.lastError}` : state.status;
  els.pageStatus.textContent = state.pageStatus || (state.currentWindowId ? "Fenêtre ouverte" : "Aucune page de collecte ouverte");
  els.currentUrl.textContent = state.currentUrl || "";
  const percent = total ? Math.round((completed / total) * 100) : 0;
  els.progressBar.style.width = `${percent}%`;
  els.progressLabel.textContent = `${completed} terminé${completed > 1 ? "s" : ""} / ${total}${state.running ? ` · test ${current}` : ""}`;
  els.startButton.disabled = !total || state.running || privateBlocked;
  els.pauseButton.disabled = !state.running;
  els.resumeButton.disabled = !state.paused || privateBlocked;
  els.openCollectorButton.disabled = !state.currentWindowId && !total;
  els.exportButton.disabled = !completed;
  els.clearButton.disabled = !completed || state.running;

  els.sessionMode.value = state.settings?.sessionMode || "incognito-tabs";
  els.collectorMode.value = state.settings?.collectorMode || "background";
  els.detectTimeout.value = state.settings?.detectTimeoutSeconds ?? 30;
  els.betweenVideos.value = state.settings?.betweenVideosSeconds ?? 2;
  els.location.value = state.settings?.location ?? "France";
  els.mutePlayback.checked = state.settings?.mutePlayback !== false;
  els.saveScreenshots.checked = state.settings?.saveScreenshots !== false;
  els.closeWindow.checked = state.settings?.closeCollectionWindow !== false;
  renderIncognito(state);

  els.logs.innerHTML = (state.logs || []).slice(-12).reverse().map((entry) =>
    `<div class="log ${escapeHtml(entry.level)}">${escapeHtml(new Date(entry.at).toLocaleTimeString("fr-FR"))} — ${escapeHtml(entry.message)}</div>`
  ).join("") || '<div class="log">Aucun événement enregistré.</div>';

  els.resultCount.textContent = String(completed);
  els.results.innerHTML = completed ? state.results.slice().reverse().map((row) => {
    const confidence = confidenceLabel(row.confidence);
    return `<article class="result" data-result-id="${escapeHtml(row.id)}">
      <div class="result-head">
        <div class="result-title">${escapeHtml(row.videoTitle || row.videoId)}</div>
        <span class="badge ${confidence.className}">${row.shown === "no" ? "Aucune pub" : confidence.text}</span>
      </div>
      <div class="result-grid">
        <label><span>Marque</span><input data-field="brand" value="${escapeHtml(row.brand)}" /></label>
        <label><span>Entreprise</span><input data-field="advertiserCompany" value="${escapeHtml(row.advertiserCompany)}" /></label>
      </div>
      <div class="result-meta">${escapeHtml(row.browsingContext || "")}${row.landingDomain ? ` · ${escapeHtml(row.landingDomain)}` : ""}${row.evidence ? ` · capture : ${escapeHtml(row.evidence)}` : ""}</div>
    </article>`;
  }).join("") : '<div class="empty">Les résultats apparaîtront ici après l’ouverture réelle des vidéos.</div>';
}

async function saveSettings() {
  return send({
    type: "YT_PREROLL_SET_SETTINGS",
    settings: {
      sessionMode: els.sessionMode.value,
      collectorMode: els.collectorMode.value,
      detectTimeoutSeconds: Number(els.detectTimeout.value || 30),
      betweenVideosSeconds: Number(els.betweenVideos.value || 2),
      location: els.location.value.trim(),
      mutePlayback: els.mutePlayback.checked,
      saveScreenshots: els.saveScreenshots.checked,
      closeCollectionWindow: els.closeWindow.checked
    }
  });
}

async function refreshIncognitoStatus() {
  try {
    render(await send({ type: "YT_PREROLL_CHECK_INCOGNITO" }));
  } catch (error) {
    els.incognitoStatus.textContent = error.message;
  }
}

els.queueFile.addEventListener("change", async () => {
  const file = els.queueFile.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const queue = Array.isArray(parsed) ? parsed : parsed.videos;
    if (!Array.isArray(queue)) throw new Error("Le fichier ne contient pas de liste de vidéos.");
    const cleanQueue = queue.map((item) => ({
      videoId: String(item.videoId || item.id || "").trim(),
      title: String(item.title || "").trim(),
      url: String(item.url || (item.videoId || item.id ? `https://www.youtube.com/watch?v=${item.videoId || item.id}` : "")).trim()
    })).filter((item) => item.videoId && item.url);
    if (!cleanQueue.length) throw new Error("Aucune URL YouTube exploitable n’a été trouvée.");
    render(await send({ type: "YT_PREROLL_SET_QUEUE", queue: cleanQueue }));
  } catch (error) {
    els.queueSummary.textContent = `Erreur : ${error.message}`;
  } finally {
    els.queueFile.value = "";
  }
});

els.startButton.addEventListener("click", async () => {
  try {
    els.status.textContent = "Ouverture de la fenêtre YouTube…";
    await saveSettings();
    render(await send({ type: "YT_PREROLL_START" }));
  } catch (error) { els.status.textContent = error.message; }
});
els.pauseButton.addEventListener("click", async () => render(await send({ type: "YT_PREROLL_PAUSE" })));
els.resumeButton.addEventListener("click", async () => {
  await saveSettings();
  render(await send({ type: "YT_PREROLL_RESUME" }));
});
els.openCollectorButton.addEventListener("click", async () => {
  try { render(await send({ type: "YT_PREROLL_OPEN_COLLECTOR" })); }
  catch (error) { els.status.textContent = error.message; }
});
els.clearButton.addEventListener("click", async () => render(await send({ type: "YT_PREROLL_CLEAR_RESULTS" })));

els.openExtensionSettingsButton.addEventListener("click", async () => {
  const response = await send({ type: "YT_PREROLL_OPEN_EXTENSION_SETTINGS" });
  if (!response?.ok) els.status.textContent = `Ouvre chrome://extensions/?id=${chrome.runtime.id}`;
});

for (const input of [els.sessionMode, els.collectorMode, els.detectTimeout, els.betweenVideos, els.location, els.mutePlayback, els.saveScreenshots, els.closeWindow]) {
  input.addEventListener("change", async () => {
    try {
      render(await saveSettings());
      if (input === els.sessionMode) await refreshIncognitoStatus();
    } catch {}
  });
}

els.results.addEventListener("change", async (event) => {
  const input = event.target.closest("[data-field]");
  const card = event.target.closest("[data-result-id]");
  if (!input || !card || !currentState) return;
  const result = currentState.results.find((row) => row.id === card.dataset.resultId);
  if (!result) return;
  const updated = { ...result, [input.dataset.field]: input.value.trim(), confidence: input.dataset.field === "brand" ? 1 : result.confidence, detectionMethod: `${result.detectionMethod || "automatic"}+manual-validation` };
  render(await send({ type: "YT_PREROLL_UPDATE_RESULT", result: updated }));
});

els.exportButton.addEventListener("click", async () => {
  const state = await send({ type: "YT_PREROLL_GET_STATE" });
  const payload = {
    schema: "yt-preroll-collector-results-v4",
    exportedAt: new Date().toISOString(),
    runId: state.runId,
    extensionVersion: state.version,
    settings: state.settings,
    observations: state.results
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename: `YT-PreRoll-Collector/RESULTATS-PREROLL-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "YT_PREROLL_STATE") render(message.state);
});

send({ type: "YT_PREROLL_GET_STATE" })
  .then(render)
  .then(refreshIncognitoStatus)
  .catch((error) => { els.status.textContent = error.message; });
