(function(){
  'use strict';

  const rawClassify = typeof window.classify === 'function' ? window.classify : null;
  const rawClassifyType = typeof window.classifyType === 'function' ? window.classifyType : null;
  let classifyCache = new WeakMap();

  function stripAccents(s){ return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function clean(s){
    return stripAccents(String(s || '').toLowerCase())
      .replace(/[’‘`´]/g, ' ')
      .replace(/[–—]/g, '-')
      .replace(/&/g, ' et ')
      .replace(/[^a-z0-9#@_+.'-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function compact(s){ return clean(s).replace(/[^a-z0-9#]+/g, ''); }
  function padded(s){ const c = clean(s).replace(/[.'_-]+/g, ' ').replace(/\s+/g, ' ').trim(); return ` ${c} `; }
  function escapeRegExp(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function uniq(arr){ return [...new Set((arr || []).filter(Boolean))]; }

  function getTitle(input){ return input && typeof input === 'object' ? (input.title || input.snippet?.title || '') : String(input || ''); }
  function getDescription(input, fallback=''){
    return input && typeof input === 'object' ? (input.description || input.snippet?.description || '') : String(fallback || '');
  }
  function getTags(input, tagsArg=[]){
    if (input && typeof input === 'object') return Array.isArray(input.tags) ? input.tags : (Array.isArray(input.snippet?.tags) ? input.snippet.tags : []);
    return Array.isArray(tagsArg) ? tagsArg : [];
  }
  function getChannel(input){ return input && typeof input === 'object' ? (input.channelKey || input.channel || window.currentChannelKey || 'sport') : (window.currentChannelKey || 'sport'); }
  function getDuration(input){
    if (!input || typeof input !== 'object') return 0;
    if (window.getVideoDurationSecs) return Number(window.getVideoDurationSecs(input)) || 0;
    if (window.getDurationSecs) return Number(window.getDurationSecs(input.duration || input.contentDetails?.duration)) || 0;
    return Number(input.durationSecs || input.durationSeconds || input.duration) || 0;
  }
  function sourcesFor(input, tagsArg=[], descriptionArg=''){
    const title = getTitle(input);
    const description = getDescription(input, descriptionArg);
    const tags = getTags(input, tagsArg);
    const tagText = tags.join(' ');
    const titleClean = clean(title);
    const descriptionClean = clean(description);
    const tagsClean = clean(tagText);
    return {
      rawTitle: title,
      rawDescription: description,
      rawTags: tagText,
      title: titleClean,
      description: descriptionClean,
      tags: tagsClean,
      titlePadded: padded(title),
      descPadded: padded(description),
      tagsPadded: padded(tagText),
      all: clean([title, description, tagText].join(' ')),
      allPadded: padded([title, description, tagText].join(' ')),
      titleCompact: compact(title),
      allCompact: compact([title, description, tagText].join(' ')),
      channel: getChannel(input),
      durationSecs: getDuration(input),
      isLive: !!(input && typeof input === 'object' && (input.type === 'live' || input.liveStreamingDetails?.actualStartTime))
    };
  }

  function termVariants(term){
    const c = clean(term);
    const p = c.replace(/[.'_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const k = compact(term);
    return uniq([c, p, k].filter(x => x && x.length >= 2));
  }
  function containsTerm(field, fieldPadded, fieldCompact, term){
    const raw = String(term || '').trim();
    if (!raw) return false;
    const vars = termVariants(raw);
    for (const v of vars) {
      if (!v) continue;
      if (v.startsWith('#')) {
        const noHash = v.replace(/^#+/, '');
        if (fieldCompact.includes(v) || (noHash.length >= 3 && fieldCompact.includes(noHash))) return true;
        continue;
      }
      const isShort = v.length <= 3 && !/\s/.test(v);
      if (isShort) {
        if (new RegExp(`(^|\\s)${escapeRegExp(v)}($|\\s)`).test(field)) return true;
      } else if (/\s/.test(v)) {
        if (fieldPadded.includes(` ${v} `) || field.includes(v)) return true;
      } else {
        if (fieldPadded.includes(` ${v} `)) return true;
        if (v.length >= 5 && fieldCompact.includes(v)) return true;
      }
    }
    return false;
  }
  function matchList(list, field, fieldPadded, fieldCompact){
    const hits = [];
    for (const term of (list || [])) if (containsTerm(field, fieldPadded, fieldCompact, term)) hits.push(term);
    return uniq(hits);
  }

  function catalogForChannel(channel){
    if (channel === 'francetv') return window.FTV_GENERAL_SCORED || [];
    if (channel === 'franceinfo') return window.FTV_FRANCEINFO_SCORED || [];
    if (channel === 'francetvculture') return window.FTV_CULTURE_SCORED || [];
    if (channel === 'slash') return window.FTV_SLASH_SCORED || [];
    return window.SR_SCORED || [];
  }
  function fallbackForChannel(channel){
    if (channel === 'sport') return {s:'Sports généralistes', c:'Contenu sport général', i:'🏟️', bg:'#F5F7FA', fg:'#344054'};
    return {s:'Contenu', c:'Non classé', i:'📺', bg:'#F5F7FA', fg:'#344054'};
  }

  function allCompTerms(comp){
    return uniq([comp?.n, ...(comp?.strong || []), ...(comp?.medium || []), ...(comp?.weak || [])]);
  }
  function allThemeTerms(theme){
    return uniq([theme?.s, ...(theme?.strong || []), ...(theme?.medium || []), ...(theme?.weak || [])]);
  }
  function scoreBucket(terms, src, weights, label){
    const titleHits = matchList(terms, src.title, src.titlePadded, src.titleCompact);
    const tagHits = matchList(terms, src.tags, src.tagsPadded, compact(src.tags));
    const descHits = matchList(terms, src.description, src.descPadded, compact(src.description));
    const score = titleHits.length * weights.title + tagHits.length * weights.tags + descHits.length * weights.description;
    const hits = [
      ...titleHits.map(x => `${label}.title:${x}`),
      ...tagHits.map(x => `${label}.tags:${x}`),
      ...descHits.map(x => `${label}.description:${x}`)
    ];
    return {score, titleScore:titleHits.length * weights.title, hits, titleHits, tagHits, descHits};
  }

  function scoreTheme(theme, src){
    const strong = scoreBucket(theme.strong || [], src, {title:34, tags:8, description:5}, 'strong');
    const medium = scoreBucket(theme.medium || [], src, {title:18, tags:4, description:2}, 'medium');
    const weak = scoreBucket(theme.weak || [], src, {title:7, tags:1.5, description:0.5}, 'weak');
    const name = scoreBucket([theme.s], src, {title:28, tags:4, description:1.5}, 'name');
    let score = strong.score + medium.score + weak.score + name.score;
    let titleScore = strong.titleScore + medium.titleScore + weak.titleScore + name.titleScore;
    let bestComp = null;
    let bestCompScore = 0;
    let bestCompTitleScore = 0;
    let compHits = [];

    for (const comp of (theme.comps || [])) {
      const compName = scoreBucket([comp.n], src, {title:58, tags:10, description:6}, 'competitionName');
      const compStrong = scoreBucket(comp.strong || [], src, {title:64, tags:12, description:7}, 'competitionStrong');
      const compMedium = scoreBucket(comp.medium || [], src, {title:34, tags:6, description:3}, 'competitionMedium');
      const compWeak = scoreBucket(comp.weak || [], src, {title:13, tags:2, description:1}, 'competitionWeak');
      const cScore = compName.score + compStrong.score + compMedium.score + compWeak.score;
      const cTitle = compName.titleScore + compStrong.titleScore + compMedium.titleScore + compWeak.titleScore;
      if (cScore > bestCompScore) {
        bestComp = comp.n;
        bestCompScore = cScore;
        bestCompTitleScore = cTitle;
        compHits = [...compName.hits, ...compStrong.hits, ...compMedium.hits, ...compWeak.hits];
      }
    }
    score += bestCompScore;
    titleScore += bestCompTitleScore;
    const hits = [...name.hits, ...strong.hits, ...medium.hits, ...weak.hits, ...compHits];
    return {theme, score, titleScore, bestComp, bestCompScore, bestCompTitleScore, hits};
  }

  function rankCatalog(catalog, src){
    const ranked = (catalog || []).map(theme => scoreTheme(theme, src)).sort((a,b) => b.score - a.score);
    return {best: ranked[0] || null, second: ranked[1] || null, ranked};
  }
  function rankTitleOnly(catalog, src){
    const ranked = (catalog || []).map(theme => {
      const r = scoreTheme(theme, src);
      return {...r, score:r.titleScore};
    }).sort((a,b) => b.score - a.score);
    return {best: ranked[0] || null, second: ranked[1] || null, ranked};
  }
  function decorate(hit, fallbackComp, confidence, reason){
    const theme = hit?.theme || {};
    return {
      s: theme.s || fallbackComp?.s || 'Contenu',
      c: hit?.bestComp || fallbackComp?.c || 'Non classé',
      i: theme.i || fallbackComp?.i || '📺',
      bg: theme.bg || fallbackComp?.bg || '#F5F7FA',
      fg: theme.fg || fallbackComp?.fg || '#344054',
      _debug:{confidence, score:hit?.score || 0, second:hit?.secondScore || 0, reason, kws:hit?.hits || [], comp:hit?.bestComp || null}
    };
  }

  function categoricalClassify(input, tags=[], description=''){
    const src = sourcesFor(input, tags, description);
    const channel = src.channel;
    const catalog = catalogForChannel(channel);
    const fallback = fallbackForChannel(channel);
    const videoId = input && typeof input === 'object' ? (input.id || input.videoId) : null;

    if (videoId && window.FTVLearning?.getOverride) {
      const ov = window.FTVLearning.getOverride(videoId);
      if (ov && ov.sport) {
        const rules = catalogForChannel(channel);
        const meta = (rules || []).find(x => x.s === ov.sport) || (window.SR_SCORED || []).find(x => x.s === ov.sport) || fallback;
        return {s:ov.sport, c:ov.comp || 'Correction manuelle', i:meta.i || '✋', bg:meta.bg || '#F5F7FA', fg:meta.fg || '#344054', _debug:{confidence:'manual_override', score:9999, kws:['manual override']}};
      }
    }

    const titleRank = rankTitleOnly(catalog, src);
    const tb = titleRank.best;
    const ts = titleRank.second;
    const titleGap = (tb?.score || 0) - (ts?.score || 0);

    // Règle générale : le titre est souverain. Si le titre contient un signal
    // net pour une compétition/catégorie ou un sport/thème, les tags et la
    // description n'ont pas le droit de déplacer la vidéo ailleurs.
    if (tb && tb.score >= 58 && (titleGap >= 12 || tb.bestCompTitleScore >= 58 || tb.score >= 95)) {
      tb.secondScore = ts?.score || 0;
      return decorate(tb, fallback, 'title_categorical', 'title_first_all_taxonomies');
    }

    const fullRank = rankCatalog(catalog, src);
    const fb = fullRank.best;
    const fs = fullRank.second;
    const fullGap = (fb?.score || 0) - (fs?.score || 0);

    let base = null;
    try { base = rawClassify ? rawClassify(input, tags, description) : null; } catch(e) { base = null; }

    // Si le moteur historique propose un résultat qui contredit un titre déjà
    // lisible, on l'annule. Cela s'applique à tous les sports, compétitions et
    // taxonomies de chaînes, pas à un cas particulier.
    if (tb && tb.score >= 34 && base && base.s && base.s !== tb.theme.s && titleGap >= 8) {
      tb.secondScore = ts?.score || 0;
      return decorate(tb, fallback, 'title_override', 'historic_result_contradicted_title');
    }

    // Si aucune compétition/catégorie n'est visible dans le titre, on accepte le
    // scoring complet, mais seulement avec un minimum de confiance. Tags et
    // descriptions peuvent aider, pas inventer une catégorie absurde.
    if (fb && fb.score >= 18 && (fullGap >= 4 || fb.bestCompScore >= 18 || fb.score >= 45)) {
      fb.secondScore = fs?.score || 0;
      return decorate(fb, fallback, fb.score >= 45 || fb.bestCompScore >= 28 ? 'high' : 'medium', 'full_taxonomy_score');
    }

    if (base && base.s && base.c) return base;
    return {...fallback, _debug:{confidence:'fallback', score:0, kws:[], reason:'no_taxonomy_signal'}};
  }

  function classifySignature(input, tags=[], description=''){
    if (!input || typeof input !== 'object') return null;
    return [
      input.id || input.videoId || '',
      input.channelKey || '',
      getTitle(input),
      getDescription(input, description).slice(0, 600),
      getTags(input, tags).join('|'),
      getDuration(input),
      input.type || ''
    ].join('§');
  }

  window.classify = function(input, tags=[], description=''){
    const canCache = input && typeof input === 'object' && (!tags || tags.length === 0) && !description;
    const sig = canCache ? classifySignature(input, tags, description) : null;
    if (canCache && classifyCache.has(input)) {
      const cached = classifyCache.get(input);
      if (cached && cached.sig === sig) return cached.value;
    }
    const value = categoricalClassify(input, tags, description);
    if (canCache) classifyCache.set(input, {sig, value});
    return value;
  };

  window.invalidateClassifyCache = function(){ classifyCache = new WeakMap(); };

  // Différenciation formats : titre avec # ou emoji = short par défaut, surtout
  // sous 3 minutes. Une vidéo longue explicite reste vidéo.
  try { window.FTV_EMOJI_RE = window.FTV_EMOJI_RE || new RegExp('[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{1F000}-\\u{1F2FF}]','u'); } catch(e) { window.FTV_EMOJI_RE = window.FTV_EMOJI_RE || /[☀-➿]/; }
  function hasHashtag(title){ return /#[\w\u00C0-\u017F]+/.test(String(title || '')); }
  function hasEmoji(title){ return window.FTV_EMOJI_RE.test(String(title || '')); }
  function explicitLong(title){ return /resume complet|résumé complet|integralite|intégralité|match complet|course complete|course complète|replay intégral|replay integral|documentaire|magazine|interview complète|interview complete|conférence de presse|conference de presse|en intégralité|en integralite|l'intégrale|l’integrale|l’intégrale/i.test(String(title || '')); }
  function structuredLong(title){ return /^[^:|—–]{3,}\s+[:|—–]\s*\S/.test(String(title || '').trim()) || /^[^:|—–\-]{3,}\s+-\s+\S/.test(String(title || '').trim()); }

  window.classifyType = function(title, durationSecs, isLive){
    if (isLive) return 'live';
    const t = String(title || '').trim();
    const secs = Number(durationSecs) || 0;
    const hash = hasHashtag(t);
    const emoji = hasEmoji(t);
    const explicitShort = /(^|\s)#?shorts?(\s|$)/i.test(t);
    const long = explicitLong(t);
    const structured = structuredLong(t);
    if (explicitShort) return 'short';
    if (long) return 'video';
    if (hash || emoji) {
      if (!secs || secs < 240) return 'short';
      if (secs >= 240 && structured) return 'video';
      if (secs >= 600) return 'video';
      return 'short';
    }
    if (secs > 0 && secs < 180) return structured && secs >= 165 ? 'video' : 'short';
    if (secs >= 180) return 'video';
    if (structured) return 'video';
    return rawClassifyType ? rawClassifyType(title, durationSecs, isLive) : 'video';
  };

  window.ftvResolveContentType = function(video, fallbackLive=false){
    if (!video) return 'video';
    const title = getTitle(video);
    const live = fallbackLive || video.type === 'live' || !!video.liveStreamingDetails?.actualStartTime;
    return window.classifyType(title, getDuration(video), live);
  };

  function assignDerived(video){
    if (!video || typeof video !== 'object') return video;
    try { delete video.__ftv_cls; } catch(e) {}
    try { delete video.__ftv_search; } catch(e) {}
    try { delete video.__ftv_search_struct; } catch(e) {}
    const cls = window.classify(video);
    try { Object.defineProperty(video, '__ftv_cls', {value:cls, configurable:true, enumerable:false}); } catch(e) {}
    try { video.type = window.ftvResolveContentType(video); } catch(e) {}
    return video;
  }

  window.buildSports = function(videos){
    const data = {};
    (videos || []).forEach(v => {
      assignDerived(v);
      const cls = v.__ftv_cls || window.classify(v);
      const durationSecs = getDuration(v);
      if (!data[cls.s]) data[cls.s] = {i:cls.i, bg:cls.bg, fg:cls.fg, comps:{}, total:0, views:0, duration:0};
      if (!data[cls.s].comps[cls.c]) data[cls.s].comps[cls.c] = {videos:[], views:0, duration:0};
      data[cls.s].comps[cls.c].videos.push(v);
      data[cls.s].comps[cls.c].views += Number(v.views || 0);
      data[cls.s].comps[cls.c].duration += durationSecs;
      data[cls.s].total++;
      data[cls.s].views += Number(v.views || 0);
      data[cls.s].duration += durationSecs;
    });
    return data;
  };

  window.ftvPresentationEventKey = function(v){
    try { assignDerived(v); const cls = v.__ftv_cls || window.classify(v); return `${cls.s}|||${cls.c}`; }
    catch(e) { return 'Autres|||Non classé'; }
  };

  if (window.FTVSearch) {
    const normalize = window.FTVSearch.normalize || clean;
    const originalParseQuery = window.FTVSearch.parseQuery;
    const originalScore = window.FTVSearch.score;
    const originalMatches = window.FTVSearch.matches;
    const originalSort = window.FTVSearch.sortResults;
    window.FTVSearch.buildIndex = function(video){
      if (!video || typeof video !== 'object') return null;
      assignDerived(video);
      const cls = video.__ftv_cls || window.classify(video);
      const tagText = getTags(video).join(' ');
      const title = getTitle(video);
      const description = getDescription(video);
      const searchable = {
        id: normalize(video.id || video.videoId || ''),
        type: normalize(video.type || ''),
        title: normalize(title),
        description: normalize(description),
        tags: normalize(tagText),
        sport: normalize(cls.s || ''),
        competition: normalize(cls.c || ''),
        keywords: normalize(Array.isArray(cls._debug?.kws) ? cls._debug.kws.join(' ') : '')
      };
      return {
        rawTitle:title,
        rawDescription:description,
        cls,
        fields:searchable,
        titleTokens: searchable.title.split(/\s+/).filter(Boolean),
        categoryTokens: [searchable.sport, searchable.competition, searchable.type].join(' ').split(/\s+/).filter(Boolean),
        tagTokens: searchable.tags.split(/\s+/).filter(Boolean),
        descTokens: searchable.description.split(/\s+/).filter(Boolean).slice(0, 120)
      };
    };
    // On conserve les fonctions de recherche existantes : elles appellent buildIndex,
    // qui est désormais alimenté par la classification recalculée proprement.
    if (originalParseQuery) window.FTVSearch.parseQuery = originalParseQuery;
    if (originalScore) window.FTVSearch.score = originalScore;
    if (originalMatches) window.FTVSearch.matches = originalMatches;
    if (originalSort) window.FTVSearch.sortResults = originalSort;
  }

  window.FTVClassificationGuard = {
    version:'taxonomy-categorical',
    classify: window.classify,
    classifyType: window.classifyType,
    invalidate: window.invalidateClassifyCache
  };
})();
