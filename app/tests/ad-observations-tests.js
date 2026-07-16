import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../public/assets/js/app.js", import.meta.url), "utf8");
const searchSource = await readFile(new URL("../public/assets/js/search.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

assert.match(appSource, /key: "adBrandLatest"/);
assert.match(appSource, /header: "Toutes les marques observées"/);
assert.match(appSource, /key: "adTestCount"/);
assert.match(appSource, /function addAdObservation\(videoId, observation\)/);
assert.match(appSource, /function deleteAdObservation\(videoId, observationId\)/);
assert.match(appSource, /data-ad-form-id/);
assert.match(appSource, /Marque affichée/);
assert.match(searchSource, /video\?\.adBrand/);
assert.match(searchSource, /video\?\.adSearchText/);
assert.match(htmlSource, /Une synthèse recense toutes les marques et entreprises annonceuses avec leur nombre de présences/);

console.log("Ad observation tests: OK");
