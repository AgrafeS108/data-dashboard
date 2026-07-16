(() => {
  const shared = globalThis.YTPreRollShared;
  if (!shared) return;

  const AD_SELECTORS = [
    ".html5-video-player.ad-showing",
    ".ytp-ad-player-overlay",
    ".ytp-ad-overlay-container",
    ".ytp-ad-module",
    ".ytp-ad-text",
    ".ytp-ad-preview-container",
    ".ytp-ad-survey",
    "ytd-player-legacy-desktop-watch-ads-renderer"
  ];

  const TEXT_SELECTORS = [
    ".ytp-ad-player-overlay",
    ".ytp-ad-overlay-container",
    ".ytp-ad-text",
    ".ytp-ad-preview-container",
    ".ytp-ad-simple-ad-badge",
    ".video-ads",
    "ytd-player-legacy-desktop-watch-ads-renderer"
  ];

  const LINK_SELECTORS = [
    ".ytp-ad-player-overlay a[href]",
    ".ytp-ad-overlay-container a[href]",
    ".video-ads a[href]",
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
        const text = shared.cleanText(element.innerText || element.textContent);
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

    const skipButton = [...document.querySelectorAll(".ytp-ad-skip-button, .ytp-skip-ad-button, button[class*='skip']")].find(isVisible);
    const video = document.querySelector("video");
    const duration = Number(video?.duration);
    const currentTime = Number(video?.currentTime);
    const visibleText = unique(textParts).join("\n");
    const landingUrl = links.map((item) => item.href).find((href) => {
      const domain = shared.normalizeDomain(href);
      return domain && !domain.includes("youtube.com") && !domain.includes("google.com");
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
      ...inference,
      collectedAt: new Date().toISOString()
    };
  }

  let lastSignature = "";
  let lastAdState = false;
  let debounceTimer = null;

  function emitSnapshot(reason = "mutation") {
    const snapshot = collectSnapshot();
    const signature = JSON.stringify([
      snapshot.adShowing,
      snapshot.brand,
      snapshot.advertiserCompany,
      snapshot.landingDomain,
      snapshot.format,
      snapshot.visibleText
    ]);
    const stateChanged = snapshot.adShowing !== lastAdState;
    if (signature === lastSignature && !stateChanged && reason !== "requested") return;
    lastSignature = signature;
    lastAdState = snapshot.adShowing;
    chrome.runtime.sendMessage({ type: "YT_PREROLL_SNAPSHOT", reason, snapshot }).catch(() => {});
  }

  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => emitSnapshot("mutation"), 180);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "aria-hidden"] });

  setInterval(() => emitSnapshot("poll"), 1000);
  emitSnapshot("initial");

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "YT_PREROLL_SCAN") {
      sendResponse(collectSnapshot());
      return true;
    }
    return undefined;
  });
})();
