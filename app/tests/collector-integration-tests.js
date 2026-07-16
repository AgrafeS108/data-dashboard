import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../public/assets/js/app.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

assert.match(htmlSource, /id="openCollectorButton"/);
assert.match(htmlSource, /id="exportCollectorQueueButton"/);
assert.match(htmlSource, /id="importCollectorResultsButton"/);
assert.match(htmlSource, /yt-preroll-collector-extension\.zip/);
assert.match(appSource, /function exportCollectorQueue\(\)/);
assert.match(appSource, /function mergeCollectorObservations\(values\)/);
assert.match(appSource, /schema: "yt-preroll-collector-queue-v1"/);
assert.match(appSource, /key: "adConfidenceLatest"/);
assert.match(appSource, /key: "adLandingDomainLatest"/);
assert.match(appSource, /header: "Texte détecté"/);
assert.match(appSource, /source: "manual"/);

console.log("Collector integration tests: OK");
