import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../public/assets/js/app.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

assert.match(appSource, /header: "Marques observées avec nombre de présences", key: "adBrandsWithCounts"/);
assert.match(appSource, /header: "Entreprises annonceuses avec nombre de présences", key: "adAdvertisersWithCounts"/);
assert.match(appSource, /function countAdValues\(videoId, field\)/);
assert.match(appSource, /function collectSelectedAdObservations\(videos\)/);
assert.match(appSource, /function collectAdvertiserSummary\(videos\)/);
assert.match(appSource, /workbook\.addWorksheet\("Observations pré-roll"\)/);
assert.match(appSource, /workbook\.addWorksheet\("Synthèse annonceurs"\)/);
assert.match(appSource, /Nombre de présences/);
assert.match(appSource, /addAdExportSheets\(workbook, selectedVideos\)/);
assert.match(htmlSource, /Une synthèse recense toutes les marques et entreprises annonceuses avec leur nombre de présences/);
assert.match(htmlSource, /app\.js\?v=5\.0\.0/);

console.log("Advertiser export tests: OK");
