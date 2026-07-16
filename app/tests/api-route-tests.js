import assert from "node:assert/strict";
import resolveHandler from "../api/resolve-channel.js";
import videosHandler from "../api/channel-videos.js";
import healthHandler from "../api/health.js";

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    ended: false,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    end() { this.ended = true; return this; }
  };
}

{
  const res = createResponse();
  await healthHandler({ method: "GET" }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
}

{
  const res = createResponse();
  await resolveHandler({ method: "GET", body: {} }, res);
  assert.equal(res.statusCode, 405);
}

{
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = "test-key";
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, "/youtube/v3/channels");
    assert.equal(parsed.searchParams.get("forHandle"), "beINSPORTSFrance");
    return new Response(JSON.stringify({
      items: [{
        id: "UCaaaaaaaaaaaaaaaaaaaaaa",
        snippet: {
          title: "beIN SPORTS France",
          customUrl: "@beINSPORTSFrance",
          publishedAt: "2012-01-01T12:00:00Z",
          thumbnails: { high: { url: "https://example.com/channel.jpg" } }
        },
        contentDetails: { relatedPlaylists: { uploads: "UUaaaaaaaaaaaaaaaaaaaaaa" } },
        statistics: { viewCount: "1", subscriberCount: "2", videoCount: "3" },
        status: { privacyStatus: "public" },
        brandingSettings: { channel: {} }
      }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const res = createResponse();
    await resolveHandler({
      method: "POST",
      body: { channelInput: "https://www.youtube.com/@beINSPORTSFrance" }
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.channel.title, "beIN SPORTS France");
    assert.equal(res.payload.channel.uploadsPlaylistId, "UUaaaaaaaaaaaaaaaaaaaaaa");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = originalKey;
  }
}

{
  const originalLog = console.error;
  console.error = () => {};
  try {
    const res = createResponse();
    await videosHandler({ method: "POST", body: {} }, res);
    assert.equal(res.statusCode, 500);
    assert.match(res.payload.error, /YOUTUBE_API_KEY/);
  } finally {
    console.error = originalLog;
  }
}

console.log("API route tests: OK");
