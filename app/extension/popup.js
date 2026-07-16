const els = {
  queueFile: document.querySelector("#queueFile"),
  queueSummary: document.querySelector("#queueSummary"),
  detectTimeout: document.querySelector("#detectTimeout"),
  betweenVideos: document.querySelector("#betweenVideos"),
  location: document.querySelector("#location"),
  saveScreenshots: document.querySelector("#saveScreenshots"),
  closeTabs: document.querySelector("#closeTabs"),
  status: document.querySelector("#status"),
  progressBar: document.querySelector("#progressBar"),
  progressLabel: document.querySelector("#progressLabel"),
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  resumeButton: document.querySelector("#resumeButton"),
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

function render(state) {
  currentState = state;
  const total = state.queue?.length || 0;
  const completed = state.results?.length || 0;
  const current = Math.min(total, state.currentIndex + (state.running ? 1 : 0));
  els.queueSummary.textContent = total ? `${total} vidéo${total > 1 ? "s" : ""} dans la file` : "Aucune vidéo chargée";
  els.status.textContent = state.lastError ? `${state.status} — ${state.lastError}` : state.status;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  els.progressBar.style.width = `${percent}%`;
  els.progressLabel.textContent = `${completed} terminé${completed > 1 ? "s" : ""} / ${total}${state.running ? ` · test ${current}` : ""}`;
  els.startButton.disabled = !total || state.running;
  els.pauseButton.disabled = !state.running;
  els.resumeButton.disabled = !state.paused;
  els.exportButton.disabled = !completed;
  els.clearButton.disabled = !completed || state.running;

  els.detectTimeout.value = state.settings?.detectTimeoutSeconds ?? 18;
  els.betweenVideos.value = state.settings?.betweenVideosSeconds ?? 2;
  els.location.value = state.settings?.location ?? "France";
  els.saveScreenshots.checked = state.settings?.saveScreenshots !== false;
  els.closeTabs.checked = state.settings?.closeCollectionTab !== false;

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
      <div class="result-meta">${escapeHtml(row.landingDomain || row.detectionMethod || "")}${row.evidence ? ` · capture : ${escapeHtml(row.evidence)}` : ""}</div>
    </article>`;
  }).join("") : '<div class="empty">Les résultats apparaîtront ici.</div>';
}

async function saveSettings() {
  return send({
    type: "YT_PREROLL_SET_SETTINGS",
    settings: {
      detectTimeoutSeconds: Number(els.detectTimeout.value || 18),
      betweenVideosSeconds: Number(els.betweenVideos.value || 2),
      location: els.location.value.trim(),
      saveScreenshots: els.saveScreenshots.checked,
      closeCollectionTab: els.closeTabs.checked
    }
  });
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
    const state = await send({ type: "YT_PREROLL_SET_QUEUE", queue: cleanQueue });
    render(state);
  } catch (error) {
    els.queueSummary.textContent = `Erreur : ${error.message}`;
  } finally {
    els.queueFile.value = "";
  }
});

els.startButton.addEventListener("click", async () => {
  try {
    await saveSettings();
    render(await send({ type: "YT_PREROLL_START" }));
  } catch (error) { els.status.textContent = error.message; }
});
els.pauseButton.addEventListener("click", async () => render(await send({ type: "YT_PREROLL_PAUSE" })));
els.resumeButton.addEventListener("click", async () => {
  await saveSettings();
  render(await send({ type: "YT_PREROLL_RESUME" }));
});
els.clearButton.addEventListener("click", async () => render(await send({ type: "YT_PREROLL_CLEAR_RESULTS" })));

for (const input of [els.detectTimeout, els.betweenVideos, els.location, els.saveScreenshots, els.closeTabs]) {
  input.addEventListener("change", () => saveSettings().then(render).catch(() => {}));
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
    schema: "yt-preroll-collector-results-v1",
    exportedAt: new Date().toISOString(),
    runId: state.runId,
    settings: state.settings,
    observations: state.results
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename: `YT-PreRoll-Collector/resultats-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "YT_PREROLL_STATE") render(message.state);
});

send({ type: "YT_PREROLL_GET_STATE" }).then(render).catch((error) => { els.status.textContent = error.message; });
