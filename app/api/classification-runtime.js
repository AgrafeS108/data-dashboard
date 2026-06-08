const fs = require('fs');
const path = require('path');
const vm = require('vm');

let runtime = null;

function createNoopStorage() {
  return { getItem(){ return null; }, setItem(){}, removeItem(){}, clear(){} };
}

function loadTaxonomies() {
  if (runtime) return runtime;
  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    AbortController,
    fetch: async () => { throw new Error('fetch disabled in classification runtime'); },
    localStorage: createNoopStorage(),
    sessionStorage: createNoopStorage(),
    caches: { delete(){} },
    location: { origin: 'https://localhost' },
    window: null
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const base = path.join(__dirname, 'classification-assets');
  vm.runInContext(fs.readFileSync(path.join(base, 'classification-engine.js'), 'utf8'), ctx, { filename: 'classification-engine.js' });
  vm.runInContext(fs.readFileSync(path.join(base, 'classification-title-guard.js'), 'utf8'), ctx, { filename: 'classification-title-guard.js' });

  const taxonomies = {
    sport: ctx.window.SR_SCORED || [],
    francetv: ctx.window.FTV_GENERAL_SCORED || [],
    franceinfo: ctx.window.FTV_FRANCEINFO_SCORED || [],
    francetvculture: ctx.window.FTV_CULTURE_SCORED || [],
    slash: ctx.window.FTV_SLASH_SCORED || []
  };

  runtime = buildRuntime(taxonomies);
  return runtime;
}

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function clean(value) {
  return stripAccents(String(value || '').toLowerCase())
    .replace(/[’‘`´]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9#@_+.'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function compact(value) {
  return clean(value).replace(/[^a-z0-9#]+/g, '');
}
function padded(value) {
  const c = clean(value).replace(/[.'_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return ` ${c} `;
}
function unique(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}
function termVariants(term) {
  const raw = String(term || '').trim();
  const c = clean(raw);
  const p = c.replace(/[.'_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const k = compact(raw);
  return unique([c, p, k]);
}
function prepareTerm(term) {
  return termVariants(term).map(v => ({ value:v, compact:compact(v), hashtag:v.startsWith('#'), multi:v.includes(' ') })).filter(v => v.value && v.compact);
}
const GENERIC_TERMS = new Set([
  'sport','sports','video','videos','direct','live','replay','resume','résumé','france','francais','français','francaise','française','francaises','françaises',
  'feminin','féminin','masculin','hommes','dames','femme','femmes','match','matches','finale','demi','quart','club','clubs','serie','series','saison',
  'public','official','officiel','extrait','best of','meilleur','meilleurs','avant','apres','après','jour','journée','journee'
]);
function isUsefulTerm(term, kind) {
  const raw = String(term || '').trim();
  if (!raw) return false;
  const c = clean(raw);
  const k = compact(raw);
  if (!c || !k) return false;
  if (raw.startsWith('#')) return k.length >= 4;
  if (/^\d+$/.test(k)) return false;
  if (k.length < 3) return false;
  if (GENERIC_TERMS.has(k) && !['theme_name','competition_name'].includes(kind)) return false;
  if (kind.includes('weak') && k.length < 8 && !c.includes(' ')) return false;
  return true;
}
function containsPreparedTerm(field, fieldPadded, fieldCompact, prepared) {
  if (!field || !prepared || !prepared.length) return false;
  for (const variant of prepared) {
    if (variant.hashtag) {
      if (fieldCompact.includes(variant.compact)) return true;
      continue;
    }
    if (variant.multi) {
      if (field.includes(variant.value) || fieldPadded.includes(` ${variant.value} `)) return true;
    } else {
      if (fieldPadded.includes(` ${variant.value} `)) return true;
      if (variant.compact.length >= 8 && fieldCompact.includes(variant.compact)) return true;
    }
  }
  return false;
}
function metaForTheme(theme, fallbackIcon) {
  return { i: theme?.i || fallbackIcon || '•', bg: theme?.bg || '#F5F7FA', fg: theme?.fg || '#344054' };
}
function fallbackForChannel(channel) {
  if (channel === 'sport') {
    return { s:'Autres sports', c:'Non classé', i:'•', bg:'#F5F7FA', fg:'#5A5A5A', confidence:'low', source:'fallback', score:0, keywords:[] };
  }
  return { s:'Autres contenus', c:'Non classé', i:'•', bg:'#F5F7FA', fg:'#5A5A5A', confidence:'low', source:'fallback', score:0, keywords:[] };
}
function addRule(bucket, channel, theme, comp, term, baseWeight, kind) {
  if (!isUsefulTerm(term, kind)) return;
  const meta = metaForTheme(theme);
  bucket.push({
    channel,
    sport: theme.s || 'Contenu',
    competition: comp?.n || theme.s || 'Non classé',
    term: String(term || '').trim(),
    prepared: prepareTerm(term),
    baseWeight,
    kind,
    meta
  });
}
function buildRulesForChannel(channel, catalog) {
  const rules = [];
  (catalog || []).forEach(theme => {
    (theme.comps || []).forEach(comp => {
      addRule(rules, channel, theme, comp, comp.n, 1650, 'competition_name');
      (comp.strong || []).forEach(term => addRule(rules, channel, theme, comp, term, 1500, 'competition_strong'));
      (comp.medium || []).forEach(term => addRule(rules, channel, theme, comp, term, 900, 'competition_medium'));
      (comp.weak || []).forEach(term => addRule(rules, channel, theme, comp, term, 520, 'competition_weak'));
    });
    addRule(rules, channel, theme, null, theme.s, 760, 'theme_name');
    (theme.strong || []).forEach(term => addRule(rules, channel, theme, null, term, 700, 'theme_strong'));
    (theme.medium || []).forEach(term => addRule(rules, channel, theme, null, term, 360, 'theme_medium'));
    (theme.weak || []).forEach(term => addRule(rules, channel, theme, null, term, 90, 'theme_weak'));
  });
  return rules.sort((a,b) => b.baseWeight - a.baseWeight);
}
function emojiRule(title, channel, rulesByChannel) {
  if (channel !== 'sport') return null;
  const map = [
    [/🏉/, 'Rugby', 'emoji_rugby'],
    [/🎾/, 'Tennis', 'emoji_tennis'],
    [/⚽/, 'Football', 'emoji_football'],
    [/🏀/, 'Basket-ball', 'emoji_basket'],
    [/🚴/, 'Cyclisme', 'emoji_cycling'],
    [/🏊/, 'Natation', 'emoji_swimming'],
    [/⛷️|🎿|🏂/, 'Ski & Hiver', 'emoji_winter']
  ];
  const found = map.find(([re]) => re.test(String(title || '')));
  if (!found) return null;
  const [, sport, source] = found;
  const rule = (rulesByChannel.sport || []).find(r => r.sport === sport && r.kind === 'theme_name') || (rulesByChannel.sport || []).find(r => r.sport === sport);
  const meta = rule?.meta || { i:'•', bg:'#F5F7FA', fg:'#344054' };
  return { s:sport, c:sport, i:meta.i, bg:meta.bg, fg:meta.fg, confidence:'high', source, score:3200, keywords:[source] };
}
function scoreRules(video, channel, rulesByChannel) {
  const title = String(video.title || video.snippet?.title || '');
  const description = String(video.description || video.snippet?.description || '').slice(0, 1000);
  const tagText = Array.isArray(video.tags) ? video.tags.join(' ') : '';
  const fields = {
    title: { clean: clean(title), padded: padded(title), compact: compact(title), multiplier: 3.8, bonus: 420 },
    tags: { clean: clean(tagText), padded: padded(tagText), compact: compact(tagText), multiplier: 1.25, bonus: 0 },
    description: { clean: clean(description), padded: padded(description), compact: compact(description), multiplier: 0.22, bonus: 0 }
  };
  const rules = rulesByChannel[channel] || rulesByChannel.sport || [];
  const byKey = new Map();
  let bestTitle = emojiRule(title, channel, rulesByChannel);

  for (const rule of rules) {
    let score = 0;
    const hits = [];
    if (containsPreparedTerm(fields.title.clean, fields.title.padded, fields.title.compact, rule.prepared)) {
      score += rule.baseWeight * fields.title.multiplier + fields.title.bonus;
      if (String(rule.term).startsWith('#')) score += 500;
      hits.push(`title:${rule.term}`);
    }
    if (containsPreparedTerm(fields.tags.clean, fields.tags.padded, fields.tags.compact, rule.prepared)) {
      score += rule.baseWeight * fields.tags.multiplier;
      hits.push(`tags:${rule.term}`);
    }
    if (containsPreparedTerm(fields.description.clean, fields.description.padded, fields.description.compact, rule.prepared)) {
      score += rule.baseWeight * fields.description.multiplier;
      hits.push(`desc:${rule.term}`);
    }
    if (!score) continue;
    const key = `${rule.sport}|||${rule.competition}`;
    const cur = byKey.get(key) || { rule, score:0, hits:[] };
    cur.score += score;
    cur.hits.push(...hits.slice(0, 4));
    byKey.set(key, cur);

    if (hits.some(h => h.startsWith('title:'))) {
      const titleScore = rule.baseWeight * fields.title.multiplier + fields.title.bonus;
      if (!bestTitle || titleScore > bestTitle.score) {
        bestTitle = { s:rule.sport, c:rule.competition, i:rule.meta.i, bg:rule.meta.bg, fg:rule.meta.fg, confidence:'high', source:`title_${rule.kind}`, score:titleScore, keywords:[`title:${rule.term}`] };
      }
    }
  }

  const ranked = [...byKey.values()].sort((a,b) => b.score - a.score);
  const bestAll = ranked[0];
  if (bestTitle && bestTitle.score >= 2600) return bestTitle;
  if (bestAll) {
    const rule = bestAll.rule;
    const allResult = { s:rule.sport, c:rule.competition, i:rule.meta.i, bg:rule.meta.bg, fg:rule.meta.fg, confidence: bestAll.score >= 2500 ? 'high' : bestAll.score >= 900 ? 'medium' : 'low', source:'admin_taxonomy', score:Math.round(bestAll.score), keywords:unique(bestAll.hits).slice(0, 10) };
    // Le titre reste le juge final : une description/tag ne peut pas déplacer un titre clair.
    if (bestTitle && bestTitle.s !== allResult.s && bestTitle.score >= 1400) return bestTitle;
    if (bestTitle && bestTitle.c !== allResult.c && bestTitle.score >= 2600) return bestTitle;
    if (bestAll.score >= 600) return allResult;
  }
  if (bestTitle && bestTitle.score >= 1200) return bestTitle;
  return fallbackForChannel(channel);
}
function parseDurationSeconds(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.round(raw));
  const value = String(raw || '').trim();
  if (/^\d+(?:\.\d+)?$/.test(value)) return Math.max(0, Math.round(Number(value)));
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(value);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}
let emojiRegex;
try { emojiRegex = new RegExp('[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{1F000}-\\u{1F2FF}]', 'u'); } catch(e) { emojiRegex = /[☀-➿]/; }
function hasHashtag(title) { return /#[\w\u00C0-\u017F]+/.test(String(title || '')); }
function hasEmoji(title) { return emojiRegex.test(String(title || '')); }
function explicitLong(title) { return /resume complet|résumé complet|integralite|intégralité|match complet|course complete|course complète|replay intégral|replay integral|documentaire|magazine|interview complète|interview complete|conférence de presse|conference de presse|en intégralité|en integralite|l'intégrale|l’integrale|l’intégrale/i.test(String(title || '')); }
function structuredLong(title) { return /^[^:|—–]{3,}\s+[:|—–]\s*\S/.test(String(title || '').trim()) || /^[^:|—–\-]{3,}\s+-\s+\S/.test(String(title || '').trim()); }
function classifyType(title, durationSeconds, isLive) {
  if (isLive) return 'live';
  const t = String(title || '').trim();
  const secs = Number(durationSeconds) || 0;
  if (/(^|\s)#?shorts?(\s|$)/i.test(t)) return 'short';
  if (explicitLong(t)) return 'video';
  if (hasHashtag(t) || hasEmoji(t)) {
    if (!secs || secs < 240) return 'short';
    if (secs >= 240 && structuredLong(t)) return 'video';
    if (secs >= 600) return 'video';
    return 'short';
  }
  if (secs > 0 && secs < 180) return structuredLong(t) && secs >= 165 ? 'video' : 'short';
  if (secs >= 180) return 'video';
  if (structuredLong(t)) return 'video';
  return 'video';
}
function buildRuntime(taxonomies) {
  const rulesByChannel = Object.fromEntries(Object.entries(taxonomies).map(([channel, catalog]) => [channel, buildRulesForChannel(channel, catalog)]));
  return {
    classify(video) {
      const channel = String(video?.channelKey || video?.channel || 'sport');
      return scoreRules(video || {}, channel, rulesByChannel);
    },
    classifyType,
    parseDurationSeconds,
    stats: Object.fromEntries(Object.entries(rulesByChannel).map(([k, v]) => [k, v.length]))
  };
}
function classifyVideoForSnapshot(video) {
  const rt = loadTaxonomies();
  const channel = String(video?.channelKey || video?.channel || 'sport');
  const durationSeconds = parseDurationSeconds(video?.duration ?? video?.durationSeconds);
  const isLive = video?.type === 'live' || !!video?.liveStreamingDetails?.actualStartTime;
  const cls = rt.classify({ ...video, channelKey: channel, durationSeconds });
  const type = rt.classifyType(video?.title || '', durationSeconds, isLive);
  return {
    type,
    contentType: type,
    durationSeconds,
    sport: cls.s,
    competition: cls.c,
    classification: {
      sport: cls.s,
      competition: cls.c,
      icon: cls.i,
      bg: cls.bg,
      fg: cls.fg,
      confidence: cls.confidence,
      source: cls.source,
      score: cls.score,
      keywords: cls.keywords || []
    }
  };
}
function isSnapshotClassified(snapshot) {
  const videos = Array.isArray(snapshot?.videos) ? snapshot.videos : [];
  if (!videos.length) return false;
  const checked = videos.slice(0, Math.min(25, videos.length));
  return checked.every(v => v && v.classification && (v.sport || v.classification.sport) && (v.competition || v.classification.competition) && (v.contentType || v.type));
}
function classifySnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.videos)) return snapshot;
  const videos = snapshot.videos.map(v => ({ ...v, ...classifyVideoForSnapshot(v) }));
  return { ...snapshot, videos, classificationReady: true, classifiedAt: new Date().toISOString(), classificationStats: loadTaxonomies().stats };
}

module.exports = { classifyVideoForSnapshot, classifySnapshot, isSnapshotClassified, parseDurationSeconds };
