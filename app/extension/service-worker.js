importScripts("shared.js");

const shared = globalThis.YTPreRollShared;
const STORAGE_KEY = "ytPreRollCollectorStateV4";
const LEGACY_STORAGE_KEYS = ["ytPreRollCollectorStateV3", "ytPreRollCollectorStateV2", "ytPreRollCollectorStateV1"];
const WATCHDOG_ALARM = "yt-preroll-collector-watchdog-v4";
const VERSION = "1.3.0";

const DEFAULT_SETTINGS = {
  detectTimeoutSeconds: 30,
  captureDelaySeconds: 2,
  betweenVideosSeconds: 2,
  saveScreenshots: true,
  closeCollectionWindow: true,
  location: "France",
  collectorMode: "background",
  sessionMode: "incognito-tabs",
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
    anchorTabId: null,
    originWindowId: null,
    currentWindowIncognito: false,
    incognitoAllowed: null,
    runId: "",
    currentToken: "",
    startedAt: "",
    currentStartedAt: "",
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    screenshotEvidence: "",
    finishing: false,
    intentionalTabClose: false,
    intentionalWindowClose: false,
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
    anchorTabId: null,
    currentWindowIncognito: false,
    incognitoAllowed: null,
    intentionalTabClose: false,
    intentionalWindowClose: false,
    settings: {
      ...legacySettings,
      sessionMode: legacySettings.sessionMode || "incognito-tabs",
      closeCollectionWindow: legacySettings.closeCollectionWindow ?? legacySettings.closeCollectionTab ?? true
    }
  };
}

async function getState() {
  const stored = await chrome.storage.local.get([STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
  const legacyRaw = LEGACY_STORAGE_KEYS.map((key) => stored[key]).find(Boolean) || {};
  const raw = stored[STORAGE_KEY] || migrateState(legacyRaw);
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function usesIncognito(state) {
  return state.settings.sessionMode !== "standard-tabs";
}

function getIncognitoAccess() {
  return new Promise((resolve) => {
    try {
      chrome.extension.isAllowedIncognitoAccess((allowed) => resolve(Boolean(allowed)));
    } catch {
      resolve(false);
    }
  });
}

async function refreshIncognitoAccess() {
  const allowed = await getIncognitoAccess();
  return setState({ incognitoAllowed: allowed });
}

async function getForeignIncognitoWindows(excludedWindowId = null) {
  try {
    const windows = await chrome.windows.getAll({ populate: false });
    return windows.filter((window) => window.incognito && window.id !== excludedWindowId);
  } catch {
    return [];
  }
}

async function assertIncognitoReady(state) {
  if (!usesIncognito(state)) return true;
  const allowed = await getIncognitoAccess();
  await setState({ incognitoAllowed: allowed });
  if (!allowed) {
    throw new Error("Active « Autoriser en navigation privée » dans les détails de l’extension Chrome, puis relance la collecte.");
  }
  const foreign = await getForeignIncognitoWindows(state.currentWindowId);
  if (foreign.length) {
    throw new Error("Ferme les autres fenêtres de navigation privée avant de démarrer. La fenêtre privée de collecte doit être la seule ouverte pour rester sans compte Google.");
  }
  return true;
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
  url.searchParams.set("yt_collector_fresh_tab", "1");
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

async function restoreOriginFocus(state) {
  if (state.settings.collectorMode === "visible" || !state.originWindowId) return;
  // Le nouvel onglet YouTube prend brièvement le focus afin d'initialiser la lecture,
  // puis la fenêtre de travail de l'utilisateur repasse devant.
  await wait(1400);
  await chrome.windows.update(state.originWindowId, { focused: true }).catch(() => {});
}

async function closeCurrentVideoTab(state) {
  if (!state.currentTabId) return state;
  const tabId = state.currentTabId;
  await setState({ intentionalTabClose: true, pageStatus: "Fermeture de l’onglet testé…" });
  try {
    await chrome.tabs.remove(tabId);
  } catch {}
  await wait(80);
  return setState({
    currentTabId: null,
    currentUrl: "",
    intentionalTabClose: false,
    pageReady: false
  });
}

async function closeCollectorWindow(state, force = false) {
  if (!state.currentWindowId) return state;
  if (!force && state.settings.closeCollectionWindow === false) return state;
  const windowId = state.currentWindowId;
  await setState({ intentionalWindowClose: true, pageStatus: "Fermeture de la fenêtre de collecte…" });
  try {
    await chrome.windows.remove(windowId);
  } catch {}
  await wait(100);
  return setState({
    currentTabId: null,
    currentWindowId: null,
    anchorTabId: null,
    currentWindowIncognito: false,
    currentUrl: "",
    intentionalTabClose: false,
    intentionalWindowClose: false,
    pageReady: false
  });
}

async function createCollectorWindow(state) {
  const incognito = usesIncognito(state);
  if (incognito) await assertIncognitoReady(state);

  const created = await chrome.windows.create({
    url: "about:blank",
    type: "popup",
    focused: true,
    incognito,
    width: 920,
    height: 700
  });
  const anchorTab = created.tabs?.[0];
  if (!created.id || !anchorTab?.id) throw new Error("Chrome n’a pas créé la fenêtre de collecte.");

  await setState({
    currentWindowId: created.id,
    anchorTabId: anchorTab.id,
    currentWindowIncognito: Boolean(created.incognito),
    pageStatus: incognito ? "Fenêtre privée sans compte créée" : "Fenêtre standard créée"
  });
  return { windowId: created.id, anchorTabId: anchorTab.id, incognito: Boolean(created.incognito) };
}

async function ensureCollectorWindow(state) {
  const expectedIncognito = usesIncognito(state);
  let window = await safeGetWindow(state.currentWindowId);

  if (window && Boolean(window.incognito) !== expectedIncognito) {
    state = await closeCollectorWindow(state, true);
    window = null;
  }

  if (!window) {
    return createCollectorWindow(state);
  }

  if (expectedIncognito) await assertIncognitoReady(state);

  let anchor = await safeGetTab(state.anchorTabId);
  if (!anchor || anchor.windowId !== window.id) {
    anchor = await chrome.tabs.create({ windowId: window.id, url: "about:blank", active: false });
    await setState({ anchorTabId: anchor.id });
  }

  return { windowId: window.id, anchorTabId: anchor.id, incognito: Boolean(window.incognito) };
}

async function openFreshVideoTab(state, url) {
  if (state.currentTabId) state = await closeCurrentVideoTab(state);
  const collector = await ensureCollectorWindow(state);

  await chrome.windows.update(collector.windowId, { focused: true, state: "normal" }).catch(() => {});
  const tab = await chrome.tabs.create({
    windowId: collector.windowId,
    url,
    active: true
  });
  if (!tab?.id) throw new Error("Chrome n’a pas créé le nouvel onglet YouTube.");
  await chrome.tabs.update(tab.id, { active: true, muted: state.settings.mutePlayback !== false }).catch(() => {});
  await restoreOriginFocus(state);
  return { tab, windowId: collector.windowId, incognito: collector.incognito };
}

async function ensureDetectorInjected(tabId, token) {
  if (!tabId) return false;
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "YT_PREROLL_PING", token });
    if (response?.ready) return true;
  } catch {}

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["shared.js", "content.js"] });
    return true;
  } catch (error) {
    await addLog(`Injection du détecteur impossible : ${error?.message || String(error)}`, "warning");
    return false;
  }
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
    usesIncognito(state) ? "Test effectué dans une fenêtre de navigation privée sans compte Google, avec un nouvel onglet pour cette vidéo." : "Test effectué dans une fenêtre standard avec un nouvel onglet pour cette vidéo.",
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
    source: "chrome-extension-v4",
    confidence,
    detectionMethod: shown === "yes" ? (snapshot.detectionMethod || "unknown") : "no-ad-detected",
    landingDomain: snapshot.landingDomain || "",
    landingUrl: snapshot.landingUrl || "",
    rawDetectedText: snapshot.visibleText || "",
    candidateBrands: Array.isArray(snapshot.candidateLines) ? snapshot.candidateLines : [],
    runId: state.runId,
    collectionReason: reason,
    pageStatus: state.pageStatus || "",
    browsingContext: usesIncognito(state) ? "incognito-new-tab" : "standard-new-tab"
  };
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

  // Chaque vidéo est toujours fermée : la suivante sera chargée dans un nouvel onglet,
  // jamais par navigation directe dans le même lecteur YouTube.
  state = await closeCurrentVideoTab(state);

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
    pageStatus: "Onglet fermé — préparation d’un nouvel onglet YouTube…",
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
  state = await closeCurrentVideoTab(state);
  state = await closeCollectorWindow(state, false);
  return setState({
    running: false,
    paused: false,
    currentTabId: null,
    currentWindowId: state.settings.closeCollectionWindow === false ? state.currentWindowId : null,
    anchorTabId: state.settings.closeCollectionWindow === false ? state.anchorTabId : null,
    currentWindowIncognito: state.settings.closeCollectionWindow === false ? state.currentWindowIncognito : false,
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
    pageStatus: usesIncognito(state) ? "Création d’un nouvel onglet privé YouTube…" : "Création d’un nouvel onglet YouTube…",
    status: `Ouverture ${state.currentIndex + 1}/${state.queue.length} : ${item.title || item.videoId}`,
    lastError: ""
  });

  const url = buildCollectorUrl(item, state);
  try {
    const opened = await openFreshVideoTab(state, url);
    state = await setState({
      currentTabId: opened.tab.id,
      currentWindowId: opened.windowId,
      currentWindowIncognito: opened.incognito,
      currentUrl: url,
      status: `Test ${state.currentIndex + 1}/${state.queue.length} : chargement de la vidéo`,
      pageStatus: opened.incognito ? "Nouvel onglet privé créé" : "Nouvel onglet standard créé"
    });
    await addLog(`Nouvel onglet ${opened.incognito ? "privé" : "standard"} : ${item.title || item.videoId}`);

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
  if (usesIncognito(state)) await assertIncognitoReady(state);
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
    anchorTabId: null,
    currentWindowIncognito: false,
    currentToken: "",
    startedAt: new Date().toISOString(),
    bestSnapshot: null,
    adEverSeen: false,
    screenshotCaptured: false,
    screenshotEvidence: "",
    finishing: false,
    intentionalTabClose: false,
    intentionalWindowClose: false,
    pageReady: false,
    pageStatus: "",
    status: usesIncognito(state) ? "Démarrage de la collecte privée…" : "Démarrage de la collecte…",
    lastError: "",
    logs: []
  });
  await processCurrent();
  return getState();
}

async function pauseRun() {
  let state = await getState();
  await chrome.alarms.clear(WATCHDOG_ALARM);
  state = await setState({ running: false, paused: true, finishing: true, status: "Collecte en pause — la vidéo actuelle sera relancée dans un nouvel onglet" });
  state = await closeCurrentVideoTab(state);
  return setState({ finishing: false, pageStatus: "Pause" });
}

async function resumeRun() {
  const state = await getState();
  if (!state.queue.length) throw new Error("La file de collecte est vide.");
  if (usesIncognito(state)) await assertIncognitoReady(state);
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

async function openExtensionSettings() {
  const url = `chrome://extensions/?id=${chrome.runtime.id}`;
  try {
    await chrome.tabs.create({ url });
    return { ok: true };
  } catch {
    return { ok: false, url };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "YT_PREROLL_GET_STATE") return getState();
    if (message?.type === "YT_PREROLL_CHECK_INCOGNITO") return refreshIncognitoAccess();
    if (message?.type === "YT_PREROLL_OPEN_EXTENSION_SETTINGS") return openExtensionSettings();
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
  await setState({ pageStatus: "Page chargée, initialisation du détecteur…" });
  const injected = await ensureDetectorInjected(tabId, state.currentToken);
  if (!injected) {
    await setState({ pageStatus: "Détecteur non chargé", lastError: "Impossible d’injecter le détecteur dans YouTube." });
    if (state.currentWindowId) await chrome.windows.update(state.currentWindowId, { focused: true, state: "normal" }).catch(() => {});
    return;
  }
  await setState({ pageStatus: "Détecteur chargé, analyse en cours…" });
  chrome.tabs.sendMessage(tabId, { type: "YT_PREROLL_FORCE_SCAN", token: state.currentToken }).catch(() => {});
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  if (state.running && state.queue.length && state.currentIndex < state.queue.length) {
    await setState({ status: "Reprise après redémarrage de Chrome…", finishing: false });
    processCurrent().catch(handleFatalError);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state.anchorTabId === tabId) {
    await setState({ anchorTabId: null });
    return;
  }
  if (state.running && state.currentTabId === tabId && !state.finishing && !state.intentionalTabClose) {
    await setState({ currentTabId: null, currentUrl: "", lastError: "L’onglet de collecte a été fermé." });
    await finishCurrent("onglet fermé", state.currentToken);
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const state = await getState();
  if (state.currentWindowId !== windowId) return;
  if (state.intentionalWindowClose || state.finishing) return;
  await setState({ currentTabId: null, currentWindowId: null, anchorTabId: null, currentWindowIncognito: false, lastError: "La fenêtre de collecte a été fermée." });
  if (state.running) await finishCurrent("fenêtre fermée", state.currentToken);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== WATCHDOG_ALARM) return;
  const state = await getState();
  if (state.running) await finishCurrent("watchdog", state.currentToken);
});
