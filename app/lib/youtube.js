const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const VIDEO_PARTS = ["snippet", "contentDetails", "statistics", "status", "topicDetails", "recordingDetails"].join(",");
const CHANNEL_PARTS = ["snippet", "contentDetails", "statistics", "status", "brandingSettings"].join(",");
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function requireApiKey(apiKey) {
  if (!apiKey) {
    const error = new Error("La variable YOUTUBE_API_KEY n'est pas configurée sur le serveur.");
    error.status = 500;
    throw error;
  }
}

async function youtubeGet(path, params, apiKey) {
  requireApiKey(apiKey);
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  for (const [key, value] of Object.entries({ ...params, key: apiKey })) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `Erreur YouTube API (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data?.error?.errors || [];
    throw error;
  }

  return data;
}

function normalizeChannel(channel, extra = {}) {
  if (!channel) return null;
  const snippet = channel.snippet || {};
  const content = channel.contentDetails || {};
  const stats = channel.statistics || {};
  const status = channel.status || {};
  const branding = channel.brandingSettings || {};

  return {
    id: channel.id,
    url: `https://www.youtube.com/channel/${channel.id}`,
    title: snippet.title || "",
    description: snippet.description || "",
    customUrl: snippet.customUrl || "",
    publishedAt: snippet.publishedAt || null,
    country: snippet.country || branding.channel?.country || "",
    defaultLanguage: snippet.defaultLanguage || branding.channel?.defaultLanguage || "",
    thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "",
    banner: branding.image?.bannerExternalUrl || "",
    keywords: branding.channel?.keywords || "",
    viewCount: stats.viewCount ?? null,
    subscriberCount: stats.subscriberCount ?? null,
    hiddenSubscriberCount: Boolean(stats.hiddenSubscriberCount),
    videoCount: stats.videoCount ?? null,
    privacyStatus: status.privacyStatus || "",
    uploadsPlaylistId: content.relatedPlaylists?.uploads || "",
    resolutionMethod: extra.resolutionMethod || "",
    resolutionQuotaEstimate: extra.resolutionQuotaEstimate || 1
  };
}

function normalizeVideo(video, channelMap = new Map()) {
  const snippet = video.snippet || {};
  const content = video.contentDetails || {};
  const stats = video.statistics || {};
  const status = video.status || {};
  const topics = video.topicDetails || {};
  const recording = video.recordingDetails || {};

  return {
    id: video.id,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    title: snippet.title || "",
    description: snippet.description || "",
    publishedAt: snippet.publishedAt || null,
    channelId: snippet.channelId || "",
    channelTitle: snippet.channelTitle || "",
    thumbnail: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.standard?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || "",
    tags: Array.isArray(snippet.tags) ? snippet.tags : [],
    categoryId: snippet.categoryId || "",
    defaultLanguage: snippet.defaultLanguage || "",
    defaultAudioLanguage: snippet.defaultAudioLanguage || "",
    liveBroadcastContent: snippet.liveBroadcastContent || "none",
    duration: content.duration || "",
    dimension: content.dimension || "",
    definition: content.definition || "",
    caption: content.caption || "false",
    licensedContent: Boolean(content.licensedContent),
    projection: content.projection || "",
    regionRestriction: content.regionRestriction || null,
    contentRating: content.contentRating || null,
    viewCount: stats.viewCount ?? null,
    likeCount: stats.likeCount ?? null,
    commentCount: stats.commentCount ?? null,
    favoriteCount: stats.favoriteCount ?? null,
    privacyStatus: status.privacyStatus || "",
    uploadStatus: status.uploadStatus || "",
    license: status.license || "",
    embeddable: status.embeddable ?? null,
    publicStatsViewable: status.publicStatsViewable ?? null,
    madeForKids: status.madeForKids ?? null,
    selfDeclaredMadeForKids: status.selfDeclaredMadeForKids ?? null,
    topicCategories: Array.isArray(topics.topicCategories) ? topics.topicCategories : [],
    relevantTopicIds: Array.isArray(topics.relevantTopicIds) ? topics.relevantTopicIds : [],
    recordingDate: recording.recordingDate || null,
    location: recording.location || null,
    channel: channelMap.get(snippet.channelId) || null
  };
}

function stripTrailingSegments(parts) {
  const ignored = new Set(["videos", "shorts", "streams", "featured", "playlists", "community", "about", "search"]);
  return parts.filter((part, index) => !(index > 0 && ignored.has(part.toLowerCase())));
}

export function parseChannelReference(input) {
  const raw = String(input || "").trim().replace(/^['"]|['"]$/g, "");
  if (!raw) {
    const error = new Error("Colle l’URL d’une chaîne YouTube, son @handle ou son identifiant.");
    error.status = 400;
    throw error;
  }

  if (CHANNEL_ID_PATTERN.test(raw)) return { type: "id", value: raw };
  if (/^@[A-Za-z0-9._-]+$/.test(raw)) return { type: "handle", value: raw.slice(1) };

  let url;
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    url = new URL(normalized);
  } catch {
    if (/^[A-Za-z0-9._-]+$/.test(raw)) return { type: "handle", value: raw };
    const error = new Error("Le lien de chaîne YouTube n’est pas valide.");
    error.status = 400;
    throw error;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  if (!(host === "youtube.com" || host.endsWith(".youtube.com"))) {
    const error = new Error("Le lien doit pointer vers une chaîne youtube.com.");
    error.status = 400;
    throw error;
  }

  let parts = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  parts = stripTrailingSegments(parts);
  const first = parts[0] || "";

  if (first.startsWith("@") && first.length > 1) return { type: "handle", value: first.slice(1) };
  if (first.toLowerCase() === "channel" && CHANNEL_ID_PATTERN.test(parts[1] || "")) return { type: "id", value: parts[1] };
  if (first.toLowerCase() === "user" && parts[1]) return { type: "username", value: parts[1] };
  if (first.toLowerCase() === "c" && parts[1]) return { type: "custom", value: parts[1] };
  if (first) return { type: "custom", value: first };

  const error = new Error("Impossible d’identifier la chaîne dans cette URL.");
  error.status = 400;
  throw error;
}

async function lookupChannel(params, apiKey) {
  const data = await youtubeGet("channels", { part: CHANNEL_PARTS, maxResults: 1, ...params }, apiKey);
  return data.items?.[0] || null;
}

export async function resolveChannel(channelInput, apiKey) {
  requireApiKey(apiKey);
  const reference = parseChannelReference(channelInput);
  let channel = null;
  let resolutionMethod = reference.type;
  let quotaEstimate = 0;

  if (reference.type === "id") {
    quotaEstimate += 1;
    channel = await lookupChannel({ id: reference.value }, apiKey);
  } else if (reference.type === "handle") {
    quotaEstimate += 1;
    channel = await lookupChannel({ forHandle: reference.value }, apiKey);
  } else if (reference.type === "username") {
    quotaEstimate += 1;
    channel = await lookupChannel({ forUsername: reference.value }, apiKey);
  } else {
    quotaEstimate += 1;
    channel = await lookupChannel({ forHandle: reference.value }, apiKey);
    resolutionMethod = "custom-as-handle";

    if (!channel) {
      quotaEstimate += 1;
      channel = await lookupChannel({ forUsername: reference.value }, apiKey);
      resolutionMethod = "custom-as-username";
    }

    if (!channel) {
      quotaEstimate += 100;
      const search = await youtubeGet("search", {
        part: "snippet",
        type: "channel",
        q: reference.value,
        maxResults: 5
      }, apiKey);
      const channelId = search.items?.[0]?.snippet?.channelId || search.items?.[0]?.id?.channelId;
      if (channelId) {
        quotaEstimate += 1;
        channel = await lookupChannel({ id: channelId }, apiKey);
        resolutionMethod = "search-fallback";
      }
    }
  }

  if (!channel) {
    const error = new Error("Chaîne YouTube introuvable. Essaie de coller l’URL contenant le @handle ou l’identifiant /channel/UC…");
    error.status = 404;
    throw error;
  }

  const normalized = normalizeChannel(channel, { resolutionMethod, resolutionQuotaEstimate: quotaEstimate });
  if (!normalized.uploadsPlaylistId) {
    const error = new Error("La playlist des vidéos publiées de cette chaîne est inaccessible.");
    error.status = 404;
    throw error;
  }

  return normalized;
}

export function filterPlaylistItemsByCriteria(items, {
  publishedAfter = "",
  publishedBefore = "",
  limit = null
} = {}) {
  const afterMs = publishedAfter ? new Date(publishedAfter).getTime() : null;
  const beforeMs = publishedBefore ? new Date(publishedBefore).getTime() : null;
  const parsedLimit = limit === null || limit === undefined || limit === "" ? null : Number(limit);
  const safeLimit = Number.isFinite(parsedLimit) && parsedLimit >= 0 ? Math.floor(parsedLimit) : null;

  const selected = [];
  let skippedNewerCount = 0;
  let skippedOlderCount = 0;
  let oldestPublishedAt = null;
  let newestPublishedAt = null;

  for (const item of items || []) {
    const publishedAt = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || null;
    const timestamp = publishedAt ? new Date(publishedAt).getTime() : NaN;

    if (publishedAt && !Number.isNaN(timestamp)) {
      if (!newestPublishedAt || timestamp > new Date(newestPublishedAt).getTime()) newestPublishedAt = publishedAt;
      if (!oldestPublishedAt || timestamp < new Date(oldestPublishedAt).getTime()) oldestPublishedAt = publishedAt;
    }

    if (beforeMs !== null && !Number.isNaN(timestamp) && timestamp > beforeMs) {
      skippedNewerCount += 1;
      continue;
    }
    if (afterMs !== null && !Number.isNaN(timestamp) && timestamp < afterMs) {
      skippedOlderCount += 1;
      continue;
    }
    if (safeLimit !== null && selected.length >= safeLimit) continue;
    selected.push(item);
  }

  const oldestTimestamp = oldestPublishedAt ? new Date(oldestPublishedAt).getTime() : null;
  const reachedStartBoundary = afterMs !== null && oldestTimestamp !== null && oldestTimestamp < afterMs;

  return {
    selected,
    reachedStartBoundary,
    skippedNewerCount,
    skippedOlderCount,
    oldestPublishedAt,
    newestPublishedAt
  };
}

export async function fetchChannelVideoPage({
  playlistId,
  pageToken = "",
  publishedAfter = "",
  publishedBefore = "",
  limit = null
}, apiKey) {
  requireApiKey(apiKey);
  if (!playlistId) {
    const error = new Error("L’identifiant de la playlist d’uploads est manquant.");
    error.status = 400;
    throw error;
  }

  const playlistData = await youtubeGet("playlistItems", {
    part: "contentDetails,snippet",
    playlistId,
    maxResults: 50,
    pageToken
  }, apiKey);

  const playlistItems = playlistData.items || [];
  const filteredPage = filterPlaylistItemsByCriteria(playlistItems, {
    publishedAfter,
    publishedBefore,
    limit
  });
  const videoIds = filteredPage.selected
    .map((item) => item.contentDetails?.videoId || item.snippet?.resourceId?.videoId)
    .filter(Boolean);

  let videoItems = [];
  if (videoIds.length) {
    const videoData = await youtubeGet("videos", {
      part: VIDEO_PARTS,
      id: videoIds.join(",")
    }, apiKey);
    videoItems = videoData.items || [];
  }

  const videoById = new Map(videoItems.map((video) => [video.id, video]));
  const orderedVideos = videoIds
    .map((id) => videoById.get(id))
    .filter(Boolean)
    .map((video) => normalizeVideo(video));

  const foundIds = new Set(orderedVideos.map((video) => video.id));

  return {
    videos: orderedVideos,
    notFoundIds: videoIds.filter((id) => !foundIds.has(id)),
    nextPageToken: playlistData.nextPageToken || "",
    prevPageToken: playlistData.prevPageToken || "",
    pageInfo: playlistData.pageInfo || { totalResults: 0, resultsPerPage: 50 },
    playlistItemsRead: playlistItems.length,
    matchingPlaylistItems: videoIds.length,
    reachedStartBoundary: filteredPage.reachedStartBoundary,
    pageBounds: {
      newestPublishedAt: filteredPage.newestPublishedAt,
      oldestPublishedAt: filteredPage.oldestPublishedAt
    },
    skippedNewerCount: filteredPage.skippedNewerCount,
    skippedOlderCount: filteredPage.skippedOlderCount,
    quotaEstimate: 1 + (videoIds.length ? 1 : 0)
  };
}

export async function fetchVideosWithChannels(videoIds, apiKey) {
  requireApiKey(apiKey);
  const uniqueIds = [...new Set(videoIds.map(String).map((id) => id.trim()).filter(Boolean))];
  const videoItems = [];

  for (const batch of chunks(uniqueIds, 50)) {
    const data = await youtubeGet("videos", { part: VIDEO_PARTS, id: batch.join(",") }, apiKey);
    videoItems.push(...(data.items || []));
  }

  const channelIds = [...new Set(videoItems.map((video) => video.snippet?.channelId).filter(Boolean))];
  const channelMap = new Map();

  for (const batch of chunks(channelIds, 50)) {
    const data = await youtubeGet("channels", { part: CHANNEL_PARTS, id: batch.join(",") }, apiKey);
    for (const channel of data.items || []) {
      channelMap.set(channel.id, normalizeChannel(channel));
    }
  }

  const foundIds = new Set(videoItems.map((video) => video.id));
  return {
    videos: videoItems.map((video) => normalizeVideo(video, channelMap)),
    notFoundIds: uniqueIds.filter((id) => !foundIds.has(id)),
    requested: uniqueIds.length,
    found: videoItems.length,
    quotaEstimate: Math.ceil(uniqueIds.length / 50) + Math.ceil(channelIds.length / 50)
  };
}
