importScripts("shared.js");

const shared = globalThis.YTPreRollShared;
const STORAGE_KEY = "ytPreRollCollectorStateV2";
const LEGACY_STORAGE_KEY = "ytPreRollCollectorStateV1";
const WATCHDOG_ALARM = "yt-preroll-collector-watchdog-v2";
const VERSION = "1.1.0";

const DEFAULT_SETTINGS = {
  detectTimeoutSeconds: 30,
  captureDelaySeconds: 2,
  betweenVideosSeconds: 2,
  saveScreenshots: true,
  closeCollectionWindow: true,
  location: "France",
  collectorMode: "background",
  mutePlayback: true
};

function defaultState() {
  return {
    version: VERSION,
    queue: [],
    results: [],
    settings: { ...DEFAULT_SETTINGS },
    running: false,
    paused: false,
    currentIndex: 0,
    currentTabId: null,
    currentWindowId: null,
    originWindowId: null,
    runId: "",
    currentToken: "",
    startedAt: "",
    currentStartedAt: "",
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    screenshotEvidence: "",
    finishing: false,
    pageReady: false,
    pageStatus: "",
    currentUrl: "",
    status: "Prêt",
    lastError: "",
    logs: []
  };
}

function migrateState(raw) {
  const legacySettings = raw?.settings || {};
  return {
    ...raw,
    settings: {
      ...legacySettings,
      closeCollectionWindow: legacySettings.closeCollectionWindow ?? legacySettings.closeCollectionTab ?? true
    }
  };
}

async function getState() {
  const stored = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const raw = stored[STORAGE_KEY] || migrateState(stored[LEGACY_STORAGE_KEY] || {});
  return {
    ...defaultState(),
    ...raw,
    version: VERSION,
    settings: { ...DEFAULT_SETTINGS, ...(raw?.settings || {}) },
    logs: Array.isArray(raw?.logs) ? raw.logs.slice(-80) : []
  };
}

async function setState(patch) {
  const current = await getState();
  const next = {
    ...current,
    ...patch,
    version: VERSION,
    settings: { ...current.settings, ...(patch.settings || {}) },
    logs: Array.isArray(patch.logs) ? patch.logs.slice(-80) : current.logs
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  chrome.runtime.sendMessage({ type: "YT_PREROLL_STATE", state: next }).catch(() => {});
  return next;
}

async function addLog(message, level = "info") {
  const state = await getState();
  const entry = { at: new Date().toISOString(), level, message: String(message || "") };
  return setState({ logs: [...state.logs, entry].slice(-80) });
}

function scoreSnapshot(snapshot) {
  if (!snapshot) return -1;
  let score = 0;
  if (snapshot.adShowing) score += 6;
  if (snapshot.brand) score += 6;
  if (snapshot.advertiserCompany) score += 2;
  if (snapshot.landingDomain) score += 5;
  if (snapshot.visibleText) score += Math.min(4, snapshot.visibleText.length / 100);
  score += Number(snapshot.confidence || 0) * 5;
  return score;
}

function buildCollectorUrl(item, state) {
  const url = new URL(item.url || `https://www.youtube.com/watch?v=${item.videoId}`);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("yt_collector", state.runId || "1");
  url.searchParams.set("yt_collector_token", state.currentToken);
  url.searchParams.set("yt_collector_timeout", String(Math.max(8, Number(state.settings.detectTimeoutSeconds || 30))));
  url.searchParams.set("yt_collector_muted", state.settings.mutePlayback === false ? "0" : "1");
  return url.toString();
}

async function safeGetWindow(windowId) {
  if (!windowId) return null;
  try {
    return await chrome.windows.get(windowId, { populate: true });
  } catch {
    return null;
  }
}

async function safeGetTab(tabId) {
  if (!tabId) return null;
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

async function ensureCollectorWindow(state, url) {
  const existingTab = await safeGetTab(state.currentTabId);
  const existingWindow = await safeGetWindow(state.currentWindowId);
  const visibleMode = state.settings.collectorMode === "visible";

  if (existingTab && existingWindow) {
    const updated = await chrome.tabs.update(existingTab.id, {
      url,
      active: true,
      muted: state.settings.mutePlayback !== false
    });
    if (visibleMode) {
      await chrome.windows.update(existingWindow.id, { focused: true, state: "normal" }).catch(() => {});
    } else if (state.originWindowId) {
      await chrome.windows.update(state.originWindowId, { focused: true }).catch(() => {});
    }
    return { tab: updated, windowId: existingWindow.id, reused: true };
  }

  const created = await chrome.windows.create({
    url,
    type: "popup",
    focused: visibleMode,
    width: 820,
    height: 640
  });
  const tab = created.tabs?.[0];
  if (!tab?.id) throw new Error("Chrome n’a pas créé l’onglet de collecte.");
  await chrome.tabs.update(tab.id, { active: true, muted: state.settings.mutePlayback !== false }).catch(() => {});

  if (!visibleMode && state.originWindowId) {
    await chrome.windows.update(state.originWindowId, { focused: true }).catch(() => {});
  }
  return { tab, windowId: created.id, reused: false };
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
    await addLog(`Capture impossible : ${error?.message || String(error)}`, "warning");
    return { state, evidence: "", error: error?.message || String(error) };
  }
}

function buildObservation(state, queueItem, screenshotEvidence = "", reason = "timeout") {
  const snapshot = state.bestSnapshot || {};
  const observedAt = snapshot.collectedAt || new Date().toISOString();
  const shown = state.adEverSeen ? "yes" : "no";
  const confidence = shown === "yes" ? Number(snapshot.confidence || 0) : 1;
  const notes = [
    snapshot.visibleText ? `Texte détecté : ${snapshot.visibleText.slice(0, 1500)}` : "",
    snapshot.candidateLines?.length ? `Candidats : ${snapshot.candidateLines.join(" | ")}` : "",
    snapshot.pageIssue ? `Blocage détecté : ${snapshot.pageIssue}` : "",
    shown === "no" ? `Aucune publicité détectée pendant la fenêtre de test (${reason}).` : "Observation collectée automatiquement par l’extension Chrome.",
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
    source: "chrome-extension-v2",
    confidence,
    detectionMethod: shown === "yes" ? (snapshot.detectionMethod || "unknown") : "no-ad-detected",
    landingDomain: snapshot.landingDomain || "",
    landingUrl: snapshot.landingUrl || "",
    rawDetectedText: snapshot.visibleText || "",
    candidateBrands: Array.isArray(snapshot.candidateLines) ? snapshot.candidateLines : [],
    runId: state.runId,
    collectionReason: reason,
    pageStatus: state.pageStatus || ""
  };
}

async function closeCollectorWindow(state) {
  if (!state.currentWindowId) return;
  try {
    if (state.settings.closeCollectionWindow !== false) await chrome.windows.remove(state.currentWindowId);
  } catch {}
}

async function finishCurrent(reason = "délai atteint", token = "") {
  let state = await getState();
  if (!state.running || state.paused || state.finishing) return state;
  if (token && token !== state.currentToken) return state;

  state = await setState({ finishing: true, status: `Finalisation : ${reason}` });
  const item = state.queue[state.currentIndex];
  if (!item) return finishRun();

  let evidence = "";
  if (state.adEverSeen) {
    const capture = await captureEvidence(state, item);
    state = capture.state;
    evidence = capture.evidence || "";
  }

  const observation = buildObservation(state, item, evidence || state.screenshotEvidence || "", reason);
  const results = [...state.results.filter((row) => row.videoId !== item.videoId || row.runId !== state.runId), observation];
  const nextIndex = state.currentIndex + 1;
  await chrome.alarms.clear(WATCHDOG_ALARM);

  if (nextIndex >= state.queue.length) {
    await setState({
      results,
      currentIndex: nextIndex,
      bestSnapshot: null,
      adEverSeen: false,
      screenshotCaptured: false,
      screenshotEvidence: "",
      finishing: false,
      pageReady: false,
      status: `Terminé : ${results.length} observation${results.length > 1 ? "s" : ""}`
    });
    return finishRun();
  }

  await setState({
    results,
    currentIndex: nextIndex,
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    screenshotEvidence: "",
    finishing: false,
    pageReady: false,
    pageStatus: "",
    status: `Vidéo ${nextIndex}/${state.queue.length} terminée (${reason})`
  });

  const delayMs = Math.max(0, Number(state.settings.betweenVideosSeconds || 0)) * 1000;
  setTimeout(() => processCurrent().catch((error) => handleFatalError(error)), delayMs);
  return getState();
}

async function finishRun() {
  await chrome.alarms.clear(WATCHDOG_ALARM);
  let state = await getState();
  state = await setState({ running: false, paused: false, finishing: true });
  await closeCollectorWindow(state);
  return setState({
    running: false,
    paused: false,
    currentTabId: null,
    currentWindowId: null,
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    screenshotEvidence: "",
    finishing: false,
    pageReady: false,
    currentToken: "",
    currentUrl: "",
    status: state.results.length ? `Collecte terminée : ${state.results.length} résultat${state.results.length > 1 ? "s" : ""}` : "Collecte terminée"
  });
}

async function handleFatalError(error) {
  const message = error?.message || String(error);
  await addLog(message, "error");
  return setState({ running: false, paused: false, finishing: false, lastError: message, status: "Erreur de collecte" });
}

async function processCurrent() {
  let state = await getState();
  if (!state.running || state.paused) return state;
  const item = state.queue[state.currentIndex];
  if (!item) return finishRun();

  const currentToken = `${state.runId}:${state.currentIndex}:${item.videoId}`;
  state = await setState({
    currentToken,
    currentStartedAt: new Date().toISOString(),
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    screenshotEvidence: "",
    finishing: false,
    pageReady: false,
    pageStatus: "Ouverture de YouTube…",
    status: `Ouverture ${state.currentIndex + 1}/${state.queue.length} : ${item.title || item.videoId}`,
    lastError: ""
  });

  const url = buildCollectorUrl(item, state);
  try {
    const opened = await ensureCollectorWindow(state, url);
    state = await setState({
      currentTabId: opened.tab.id,
      currentWindowId: opened.windowId,
      currentUrl: url,
      status: `Test ${state.currentIndex + 1}/${state.queue.length} : chargement de la vidéo`,
      pageStatus: opened.reused ? "Navigation de la fenêtre dédiée" : "Fenêtre dédiée créée"
    });
    await addLog(`${opened.reused ? "Navigation" : "Ouverture"} : ${item.title || item.videoId}`);

    const watchdogSeconds = Math.max(30, Number(state.settings.detectTimeoutSeconds || 30) + 25);
    await chrome.alarms.create(WATCHDOG_ALARM, { delayInMinutes: Math.max(0.5, watchdogSeconds / 60) });
    return state;
  } catch (error) {
    await setState({ lastError: error?.message || String(error), pageStatus: "Échec d’ouverture" });
    return finishCurrent("erreur d’ouverture", currentToken);
  }
}

async function startRun() {
  let state = await getState();
  if (!state.queue.length) throw new Error("La file de collecte est vide.");
  const origin = await chrome.windows.getLastFocused().catch(() => null);
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  state = await setState({
    running: true,
    paused: false,
    currentIndex: 0,
    results: [],
    runId,
    originWindowId: origin?.id || null,
    currentTabId: null,
    currentWindowId: null,
    currentToken: "",
    startedAt: new Date().toISOString(),
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    screenshotEvidence: "",
    finishing: false,
    pageReady: false,
    pageStatus: "",
    status: "Démarrage de la collecte…",
    lastError: "",
    logs: []
  });
  await processCurrent();
  return getState();
}

async function pauseRun() {
  const state = await getState();
  await chrome.alarms.clear(WATCHDOG_ALARM);
  return setState({ running: false, paused: true, status: "Collecte en pause" });
}

async function resumeRun() {
  const state = await getState();
  if (!state.queue.length) throw new Error("La file de collecte est vide.");
  await setState({ running: true, paused: false, finishing: false, status: "Reprise de la collecte…" });
  await processCurrent();
  return getState();
}

async function openCollectorWindow() {
  const state = await getState();
  if (state.currentWindowId) {
    await chrome.windows.update(state.currentWindowId, { focused: true, state: "normal" });
    return getState();
  }
  if (!state.queue.length) throw new Error("Importe d’abord une file de vidéos.");
  if (!state.running) {
    await setState({ settings: { ...state.settings, collectorMode: "visible" } });
    return startRun();
  }
  return state;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "YT_PREROLL_GET_STATE") return getState();
    if (message?.type === "YT_PREROLL_SET_QUEUE") {
      const queue = Array.isArray(message.queue) ? message.queue.filter((item) => item?.videoId && item?.url) : [];
      return setState({ queue, results: [], currentIndex: 0, status: `${queue.length} vidéo${queue.length > 1 ? "s" : ""} prête${queue.length > 1 ? "s" : ""}`, lastError: "" });
    }
    if (message?.type === "YT_PREROLL_SET_SETTINGS") return setState({ settings: message.settings || {} });
    if (message?.type === "YT_PREROLL_START") return startRun();
    if (message?.type === "YT_PREROLL_PAUSE") return pauseRun();
    if (message?.type === "YT_PREROLL_RESUME") return resumeRun();
    if (message?.type === "YT_PREROLL_OPEN_COLLECTOR") return openCollectorWindow();
    if (message?.type === "YT_PREROLL_CLEAR_RESULTS") return setState({ results: [], status: "Résultats effacés" });
    if (message?.type === "YT_PREROLL_UPDATE_RESULT") {
      const state = await getState();
      const results = state.results.map((row) => row.id === message.result?.id ? { ...row, ...message.result } : row);
      return setState({ results });
    }
    if (message?.type === "YT_PREROLL_PAGE_READY") {
      const state = await getState();
      if (!state.running || !sender.tab || sender.tab.id !== state.currentTabId || message.token !== state.currentToken) return state;
      return setState({ pageReady: true, pageStatus: message.status || "Page YouTube prête", status: `Test ${state.currentIndex + 1}/${state.queue.length} : lecture en cours` });
    }
    if (message?.type === "YT_PREROLL_PAGE_ISSUE") {
      const state = await getState();
      if (!state.running || !sender.tab || sender.tab.id !== state.currentTabId || message.token !== state.currentToken) return state;
      await addLog(message.issue || "Blocage de la page YouTube", "warning");
      if (state.currentWindowId) await chrome.windows.update(state.currentWindowId, { focused: true, state: "normal" }).catch(() => {});
      return setState({ pageStatus: message.issue || "Intervention nécessaire", lastError: message.issue || "Intervention nécessaire" });
    }
    if (message?.type === "YT_PREROLL_TIMEOUT") {
      return finishCurrent(message.reason || "délai atteint", message.token || "");
    }
    if (message?.type === "YT_PREROLL_SNAPSHOT") {
      const state = await getState();
      if (!state.running || !sender.tab || sender.tab.id !== state.currentTabId || message.token !== state.currentToken) return state;
      const snapshot = message.snapshot || {};
      const bestSnapshot = scoreSnapshot(snapshot) >= scoreSnapshot(state.bestSnapshot) ? snapshot : state.bestSnapshot;
      const adEverSeen = state.adEverSeen || Boolean(snapshot.adShowing);
      const next = await setState({
        bestSnapshot,
        adEverSeen,
        pageReady: true,
        pageStatus: snapshot.adShowing ? "Publicité détectée" : (snapshot.playbackState || "Vidéo en lecture")
      });

      if (snapshot.adShowing && !next.screenshotCaptured) {
        setTimeout(async () => {
          const latest = await getState();
          if (latest.running && latest.currentTabId === sender.tab.id && latest.currentToken === message.token && latest.adEverSeen && !latest.screenshotCaptured) {
            await captureEvidence(latest, latest.queue[latest.currentIndex]);
          }
        }, Math.max(0, Number(next.settings.captureDelaySeconds || 2)) * 1000);
      }
      if (state.adEverSeen && !snapshot.adShowing) {
        setTimeout(() => finishCurrent("fin de publicité", message.token), 600);
      }
      return next;
    }
    return null;
  })().then(sendResponse).catch((error) => sendResponse({ error: error?.message || String(error) }));
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  const state = await getState();
  if (!state.running || tabId !== state.currentTabId) return;
  await setState({ pageStatus: "Page chargée, détection en cours…" });
  chrome.tabs.sendMessage(tabId, { type: "YT_PREROLL_FORCE_SCAN", token: state.currentToken }).catch(() => {});
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state.running && state.currentTabId === tabId && !state.finishing) {
    await setState({ currentTabId: null, currentWindowId: null, lastError: "La fenêtre de collecte a été fermée." });
    await finishCurrent("fenêtre fermée", state.currentToken);
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const state = await getState();
  if (state.running && state.currentWindowId === windowId && !state.finishing) {
    await setState({ currentTabId: null, currentWindowId: null, lastError: "La fenêtre de collecte a été fermée." });
    await finishCurrent("fenêtre fermée", state.currentToken);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== WATCHDOG_ALARM) return;
  const state = await getState();
  if (state.running) await finishCurrent("watchdog", state.currentToken);
});
