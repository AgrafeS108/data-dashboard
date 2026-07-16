import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/assets/js/app.js", import.meta.url), "utf8");

assert.match(source, /header: "Date de Paris", key: "parisDate"/);
assert.match(source, /header: "Heure exacte de Paris", key: "parisExactTime"/);
assert.doesNotMatch(source, /header: "Date et heure de Paris"/);
assert.match(source, /migrated\.push\("parisDate", "parisExactTime"\)/);
assert.match(source, /migrated\.push\("adBrandLatest", "adAdvertiserLatest"\)/);
assert.match(source, /exportColumnDraftKeys: null/);
assert.match(source, /function handleColumnDialogChange\(event\)/);
assert.match(source, /state\.exportColumnKeys = keys/);

console.log("Export column tests: OK");
