import assert from "node:assert/strict";
import { filterPlaylistItemsByCriteria } from "../lib/youtube.js";

function item(id, publishedAt) {
  return {
    contentDetails: { videoId: id, videoPublishedAt: publishedAt },
    snippet: { publishedAt, resourceId: { videoId: id } }
  };
}

const items = [
  item("new", "2026-07-15T10:00:00Z"),
  item("inside-2", "2026-07-10T10:00:00Z"),
  item("inside-1", "2026-07-05T10:00:00Z"),
  item("old", "2026-06-25T10:00:00Z")
];

{
  const result = filterPlaylistItemsByCriteria(items, {
    publishedAfter: "2026-07-01T00:00:00Z",
    publishedBefore: "2026-07-12T23:59:59Z"
  });
  assert.deepEqual(result.selected.map((entry) => entry.contentDetails.videoId), ["inside-2", "inside-1"]);
  assert.equal(result.skippedNewerCount, 1);
  assert.equal(result.skippedOlderCount, 1);
  assert.equal(result.reachedStartBoundary, true);
}

{
  const result = filterPlaylistItemsByCriteria(items, { limit: 2 });
  assert.deepEqual(result.selected.map((entry) => entry.contentDetails.videoId), ["new", "inside-2"]);
}

{
  const result = filterPlaylistItemsByCriteria(items, {
    publishedAfter: "2026-08-01T00:00:00Z"
  });
  assert.equal(result.selected.length, 0);
  assert.equal(result.reachedStartBoundary, true);
}

console.log("Load criteria tests: OK");
