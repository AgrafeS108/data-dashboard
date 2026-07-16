import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const sharedSource = await readFile(new URL("../extension/shared.js", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../extension/service-worker.js", import.meta.url), "utf8");

const stored = {};
const windows = new Map();
const tabs = new Map();
const createdWindows = [];
const createdTabs = [];
const removedTabs = [];
const removedWindows = [];
let nextWindowId = 10;
let nextTabId = 100;
let messageListener = null;

function eventTarget() {
  return { addListener() {} };
}

const chrome = {
  storage: {
    local: {
      async get(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(list.filter((key) => key in stored).map((key) => [key, stored[key]]));
      },
      async set(values) { Object.assign(stored, values); }
    }
  },
  extension: {
    isAllowedIncognitoAccess(callback) { callback(true); }
  },
  runtime: {
    id: "test-extension",
    sendMessage() { return Promise.resolve(); },
    onMessage: { addListener(listener) { messageListener = listener; } },
    onStartup: eventTarget()
  },
  windows: {
    async getAll() { return [...windows.values()].map((window) => ({ ...window, tabs: undefined })); },
    async get(id, options = {}) {
      const window = windows.get(id);
      if (!window) throw new Error("window missing");
      return { ...window, tabs: options.populate ? [...tabs.values()].filter((tab) => tab.windowId === id) : undefined };
    },
    async create(options) {
      const id = nextWindowId++;
      const anchorId = nextTabId++;
      const window = { id, incognito: Boolean(options.incognito), focused: Boolean(options.focused), state: "normal" };
      const anchor = { id: anchorId, windowId: id, url: options.url, active: true, incognito: window.incognito };
      windows.set(id, window);
      tabs.set(anchorId, anchor);
      createdWindows.push({ ...options, id });
      return { ...window, tabs: [anchor] };
    },
    async update(id, patch) {
      const window = windows.get(id);
      if (!window) throw new Error("window missing");
      Object.assign(window, patch);
      return { ...window };
    },
    async remove(id) {
      removedWindows.push(id);
      windows.delete(id);
      for (const [tabId, tab] of tabs) if (tab.windowId === id) tabs.delete(tabId);
    },
    async getLastFocused() { return { id: 1, incognito: false }; },
    onRemoved: eventTarget()
  },
  tabs: {
    async get(id) {
      const tab = tabs.get(id);
      if (!tab) throw new Error("tab missing");
      return { ...tab };
    },
    async create(options) {
      const id = nextTabId++;
      const window = windows.get(options.windowId);
      if (!window) throw new Error("window missing");
      const tab = { id, windowId: options.windowId, url: options.url, active: Boolean(options.active), incognito: window.incognito, mutedInfo: { muted: false } };
      tabs.set(id, tab);
      createdTabs.push({ ...options, id });
      return { ...tab };
    },
    async update(id, patch) {
      const tab = tabs.get(id);
      if (!tab) throw new Error("tab missing");
      if ("muted" in patch) tab.mutedInfo = { muted: patch.muted };
      Object.assign(tab, patch);
      return { ...tab };
    },
    async remove(id) { removedTabs.push(id); tabs.delete(id); },
    async sendMessage() { throw new Error("no receiver in mock"); },
    async captureVisibleTab() { return "data:image/jpeg;base64,AA=="; },
    onUpdated: eventTarget(),
    onRemoved: eventTarget()
  },
  downloads: { async download() { return 1; } },
  scripting: { async executeScript() {} },
  alarms: { async create() {}, async clear() {}, onAlarm: eventTarget() }
};

const context = vm.createContext({
  console,
  URL,
  Date,
  setTimeout,
  clearTimeout,
  chrome,
  globalThis: {},
  importScripts() {
    vm.runInContext(sharedSource, context);
  }
});
context.globalThis = context;
vm.runInContext(workerSource, context);
assert.equal(typeof messageListener, "function");

function send(message, sender = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const returned = messageListener(message, sender, (response) => {
      settled = true;
      if (response?.error) reject(new Error(response.error));
      else resolve(response);
    });
    if (returned !== true && !settled) resolve(undefined);
  });
}

await send({ type: "YT_PREROLL_SET_SETTINGS", settings: { sessionMode: "incognito-tabs", collectorMode: "visible", betweenVideosSeconds: 0, saveScreenshots: false } });
await send({ type: "YT_PREROLL_SET_QUEUE", queue: [
  { videoId: "aaa111bbb22", title: "Vidéo A", url: "https://www.youtube.com/watch?v=aaa111bbb22" },
  { videoId: "ccc333ddd44", title: "Vidéo B", url: "https://www.youtube.com/watch?v=ccc333ddd44" }
] });

let state = await send({ type: "YT_PREROLL_START" });
assert.equal(createdWindows.length, 1);
assert.equal(createdWindows[0].incognito, true);
assert.equal(createdTabs.length, 1);
assert.match(createdTabs[0].url, /aaa111bbb22/);
const firstVideoTab = state.currentTabId;
assert.ok(firstVideoTab);

await send({ type: "YT_PREROLL_TIMEOUT", token: state.currentToken, reason: "test timeout" });
await new Promise((resolve) => setTimeout(resolve, 30));
state = await send({ type: "YT_PREROLL_GET_STATE" });
assert.ok(removedTabs.includes(firstVideoTab));
assert.equal(createdWindows.length, 1, "La fenêtre privée doit être conservée pendant la file");
assert.equal(createdTabs.length, 2, "La deuxième vidéo doit créer un nouvel onglet");
assert.match(createdTabs[1].url, /ccc333ddd44/);
assert.notEqual(state.currentTabId, firstVideoTab);

const secondVideoTab = state.currentTabId;
await send({ type: "YT_PREROLL_TIMEOUT", token: state.currentToken, reason: "test timeout" });
await new Promise((resolve) => setTimeout(resolve, 30));
state = await send({ type: "YT_PREROLL_GET_STATE" });
assert.ok(removedTabs.includes(secondVideoTab));
assert.equal(state.running, false);
assert.equal(state.results.length, 2);
assert.equal(state.results[0].browsingContext, "incognito-new-tab");
assert.equal(removedWindows.length, 1, "La fenêtre privée doit être fermée à la fin");

console.log("Collector new-tab flow tests: OK");
