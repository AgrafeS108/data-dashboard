(function(){
  const STOPWORDS = new Set([
    'le','la','les','un','une','des','du','de','d','l','a','au','aux','et','ou','en','sur','pour','par','avec','sans','dans','ce','cet','cette','ces','se','sa','son','ses','leur','leurs','nos','vos','notre','votre','mon','ma','mes','ton','ta','tes','que','qui','quoi','dont','est','sont','plus','moins','tout','tous','toute','toutes','video','videos','short','shorts','replay','france','francetv','france.tv'
  ]);

  const SYNONYMS = new Map([
    ['rg', ['roland','garros']],
    ['rolandgarros', ['roland','garros']],
    ['jo', ['jeux','olympiques']],
    ['olympiades', ['jeux','olympiques']],
    ['6n', ['six','nations']],
    ['m6n', ['six','nations','rugby']],
    ['w6n', ['six','nations','feminin','rugby']],
    ['foot', ['football']],
    ['soccer', ['football']],
    ['velo', ['cyclisme']],
    ['vélo', ['cyclisme']],
    ['tdf', ['tour','france','cyclisme']],
    ['ucl', ['champions','league']],
    ['ldc', ['ligue','champions']],
    ['nba', ['basket']],
    ['wemby', ['wembanyama']],
    ['dupont', ['antoine','dupont','rugby']],
    ['leon', ['leon','marchand','natation']],
    ['léon', ['leon','marchand','natation']],
    ['marchand', ['leon','marchand','natation']]
  ]);

  function normalize(value){
    return String(value || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[’‘`´]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/&/g, ' et ')
      .replace(/[^a-z0-9#@_.'-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function words(value){
    return normalize(value)
      .split(/\s+/)
      .map(w => w.replace(/^['.-]+|['.-]+$/g, ''))
      .filter(Boolean);
  }

  function stemToken(token){
    let t = normalize(token);
    if (t.length > 4 && t.endsWith('s')) t = t.slice(0, -1);
    if (t.length > 5 && t.endsWith('es')) t = t.slice(0, -2);
    return t;
  }

  function meaningfulTokens(value){
    const base = words(value)
      .map(stemToken)
      .filter(t => t && !STOPWORDS.has(t) && t.length >= 2);
    const expanded = [];
    for (const t of base) {
      expanded.push(t);
      const syn = SYNONYMS.get(t);
      if (syn) expanded.push(...syn.map(stemToken));
    }
    return [...new Set(expanded)];
  }

  function escapeRegExp(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function containsToken(text, token){
    if (!token) return false;
    const t = normalize(text);
    if (!t) return false;
    if (token.length <= 2) return new RegExp(`(^|\\s)${escapeRegExp(token)}($|\\s)`).test(t);
    return t.includes(token);
  }

  function levenshteinOne(a,b){
    if (!a || !b) return false;
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i=0,j=0,d=0;
    while (i<a.length && j<b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      d++; if (d > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    }
    return d + (a.length-i) + (b.length-j) <= 1;
  }

  function fuzzyInField(fieldTokens, token){
    if (!token || token.length < 5) return false;
    return (fieldTokens || []).some(w => w.length >= 5 && levenshteinOne(w, token));
  }

  function getClass(video){
    try { return video && video.__ftv_cls ? video.__ftv_cls : (window.classify ? window.classify(video) : null); }
    catch(e){ return null; }
  }

  function buildIndex(video){
    if (!video || typeof video !== 'object') return null;
    if (video.__ftv_search_struct) return video.__ftv_search_struct;
    const cls = getClass(video) || {};
    const tagText = Array.isArray(video.tags) ? video.tags.join(' ') : '';
    const title = video.title || video.snippet?.title || '';
    const description = video.description || video.snippet?.description || '';
    const searchable = {
      id: normalize(video.id || video.videoId || ''),
      type: normalize(video.type || ''),
      title: normalize(title),
      description: normalize(description),
      tags: normalize(tagText),
      sport: normalize(cls.s || video.sport || video.category || ''),
      competition: normalize(cls.c || video.comp || video.competition || video.subcategory || ''),
      keywords: normalize(Array.isArray(cls._debug?.kws) ? cls._debug.kws.join(' ') : '')
    };
    const index = {
      rawTitle: title,
      rawDescription: description,
      cls,
      fields: searchable,
      titleTokens: meaningfulTokens(title),
      categoryTokens: meaningfulTokens([searchable.sport, searchable.competition, searchable.type].join(' ')),
      tagTokens: meaningfulTokens(tagText),
      descTokens: meaningfulTokens(description).slice(0, 120)
    };
    try { Object.defineProperty(video, '__ftv_search_struct', { value:index, configurable:true, enumerable:false }); } catch(e) {}
    return index;
  }

  function parseQuery(query){
    const q = String(query || '').trim();
    const phrases = [];
    const rest = q.replace(/"([^"]+)"|“([^”]+)”|«([^»]+)»/g, (_,a,b,c) => {
      const p = normalize(a || b || c || '');
      if (p) phrases.push(p);
      return ' ';
    });
    const tokens = meaningfulTokens(rest);
    const exact = normalize(q.replace(/["“”«»]/g, ''));
    return { raw:q, exact, phrases, tokens };
  }

  function score(video, query){
    const parsed = typeof query === 'object' && query.tokens ? query : parseQuery(query);
    if (!parsed.raw && !parsed.exact && !parsed.tokens.length && !parsed.phrases.length) return { score:1, matched:true, reason:'empty' };
    const idx = buildIndex(video);
    if (!idx) return { score:0, matched:false, reason:'no-index' };
    const f = idx.fields;
    let s = 0;
    let hardMisses = 0;
    const reasons = [];

    if (parsed.exact) {
      if (f.id && f.id === parsed.exact) { s += 400; reasons.push('id'); }
      if (f.title === parsed.exact) { s += 220; reasons.push('title-exact'); }
      else if (f.title.startsWith(parsed.exact)) { s += 150; reasons.push('title-start'); }
      else if (f.title.includes(parsed.exact)) { s += 120; reasons.push('title-phrase'); }
      if (f.sport === parsed.exact || f.competition === parsed.exact || f.type === parsed.exact) { s += 120; reasons.push('category-exact'); }
      else if (f.sport.includes(parsed.exact) || f.competition.includes(parsed.exact)) { s += 80; reasons.push('category-phrase'); }
      if (f.tags.includes(parsed.exact)) { s += 45; reasons.push('tag-phrase'); }
      // La description seule compte peu : elle aide mais ne doit plus polluer la recherche.
      if (parsed.exact.length >= 6 && f.description.includes(parsed.exact)) { s += 18; reasons.push('description-phrase'); }
    }

    for (const phrase of parsed.phrases) {
      if (f.title.includes(phrase)) { s += 160; reasons.push('quoted-title'); }
      else if (f.sport.includes(phrase) || f.competition.includes(phrase)) { s += 120; reasons.push('quoted-category'); }
      else if (f.description.includes(phrase)) { s += 45; reasons.push('quoted-description'); }
      else hardMisses += 1;
    }

    for (const token of parsed.tokens) {
      let tokenScore = 0;
      if (containsToken(f.title, token)) tokenScore += 46;
      else if (fuzzyInField(idx.titleTokens, token)) tokenScore += 24;
      if (containsToken(f.sport, token) || containsToken(f.competition, token) || containsToken(f.type, token)) tokenScore += 36;
      if (containsToken(f.tags, token)) tokenScore += 14;
      if (containsToken(f.description, token)) tokenScore += 5;
      if (containsToken(f.keywords, token)) tokenScore += 3;
      if (tokenScore <= 0) hardMisses += 1;
      else s += tokenScore;
    }

    // Précision : une recherche multi-mots ne doit pas matcher si plusieurs mots
    // n'apparaissent que dans la description ou les anciens mots-clés de debug.
    const hasPrimarySignal = s >= 45 || parsed.tokens.some(t => containsToken(f.title,t) || containsToken(f.sport,t) || containsToken(f.competition,t));
    const maxMisses = parsed.tokens.length >= 4 ? 1 : 0;
    const matched = hardMisses <= maxMisses && hasPrimarySignal;
    const scoreOut = matched ? s : 0;
    return { score:scoreOut, matched, reason:reasons.join('|') || (matched ? 'token' : 'weak') };
  }

  function matches(video, query){ return score(video, query).matched; }

  function sortResults(videos, query, getDate){
    const parsed = parseQuery(query);
    return (videos || [])
      .map(v => ({ v, r: score(v, parsed) }))
      .filter(x => x.r.matched)
      .sort((a,b) => {
        if (b.r.score !== a.r.score) return b.r.score - a.r.score;
        const av = Number(a.v.views || 0), bv = Number(b.v.views || 0);
        const ad = getDate ? +getDate(a.v) : 0, bd = getDate ? +getDate(b.v) : 0;
        if (bd !== ad) return bd - ad;
        return bv - av;
      })
      .map(x => x.v);
  }

  window.FTVSearch = { normalize, parseQuery, buildIndex, score, matches, sortResults };
})();
