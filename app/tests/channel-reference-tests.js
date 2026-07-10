import assert from "node:assert/strict";
import { parseChannelReference } from "../lib/youtube.js";

const tests = [
  ["https://www.youtube.com/@francetvsport", { type: "handle", value: "francetvsport" }],
  ["https://youtube.com/@francetvsport/videos", { type: "handle", value: "francetvsport" }],
  ["@francetvsport", { type: "handle", value: "francetvsport" }],
  ["https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw", { type: "id", value: "UC_x5XG1OV2P6uZZ5FSM9Ttw" }],
  ["https://www.youtube.com/user/GoogleDevelopers", { type: "username", value: "GoogleDevelopers" }],
  ["youtube.com/c/GoogleDevelopers", { type: "custom", value: "GoogleDevelopers" }]
];

for (const [input, expected] of tests) {
  assert.deepEqual(parseChannelReference(input), expected, input);
}

console.log(JSON.stringify({ ok: true, tests: tests.length, profile: "data-dashboard-folder-structure" }, null, 2));
