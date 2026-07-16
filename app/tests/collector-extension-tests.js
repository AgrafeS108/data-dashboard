import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const sharedSource = await readFile(new URL("../extension/shared.js", import.meta.url), "utf8");
const context = vm.createContext({ URL, console, globalThis: {} });
vm.runInContext(sharedSource, context);
const shared = context.globalThis.YTPreRollShared;
assert.ok(shared);

assert.equal(shared.videoIdFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
assert.equal(shared.videoIdFromUrl("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
assert.equal(shared.normalizeDomain("https://www.googleadservices.com/pagead/aclk?adurl=https%3A%2F%2Fwww.renault.fr%2F"), "renault.fr");
assert.equal(shared.domainBrand("https://www.nike.com/fr/"), "Nike");

const inferred = shared.inferAdvertiser({
  visibleText: "Annonce\nRenault\nDécouvrez la nouvelle Clio",
  landingUrl: "https://www.renault.fr/vehicules/clio.html"
});
assert.equal(inferred.brand, "Renault");
assert.equal(inferred.landingDomain, "renault.fr");
assert.ok(inferred.confidence >= 0.8);

const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.ok(manifest.host_permissions.includes("https://www.youtube.com/*"));
assert.ok(manifest.permissions.includes("storage"));
assert.ok(manifest.permissions.includes("downloads"));

console.log("Collector extension tests: OK");
