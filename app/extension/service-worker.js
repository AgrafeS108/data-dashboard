importScripts("shared.js");

const shared = globalThis.YTPreRollShared;
const STORAGE_KEY = "ytPreRollCollectorStateV1";
const ALARM_NAME = "yt-preroll-collector-watchdog";
const DEFAULT_SETTINGS = {
  detectTimeoutSeconds: 18,
  captureDelaySeconds: 3,
  betweenVideosSeconds: 2,
  saveScreenshots: true,
  closeCollectionTab: true,
  location: "France"
};

function defaultState() {
  return {
    queue: [],
    results: [],
    settings: { ...DEFAULT_SETTINGS },
    running: false,
    paused: false,
    currentIndex: 0,
    currentTabId: null,
    currentWindowId: null,
    runId: "",
    startedAt: "",
    currentStartedAt: "",
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    screenshotEvidence: "",
    finishing: false,
    status: "Prêt",
    lastError: ""
  };
}

async function getState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...defaultState(), ...(stored[STORAGE_KEY] || {}), settings: { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY]?.settings || {}) } };
}

async function setState(patch) {
  const current = await getState();
  const next = { ...current, ...patch, settings: { ...current.settings, ...(patch.settings || {}) } };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  chrome.runtime.sendMessage({ type: "YT_PREROLL_STATE", state: next }).catch(() => {});
  return next;
}

function scoreSnapshot(snapshot) {
  if (!snapshot) return -1;
  let score = 0;
  if (snapshot.adShowing) score += 5;
  if (snapshot.brand) score += 5;
  if (snapshot.advertiserCompany) score += 2;
  if (snapshot.landingDomain) score += 4;
  if (snapshot.visibleText) score += Math.min(3, snapshot.visibleText.length / 80);
  score += Number(snapshot.confidence || 0) * 4;
  return score;
}

async function captureEvidence(state, queueItem) {
  if (!state.settings.saveScreenshots || !state.currentWindowId) return { state, evidence: state.screenshotEvidence || "" };
  if (state.screenshotCaptured) return { state, evidence: state.screenshotEvidence || "" };
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(state.currentWindowId, { format: "jpeg", quality: 85 });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeTitle = String(queueItem.title || queueItem.videoId || "video")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "video";
    const filename = `YT-PreRoll-Collector/${safeTitle}-${timestamp}.jpg`;
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false, conflictAction: "uniquify" });
    const next = await setState({ screenshotCaptured: true, screenshotEvidence: filename });
    return { state: next, evidence: filename };
  } catch (error) {
    return { state, evidence: "", error: error?.message || String(error) };
  }
}

function buildObservation(state, queueItem, screenshotEvidence = "") {
  const snapshot = state.bestSnapshot || {};
  const observedAt = snapshot.collectedAt || new Date().toISOString();
  const shown = state.adEverSeen ? "yes" : "no";
  const confidence = shown === "yes" ? Number(snapshot.confidence || 0) : 1;
  const notes = [
    snapshot.visibleText ? `Texte détecté : ${snapshot.visibleText.slice(0, 1000)}` : "",
    snapshot.candidateLines?.length ? `Candidats : ${snapshot.candidateLines.join(" | ")}` : "",
    shown === "no" ? "Aucune publicité détectée pendant la fenêtre de test." : "Observation collectée automatiquement par l’extension Chrome.",
    "La marque reste une estimation à valider lorsque le score de confiance est faible."
  ].filter(Boolean).join("\n");

  return {
    id: shared.buildObservationId(state.runId, queueItem.videoId, observedAt),
    collectorObservationId: shared.buildObservationId(state.runId, queueItem.videoId, observedAt),
    videoId: queueItem.videoId,
    videoTitle: queueItem.title || snapshot.title || "",
    videoUrl: queueItem.url,
    brand: shown === "yes" ? (snapshot.brand || "") : "",
    advertiserCompany: shown === "yes" ? (snapshot.advertiserCompany || snapshot.brand || "") : "",
    shown,
    observedAt,
    location: state.settings.location || "",
    format: shown === "yes" ? (snapshot.format || "unknown") : "unknown",
    evidence: screenshotEvidence,
    notes,
    source: "chrome-extension",
    confidence,
    detectionMethod: shown === "yes" ? (snapshot.detectionMethod || "unknown") : "no-ad-detected",
    landingDomain: snapshot.landingDomain || "",
    landingUrl: snapshot.landingUrl || "",
    rawDetectedText: snapshot.visibleText || "",
    candidateBrands: Array.isArray(snapshot.candidateLines) ? snapshot.candidateLines : [],
    runId: state.runId
  };
}

async function closeCurrentTab(state) {
  if (!state.currentTabId) return;
  try {
    if (state.settings.closeCollectionTab) await chrome.tabs.remove(state.currentTabId);
  } catch {}
}

async function finishCurrent(reason = "timeout") {
  let state = await getState();
  if (!state.running || state.paused || state.finishing) return;
  state = await setState({ finishing: true });
  const item = state.queue[state.currentIndex];
  if (!item) return finishRun();

  let evidence = "";
  if (state.adEverSeen) {
    const capture = await captureEvidence(state, item);
    state = capture.state;
    evidence = capture.evidence || "";
  }

  const observation = buildObservation(state, item, evidence || state.screenshotEvidence || "");
  const results = [...state.results.filter((row) => row.videoId !== item.videoId || row.runId !== state.runId), observation];
  await setState({ currentTabId: null, currentWindowId: null });
  await closeCurrentTab(state);

  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.queue.length) {
    await setState({
      results,
      currentIndex: nextIndex,
      currentTabId: null,
      currentWindowId: null,
      status: `Terminé : ${results.length} observation${results.length > 1 ? "s" : ""}`
    });
    await finishRun();
    return;
  }

  await setState({
    results,
    currentIndex: nextIndex,
    currentTabId: null,
    currentWindowId: null,
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    status: `Vidéo ${nextIndex}/${state.queue.length} terminée (${reason})`
  });

  setTimeout(() => processCurrent(), Math.max(0, Number(state.settings.betweenVideosSeconds || 0)) * 1000);
}

async function finishRun() {
  await chrome.alarms.clear(ALARM_NAME);
  const state = await getState();
  await setState({
    running: false,
    paused: false,
    currentTabId: null,
    currentWindowId: null,
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    screenshotEvidence: "",
    finishing: false,
    status: state.results.length ? `Collecte terminée : ${state.results.length} résultat${state.results.length > 1 ? "s" : ""}` : "Collecte terminée"
  });
}

async function processCurrent() {
  let state = await getState();
  if (!state.running || state.paused) return;
  const item = state.queue[state.currentIndex];
  if (!item) return finishRun();

  const url = new URL(item.url || `https://www.youtube.com/watch?v=${item.videoId}`);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("yt_collector", state.runId || "1");

  let tab;
  try {
    tab = await chrome.tabs.create({ url: url.toString(), active: true });
    await setState({
      currentTabId: tab.id,
      currentWindowId: tab.windowId,
      currentStartedAt: new Date().toISOString(),
      bestSnapshot: null,
      adEverSeen: false,
      screenshotCaptured: false,
      screenshotEvidence: "",
      finishing: false,
      status: `Test ${state.currentIndex + 1}/${state.queue.length} : ${item.title || item.videoId}`,
      lastError: ""
    });
    await chrome.alarms.create(ALARM_NAME, { delayInMinutes: Math.max(1, Math.ceil((Number(state.settings.detectTimeoutSeconds || 18) + 12) / 60)) });
  } catch (error) {
    await setState({ lastError: error?.message || String(error) });
    await finishCurrent("erreur d’ouverture");
    return;
  }

  const timeoutMs = Math.max(6, Number(state.settings.detectTimeoutSeconds || 18)) * 1000;
  setTimeout(async () => {
    const latest = await getState();
    if (latest.running && latest.currentTabId === tab.id && latest.currentIndex === state.currentIndex) {
      await finishCurrent("délai atteint");
    }
  }, timeoutMs);
}

async function startRun() {
  let state = await getState();
  if (!state.queue.length) throw new Error("La file de collecte est vide.");
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  state = await setState({
    running: true,
    paused: false,
    currentIndex: 0,
    results: [],
    runId,
    startedAt: new Date().toISOString(),
    currentTabId: null,
    currentWindowId: null,
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    screenshotEvidence: "",
    finishing: false,
    status: "Démarrage de la collecte…",
    lastError: ""
  });
  await processCurrent();
  return state;
}

async function pauseRun() {
  const state = await getState();
  await setState({ running: false, paused: true, status: "Collecte en pause" });
  await chrome.alarms.clear(ALARM_NAME);
  await closeCurrentTab(state);
}

async function resumeRun() {
  const state = await getState();
  if (!state.queue.length) throw new Error("La file de collecte est vide.");
  await setState({ running: true, paused: false, status: "Reprise de la collecte…", currentTabId: null, currentWindowId: null });
  await processCurrent();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "YT_PREROLL_GET_STATE") return getState();
    if (message?.type === "YT_PREROLL_SET_QUEUE") {
      const queue = Array.isArray(message.queue) ? message.queue.filter((item) => item?.videoId && item?.url) : [];
      return setState({ queue, results: [], currentIndex: 0, status: `${queue.length} vidéo${queue.length > 1 ? "s" : ""} prête${queue.length > 1 ? "s" : ""}` });
    }
    if (message?.type === "YT_PREROLL_SET_SETTINGS") return setState({ settings: message.settings || {} });
    if (message?.type === "YT_PREROLL_START") return startRun();
    if (message?.type === "YT_PREROLL_PAUSE") return pauseRun();
    if (message?.type === "YT_PREROLL_RESUME") return resumeRun();
    if (message?.type === "YT_PREROLL_CLEAR_RESULTS") return setState({ results: [], status: "Résultats effacés" });
    if (message?.type === "YT_PREROLL_UPDATE_RESULT") {
      const state = await getState();
      const results = state.results.map((row) => row.id === message.result?.id ? { ...row, ...message.result } : row);
      return setState({ results });
    }
    if (message?.type === "YT_PREROLL_SNAPSHOT") {
      const state = await getState();
      if (!state.running || !sender.tab || sender.tab.id !== state.currentTabId) return state;
      const snapshot = message.snapshot || {};
      const bestSnapshot = scoreSnapshot(snapshot) >= scoreSnapshot(state.bestSnapshot) ? snapshot : state.bestSnapshot;
      const adEverSeen = state.adEverSeen || Boolean(snapshot.adShowing);
      const next = await setState({ bestSnapshot, adEverSeen });
      if (snapshot.adShowing && !next.screenshotCaptured) {
        setTimeout(async () => {
          const latest = await getState();
          if (latest.running && latest.currentTabId === sender.tab.id && latest.adEverSeen && !latest.screenshotCaptured) {
            await captureEvidence(latest, latest.queue[latest.currentIndex]);
          }
        }, Math.max(0, Number(next.settings.captureDelaySeconds || 3)) * 1000);
      }
      if (state.adEverSeen && !snapshot.adShowing) {
        setTimeout(() => finishCurrent("fin de publicité"), 500);
      } else {
        const startedAt = new Date(next.currentStartedAt || 0).getTime();
        const elapsedMs = Number.isFinite(startedAt) ? Date.now() - startedAt : 0;
        const timeoutMs = Math.max(6, Number(next.settings.detectTimeoutSeconds || 18)) * 1000;
        if (elapsedMs >= timeoutMs) setTimeout(() => finishCurrent("délai atteint"), 0);
      }
      return next;
    }
    return null;
  })().then(sendResponse).catch((error) => sendResponse({ error: error?.message || String(error) }));
  return true;
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state.running && state.currentTabId === tabId) {
    await finishCurrent("onglet fermé");
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const state = await getState();
  if (state.running) await finishCurrent("watchdog");
});
