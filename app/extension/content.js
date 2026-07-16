(() => {
  const shared = globalThis.YTPreRollShared;
  if (!shared) return;

  const params = new URLSearchParams(location.search);
  const token = params.get("yt_collector_token") || "";
  const timeoutSeconds = Math.max(8, Number(params.get("yt_collector_timeout") || 30));
  const shouldMute = params.get("yt_collector_muted") !== "0";
  if (!params.has("yt_collector")) return;

  const AD_SELECTORS = [
    "#movie_player.ad-showing",
    ".html5-video-player.ad-showing",
    ".video-ads.ytp-ad-module",
    ".ytp-ad-player-overlay",
    ".ytp-ad-overlay-container",
    ".ytp-ad-module",
    ".ytp-ad-text",
    ".ytp-ad-preview-container",
    ".ytp-ad-survey",
    "ytd-player-legacy-desktop-watch-ads-renderer",
    "[class*='ytp-ad-player-overlay']"
  ];

  const TEXT_SELECTORS = [
    ".ytp-ad-player-overlay",
    ".ytp-ad-overlay-container",
    ".ytp-ad-text",
    ".ytp-ad-preview-container",
    ".ytp-ad-simple-ad-badge",
    ".ytp-ad-button-text",
    ".ytp-ad-player-overlay-flyout-cta",
    ".video-ads",
    "ytd-player-legacy-desktop-watch-ads-renderer"
  ];

  const LINK_SELECTORS = [
    ".ytp-ad-player-overlay a[href]",
    ".ytp-ad-overlay-container a[href]",
    ".video-ads a[href]",
    "a[href*='googleadservices.com/pagead/aclk']",
    "a[href*='doubleclick.net']",
    "ytd-player-legacy-desktop-watch-ads-renderer a[href]"
  ];

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 2 && rect.height > 2;
  }

  function unique(values) {
    return [...new Set(values.map(shared.cleanText).filter(Boolean))];
  }

  function detectPageIssue() {
    const bodyText = shared.cleanText(document.body?.innerText || "").slice(0, 4000);
    if (/before you continue to youtube|avant de continuer vers youtube|consent/i.test(bodyText) && /accept|accepter|reject|refuser/i.test(bodyText)) {
      return "Écran de consentement YouTube : ouvre la fenêtre de collecte et réponds une fois au consentement.";
    }
    if (/sign in to confirm you.?re not a bot|connectez-vous pour confirmer que vous n.?êtes pas un robot/i.test(bodyText)) {
      return "YouTube demande une vérification anti-robot. Ouvre la fenêtre de collecte et termine la vérification.";
    }
    if (/video unavailable|vidéo non disponible/i.test(bodyText)) return "Vidéo indisponible.";
    return "";
  }

  async function ensurePlayback() {
    const video = document.querySelector("video");
    if (!video) return "Lecteur en cours de chargement";
    if (shouldMute) video.muted = true;
    try {
      if (video.paused) await video.play();
    } catch {
      const button = [...document.querySelectorAll(".ytp-large-play-button, .ytp-play-button, button[aria-label*='Lire'], button[aria-label*='Play']")].find(isVisible);
      if (button) button.click();
    }
    return video.paused ? "Lecture bloquée" : (video.muted ? "Lecture en arrière-plan (muette)" : "Lecture en cours");
  }

  function collectSnapshot() {
    const player = document.querySelector("#movie_player");
    const adShowing = Boolean(
      player?.classList.contains("ad-showing") ||
      AD_SELECTORS.some((selector) => [...document.querySelectorAll(selector)].some(isVisible))
    );

    const textParts = [];
    for (const selector of TEXT_SELECTORS) {
      for (const element of document.querySelectorAll(selector)) {
        if (!isVisible(element)) continue;
        const text = shared.cleanText(element.innerText || element.textContent || element.getAttribute("aria-label"));
        if (text) textParts.push(text);
      }
    }

    const links = [];
    for (const selector of LINK_SELECTORS) {
      for (const anchor of document.querySelectorAll(selector)) {
        if (!isVisible(anchor)) continue;
        links.push({
          href: anchor.href || "",
          text: shared.cleanText(anchor.innerText || anchor.getAttribute("aria-label") || anchor.title)
        });
      }
    }

    const skipButton = [...document.querySelectorAll(".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button[class*='skip']")].find(isVisible);
    const video = document.querySelector("video");
    const duration = Number(video?.duration);
    const currentTime = Number(video?.currentTime);
    const visibleText = unique(textParts).join("\n");
    const landingUrl = links.map((item) => item.href).find((href) => {
      const domain = shared.normalizeDomain(href);
      return domain && !domain.includes("youtube.com") && !domain.includes("google.com") && !domain.includes("doubleclick.net");
    }) || links[0]?.href || "";
    const inference = shared.inferAdvertiser({
      visibleText,
      landingUrl,
      linkTexts: links.map((item) => item.text)
    });

    let format = "unknown";
    if (skipButton) format = "skippable";
    else if (adShowing && Number.isFinite(duration) && duration <= 7) format = "bumper";
    else if (adShowing) format = "non-skippable";

    return {
      pageUrl: location.href,
      videoId: shared.videoIdFromUrl(location.href),
      title: document.title.replace(/\s*-\s*YouTube\s*$/i, ""),
      adShowing,
      visibleText,
      links,
      landingUrl,
      format,
      skipVisible: Boolean(skipButton),
      mediaDuration: Number.isFinite(duration) ? duration : null,
      mediaCurrentTime: Number.isFinite(currentTime) ? currentTime : null,
      playbackState: !video ? "Lecteur absent" : (video.paused ? "Lecture en pause" : (video.muted ? "Lecture muette" : "Lecture en cours")),
      pageIssue: detectPageIssue(),
      ...inference,
      collectedAt: new Date().toISOString()
    };
  }

  let lastSignature = "";
  let lastAdState = false;
  let debounceTimer = null;
  let timedOut = false;

  function send(message) {
    chrome.runtime.sendMessage({ ...message, token }).catch(() => {});
  }

  async function emitSnapshot(reason = "mutation") {
    const playbackState = await ensurePlayback();
    const snapshot = collectSnapshot();
    snapshot.playbackState = playbackState || snapshot.playbackState;
    if (snapshot.pageIssue) send({ type: "YT_PREROLL_PAGE_ISSUE", issue: snapshot.pageIssue });

    const signature = JSON.stringify([
      snapshot.adShowing,
      snapshot.brand,
      snapshot.advertiserCompany,
      snapshot.landingDomain,
      snapshot.format,
      snapshot.playbackState,
      snapshot.visibleText
    ]);
    const stateChanged = snapshot.adShowing !== lastAdState;
    if (signature === lastSignature && !stateChanged && reason !== "requested") return;
    lastSignature = signature;
    lastAdState = snapshot.adShowing;
    send({ type: "YT_PREROLL_SNAPSHOT", reason, snapshot });
  }

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => emitSnapshot("mutation"), 180);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-hidden"] });

  const poll = setInterval(() => emitSnapshot("poll"), 1000);
  send({ type: "YT_PREROLL_PAGE_READY", status: "Script de détection chargé" });
  emitSnapshot("initial");

  setTimeout(() => {
    if (timedOut) return;
    timedOut = true;
    clearInterval(poll);
    send({ type: "YT_PREROLL_TIMEOUT", reason: "délai de test atteint" });
  }, timeoutSeconds * 1000);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "YT_PREROLL_FORCE_SCAN" && (!message.token || message.token === token)) {
      ensurePlayback().then(() => {
        const snapshot = collectSnapshot();
        sendResponse(snapshot);
        send({ type: "YT_PREROLL_SNAPSHOT", reason: "requested", snapshot });
      });
      return true;
    }
    return undefined;
  });
})();
