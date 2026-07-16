import assert from "node:assert/strict";
import {
  buildVideoSearchIndex,
  matchesVideoSearch,
  normalizeSearchText,
  parseSearchQuery
} from "../public/assets/js/search.js";

const video = {
  id: "AbC123xyz00",
  title: "Résumé PSG – Olympique de Marseille",
  description: "Tous les buts de l'Équipe de France et l'analyse d'après-match.",
  tags: ["Football", "Ligue 1", "Paris Saint-Germain"],
  channelTitle: "beIN SPORTS France",
  publishedAt: "2026-07-15T19:45:12Z",
  liveBroadcastContent: "none"
};
const index = buildVideoSearchIndex(video);

assert.equal(normalizeSearchText("Équipe d’après-match"), "equipe d apres match");
assert.equal(matchesVideoSearch(index, parseSearchQuery("psg")), true);
assert.equal(matchesVideoSearch(index, parseSearchQuery("PSG Marseille")), true);
assert.equal(matchesVideoSearch(index, parseSearchQuery("equipe france")), true);
assert.equal(matchesVideoSearch(index, parseSearchQuery('"equipe de france"')), true);
assert.equal(matchesVideoSearch(index, parseSearchQuery("bein sports")), true);
assert.equal(matchesVideoSearch(index, parseSearchQuery("beinsports")), true);
assert.equal(matchesVideoSearch(index, parseSearchQuery("OM")), false);
assert.equal(matchesVideoSearch(index, parseSearchQuery("psg -marseille")), false);
assert.equal(matchesVideoSearch(index, parseSearchQuery("2026 19 45")), true);
assert.equal(matchesVideoSearch(index, parseSearchQuery("tennis")), false);

console.log("Search tests: OK");
