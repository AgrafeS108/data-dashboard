const fs = require('fs');
const path = require('path');

const CLASSIFICATION_PROFILE = 'server-single-source-rebuild';

let runtime = null;

function loadTaxonomies() {
  if (runtime) return runtime;
  const file = path.join(__dirname, 'classification-taxonomy.json');
  const taxonomies = JSON.parse(fs.readFileSync(file, 'utf8'));
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

const UMBRELLA_THEMES = new Set(['Sports Olympiques', 'Judo & Combat', 'Sports Urbains']);
const SPECIFIC_TITLE_ALIASES = [
  { sport:'Tennis de table', remove:['Tennis'], terms:['tennis de table','table tennis','ping pong','ping-pong','#tabletennis','#tennisdetable'] },
  { sport:'Football US', remove:['Football'], terms:['football us','nfl','super bowl','ncaaf','#nfl'] },
  { sport:'Para sport', remove:['Tennis'], terms:['tennis fauteuil','wheelchair tennis','para tennis'] }
];
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
  const ambiguousCompetitionNames = new Set([
    'coupedumonde','championnatsdumonde','championnatdumonde','mondiaux','euro','championnatsdeurope','championnatdeurope','coupedefrance','equipedefrance','liguedeschampions','grandprix','coupedumonde2026','championnatsdefrance','championnatdefrance','jeuxolympiques','jo'
  ]);
  if (kind === 'competition_context_name') return k.length >= 3 && !/^\d+$/.test(k);
  if (kind === 'competition_name' && (ambiguousCompetitionNames.has(k) || k.startsWith('equipedefrance') || k.startsWith('coupedumonde') || k.startsWith('championnatsdumonde') || k.startsWith('championnatdumonde') || k.startsWith('championnatsdeurope') || k.startsWith('championnatdeurope') || k.startsWith('championnatsdefrance') || k.startsWith('championnatdefrance') || k.startsWith('euro'))) return false;
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
      if (fieldPadded.includes(` ${variant.value} `)) return true;
      if (variant.compact.length >= 8 && fieldCompact.includes(variant.compact)) return true;
    } else {
      if (fieldPadded.includes(` ${variant.value} `)) return true;
    }
  }
  return false;
}
function metaForTheme(theme, fallbackIcon) {
  return { i: theme?.i || fallbackIcon || '•', bg: theme?.bg || '#F5F7FA', fg: theme?.fg || '#344054' };
}
function fallbackForChannel(channel) {
  if (channel === 'sport') {
    return { s:'À vérifier', c:'Non classé', i:'•', bg:'#F5F7FA', fg:'#5A5A5A', confidence:'low', source:'fallback', score:0, keywords:[] };
  }
  return { s:'À vérifier', c:'Non classé', i:'•', bg:'#F5F7FA', fg:'#5A5A5A', confidence:'low', source:'fallback', score:0, keywords:[] };
}
function addRule(bucket, channel, theme, comp, term, baseWeight, kind, options = {}) {
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
    contextOnly: !!options.contextOnly,
    meta
  });
}
function buildRulesForChannel(channel, catalog) {
  const rules = [];
  (catalog || []).forEach(theme => {
    (theme.comps || []).forEach(comp => {
      addRule(rules, channel, theme, comp, comp.n, 1650, 'competition_name');
      // Règle de contexte : un nom de compétition ambigu (Coupe du Monde, Euro, Équipe de France...)
      // devient fiable uniquement quand le titre contient aussi le sport/la catégorie.
      addRule(rules, channel, theme, comp, comp.n, 1000, 'competition_context_name', { contextOnly:true });
      (comp.strong || []).forEach(term => addRule(rules, channel, theme, comp, term, 1750, 'competition_strong'));
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
    title: { clean: clean(title), padded: padded(title), compact: compact(title), multiplier: 4.4, bonus: 620 },
    tags: { clean: clean(tagText), padded: padded(tagText), compact: compact(tagText), multiplier: 1.25, bonus: 0 },
    description: { clean: clean(description), padded: padded(description), compact: compact(description), multiplier: 0.08, bonus: 0 }
  };
  const rules = rulesByChannel[channel] || rulesByChannel.sport || [];
  const explicitThemeMatches = [];
  for (const rule of rules) {
    if (rule.kind === 'theme_name' && containsPreparedTerm(fields.title.clean, fields.title.padded, fields.title.compact, rule.prepared)) {
      explicitThemeMatches.push({ sport:rule.sport, compact:compact(rule.term), len:compact(rule.term).length });
    }
  }
  const explicitTitleSports = new Set(explicitThemeMatches.filter(match => {
    return !explicitThemeMatches.some(other => other.sport !== match.sport && !UMBRELLA_THEMES.has(other.sport) && other.len > match.len && other.compact.includes(match.compact));
  }).map(match => match.sport));
  for (const alias of SPECIFIC_TITLE_ALIASES) {
    if (alias.terms.some(term => containsPreparedTerm(fields.title.clean, fields.title.padded, fields.title.compact, prepareTerm(term)))) {
      explicitTitleSports.add(alias.sport);
      (alias.remove || []).forEach(sport => explicitTitleSports.delete(sport));
    }
  }
  if (explicitTitleSports.size > 1) {
    const bySport = new Map(explicitThemeMatches.map(m => [m.sport, m]));
    for (const sport of [...explicitTitleSports]) {
      if (!UMBRELLA_THEMES.has(sport)) continue;
      const umbrella = bySport.get(sport);
      const others = [...explicitTitleSports].filter(other => other !== sport && !UMBRELLA_THEMES.has(other)).map(other => bySport.get(other)).filter(Boolean);
      if (!others.length) continue;
      const othersOnlySubstringsOfUmbrella = others.every(other => umbrella?.compact && umbrella.compact.includes(other.compact));
      if (othersOnlySubstringsOfUmbrella) {
        others.forEach(other => explicitTitleSports.delete(other.sport));
      } else {
        explicitTitleSports.delete(sport);
      }
    }
  }
  const hasExplicitTitleSport = explicitTitleSports.size > 0;
  const byKey = new Map();
  let bestTitle = emojiRule(title, channel, rulesByChannel);
  let bestExactHashtag = null;
  for (const rule of rules) {
    if (!String(rule.term || '').startsWith('#')) continue;
    if (containsPreparedTerm(fields.title.clean, fields.title.padded, fields.title.compact, rule.prepared)) {
      const score = 25000 + compact(rule.term).length * 100;
      if (!bestExactHashtag || score > bestExactHashtag.score) bestExactHashtag = { s:rule.sport, c:rule.competition, i:rule.meta.i, bg:rule.meta.bg, fg:rule.meta.fg, confidence:'high', source:'title_exact_hashtag', score, keywords:[`title:${rule.term}`] };
    }
  }
  if (bestExactHashtag) return bestExactHashtag;

  for (const rule of rules) {
    if (rule.contextOnly && !explicitTitleSports.has(rule.sport)) continue;
    // Si le titre indique explicitement un sport/catégorie, les tags et descriptions d'autres sports ne peuvent pas gagner.
    const sameExplicitSport = !hasExplicitTitleSport || explicitTitleSports.has(rule.sport);
    let score = 0;
    const hits = [];
    if (sameExplicitSport && containsPreparedTerm(fields.title.clean, fields.title.padded, fields.title.compact, rule.prepared)) {
      const contextBoost = rule.contextOnly ? 1500 : (hasExplicitTitleSport && explicitTitleSports.has(rule.sport) && rule.kind.startsWith('competition') ? 1200 : 0);
      const phraseBoost = rule.kind.startsWith('competition') && rule.prepared.some(p => p.multi) && compact(rule.term).length >= 8 ? 3600 : 0;
      score += rule.baseWeight * fields.title.multiplier + fields.title.bonus + Math.min(2500, compact(rule.term).length * 80) + contextBoost + phraseBoost;
      if (String(rule.term).startsWith('#')) score += 5200;
      hits.push(`title:${rule.term}`);
    }
    if (!rule.contextOnly && sameExplicitSport && containsPreparedTerm(fields.tags.clean, fields.tags.padded, fields.tags.compact, rule.prepared)) {
      score += rule.baseWeight * fields.tags.multiplier;
      hits.push(`tags:${rule.term}`);
    }
    if (!rule.contextOnly && sameExplicitSport && containsPreparedTerm(fields.description.clean, fields.description.padded, fields.description.compact, rule.prepared)) {
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
      const titleScore = rule.baseWeight * fields.title.multiplier + fields.title.bonus + Math.min(2500, compact(rule.term).length * 80) + (rule.contextOnly ? 1500 : (hasExplicitTitleSport && explicitTitleSports.has(rule.sport) && rule.kind.startsWith('competition') ? 1200 : 0)) + (rule.kind.startsWith('competition') && rule.prepared.some(p => p.multi) && compact(rule.term).length >= 8 ? 3600 : 0);
      if (!bestTitle || titleScore > bestTitle.score) {
        bestTitle = { s:rule.sport, c:rule.competition, i:rule.meta.i, bg:rule.meta.bg, fg:rule.meta.fg, confidence:'high', source:`title_${rule.kind}`, score:titleScore, keywords:[`title:${rule.term}`] };
      }
    }
  }

  const ranked = [...byKey.values()].sort((a,b) => b.score - a.score);
  const bestAll = ranked[0];
  if (bestAll) {
    const rule = bestAll.rule;
    const allResult = { s:rule.sport, c:rule.competition, i:rule.meta.i, bg:rule.meta.bg, fg:rule.meta.fg, confidence: bestAll.score >= 2500 ? 'high' : bestAll.score >= 900 ? 'medium' : 'low', source:'admin_taxonomy', score:Math.round(bestAll.score), keywords:unique(bestAll.hits).slice(0, 10) };
    // Le titre reste le juge final : une description/tag ne peut pas déplacer un titre clair.
    if (bestTitle && bestTitle.s !== allResult.s && bestTitle.score >= 1400) return bestTitle;
    if (bestTitle && bestTitle.c !== allResult.c && bestTitle.score >= 2600) return bestTitle;
    if (bestAll.score >= 900) return allResult;
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
    if (!secs || secs < 300) return 'short';
    if (secs >= 300 && structuredLong(t)) return 'video';
    if (secs >= 720) return 'video';
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
      keywords: cls.keywords || [],
      profile: CLASSIFICATION_PROFILE
    },
    classificationProfile: CLASSIFICATION_PROFILE
  };
}
function isSnapshotClassified(snapshot) {
  const videos = Array.isArray(snapshot?.videos) ? snapshot.videos : [];
  if (!videos.length) return false;
  const checked = videos.slice(0, Math.min(25, videos.length));
  if (!snapshot.classificationReady || snapshot.classificationProfile !== CLASSIFICATION_PROFILE) return false;
  return checked.every(v => v && v.classification && (v.sport || v.classification.sport) && (v.competition || v.classification.competition) && (v.contentType || v.type) && ((v.classification.profile || v.classificationProfile) === CLASSIFICATION_PROFILE));
}
function classifySnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.videos)) return snapshot;
  const videos = snapshot.videos.map(v => ({ ...v, ...classifyVideoForSnapshot(v) }));
  return { ...snapshot, videos, classificationReady: true, classificationProfile: CLASSIFICATION_PROFILE, classifiedAt: new Date().toISOString(), classificationStats: loadTaxonomies().stats };
}

module.exports = { classifyVideoForSnapshot, classifySnapshot, isSnapshotClassified, parseDurationSeconds, CLASSIFICATION_PROFILE };
