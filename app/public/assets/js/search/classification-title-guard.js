(function(){
  'use strict';

  const rawClassify = typeof window.classify === 'function' ? window.classify : null;
  const rawClassifyType = typeof window.classifyType === 'function' ? window.classifyType : null;
  let rulesBuilt = false;
  let rulesByChannel = {};
  let memo = new WeakMap();

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
  function padded(s){ return ` ${clean(s).replace(/[.'_-]+/g, ' ').replace(/\s+/g, ' ').trim()} `; }
  function uniq(arr){ return [...new Set((arr || []).filter(Boolean))]; }
  function getTitle(input){ return input && typeof input === 'object' ? (input.title || input.snippet?.title || '') : String(input || ''); }
  function getChannel(input){ return input && typeof input === 'object' ? (input.channelKey || input.channel || window.currentChannelKey || 'sport') : (window.currentChannelKey || 'sport'); }
  function getDuration(input){
    if (!input || typeof input !== 'object') return 0;
    if (typeof window.getVideoDurationSecs === 'function') return Number(window.getVideoDurationSecs(input)) || 0;
    if (typeof window.getDurationSecs === 'function') return Number(window.getDurationSecs(input.duration || input.contentDetails?.duration)) || 0;
    return Number(input.durationSecs || input.durationSeconds || input.duration) || 0;
  }
  function metaForTheme(theme, fallbackIcon){
    return {i:theme?.i || fallbackIcon || '•', bg:theme?.bg || '#F5F7FA', fg:theme?.fg || '#344054'};
  }
  function resultFor(rule, reason){
    const meta = rule.meta || {};
    return {
      s: rule.s,
      c: rule.c || rule.s || 'Non classé',
      i: meta.i || '•',
      bg: meta.bg || '#F5F7FA',
      fg: meta.fg || '#344054',
      _debug:{confidence:'title_guard', score:rule.score || 0, rule:reason || rule.reason || 'title_taxonomy', kws:[`title:${rule.term || rule.label || rule.s}`]}
    };
  }

  function termVariants(term){
    const raw = String(term || '').trim();
    const c = clean(raw);
    const p = c.replace(/[.'_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const k = compact(raw);
    return uniq([c, p, k]);
  }
  function isUsefulTerm(term, kind){
    const raw = String(term || '').trim();
    if (!raw) return false;
    const c = clean(raw);
    const k = compact(raw);
    if (!c || !k) return false;
    if (raw.startsWith('#')) return k.length >= 4;
    if (/^\d+$/.test(k)) return false;
    if (k.length < 4) return false;
    const generic = new Set(['sport','sports','video','videos','direct','live','replay','resume','résumé','france','francais','francaises','feminin','féminin','masculin','hommes','dames','match','finale','club','clubs','serie','series']);
    if (generic.has(k)) return false;
    if (kind === 'theme' && ['tennis','rugby','football','basket','natation','cyclisme','handball'].includes(k)) return true;
    if (kind === 'theme' && k.length < 6 && !c.includes(' ')) return false;
    return true;
  }
  function titleContains(titleClean, titlePadded, titleCompact, term){
    for (const v of termVariants(term)) {
      if (!v) continue;
      const vc = compact(v);
      if (v.startsWith('#')) {
        if (titleCompact.includes(vc)) return true;
        continue;
      }
      if (v.includes(' ')) {
        if (titlePadded.includes(` ${v} `) || titleClean.includes(v)) return true;
      } else {
        if (titlePadded.includes(` ${v} `)) return true;
        if (vc.length >= 8 && titleCompact.includes(vc)) return true;
      }
    }
    return false;
  }
  function addRule(bucket, channel, theme, comp, term, weight, kind){
    if (!isUsefulTerm(term, kind)) return;
    const meta = metaForTheme(theme);
    bucket.push({
      channel,
      s: theme.s || 'Contenu',
      c: comp?.n || theme.s || 'Non classé',
      term,
      kind,
      score: weight + Math.min(120, compact(term).length * 3),
      meta,
      reason:`${kind}:${term}`
    });
  }
  function addCatalog(channel, catalog){
    const bucket = rulesByChannel[channel] || (rulesByChannel[channel] = []);
    (catalog || []).forEach(theme => {
      // Les termes de compétition/catégorie sont prioritaires : ils sont plus précis.
      (theme.comps || []).forEach(comp => {
        addRule(bucket, channel, theme, comp, comp.n, 1200, 'competition_name');
        (comp.strong || []).forEach(t => addRule(bucket, channel, theme, comp, t, 1150, 'competition_strong'));
        (comp.medium || []).forEach(t => addRule(bucket, channel, theme, comp, t, 760, 'competition_medium'));
        (comp.weak || []).forEach(t => { if (compact(t).length >= 10 || clean(t).includes(' ')) addRule(bucket, channel, theme, comp, t, 420, 'competition_weak_long'); });
      });
      addRule(bucket, channel, theme, null, theme.s, 650, 'theme_name');
      (theme.strong || []).forEach(t => addRule(bucket, channel, theme, null, t, 620, 'theme_strong'));
      (theme.medium || []).forEach(t => { if (compact(t).length >= 8 || clean(t).includes(' ')) addRule(bucket, channel, theme, null, t, 330, 'theme_medium_long'); });
    });
    bucket.sort((a,b) => b.score - a.score);
  }
  function buildRules(){
    if (rulesBuilt) return;
    rulesBuilt = true;
    rulesByChannel = {};
    addCatalog('sport', window.SR_SCORED || []);
    addCatalog('francetv', window.FTV_GENERAL_SCORED || []);
    addCatalog('franceinfo', window.FTV_FRANCEINFO_SCORED || []);
    addCatalog('francetvculture', window.FTV_CULTURE_SCORED || []);
    addCatalog('slash', window.FTV_SLASH_SCORED || []);
  }
  function emojiRule(title){
    if (/🏉/.test(title)) return {s:'Rugby', c:'Rugby', term:'🏉', score:1500, meta:metaForTheme((window.SR_SCORED||[]).find(x=>x.s==='Rugby'),'🏉'), reason:'emoji_rugby'};
    if (/🎾/.test(title)) return {s:'Tennis', c:'Tennis', term:'🎾', score:1500, meta:metaForTheme((window.SR_SCORED||[]).find(x=>x.s==='Tennis'),'🎾'), reason:'emoji_tennis'};
    if (/⚽/.test(title)) return {s:'Football', c:'Football', term:'⚽', score:1500, meta:metaForTheme((window.SR_SCORED||[]).find(x=>x.s==='Football'),'⚽'), reason:'emoji_football'};
    if (/🏀/.test(title)) return {s:'Basket-ball', c:'Basket-ball', term:'🏀', score:1500, meta:metaForTheme((window.SR_SCORED||[]).find(x=>x.s==='Basket-ball'),'🏀'), reason:'emoji_basket'};
    if (/🚴/.test(title)) return {s:'Cyclisme', c:'Cyclisme', term:'🚴', score:1500, meta:metaForTheme((window.SR_SCORED||[]).find(x=>x.s==='Cyclisme'),'🚴'), reason:'emoji_cycling'};
    if (/🏊/.test(title)) return {s:'Natation', c:'Natation', term:'🏊', score:1500, meta:metaForTheme((window.SR_SCORED||[]).find(x=>x.s==='Natation'),'🏊'), reason:'emoji_swimming'};
    return null;
  }
  function resolveByTitle(input){
    buildRules();
    const titleRaw = getTitle(input);
    if (!titleRaw) return null;
    const titleClean = clean(titleRaw);
    const titlePadded = padded(titleRaw);
    const titleCompact = compact(titleRaw);
    const channel = getChannel(input);
    const list = rulesByChannel[channel] || rulesByChannel.sport || [];
    let best = emojiRule(titleRaw);
    for (const rule of list) {
      if (titleContains(titleClean, titlePadded, titleCompact, rule.term)) {
        if (!best || rule.score > best.score) best = rule;
      }
    }
    if (!best) return null;
    // Seuils : on ne verrouille que sur des signaux vraiment lisibles dans le titre.
    if (best.score < 620) return null;
    return resultFor(best, best.reason);
  }
  function contradictsTitle(input, cls){
    const titleCls = resolveByTitle(input);
    if (!titleCls || !cls) return null;
    if (titleCls.s !== cls.s || (titleCls.c && cls.c && titleCls.c !== cls.c && titleCls._debug?.score >= 900)) return titleCls;
    return null;
  }

  window.classify = function(input, tags=[], description=''){
    const canMemo = input && typeof input === 'object' && (!tags || tags.length === 0) && !description;
    if (canMemo && memo.has(input)) return memo.get(input);

    const titleLocked = resolveByTitle(input);
    let value = titleLocked;
    if (!value && rawClassify) value = rawClassify(input, tags, description);
    if (value) {
      const fixed = contradictsTitle(input, value);
      if (fixed) value = fixed;
    }
    if (canMemo && value) memo.set(input, value);
    return value;
  };

  window.invalidateClassifyCache = function(){ memo = new WeakMap(); if (typeof window.__FTV_ORIGINAL_INVALIDATE_CLASSIFY_CACHE === 'function') window.__FTV_ORIGINAL_INVALIDATE_CLASSIFY_CACHE(); };

  try { window.FTV_EMOJI_RE = window.FTV_EMOJI_RE || new RegExp('[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{1F000}-\\u{1F2FF}]','u'); } catch(e) { window.FTV_EMOJI_RE = window.FTV_EMOJI_RE || /[☀-➿]/; }
  function hasHashtag(title){ return /#[\w\u00C0-\u017F]+/.test(String(title || '')); }
  function hasEmoji(title){ return window.FTV_EMOJI_RE.test(String(title || '')); }
  function explicitLong(title){ return /resume complet|résumé complet|integralite|intégralité|match complet|course complete|course complète|replay intégral|replay integral|documentaire|magazine|interview complète|interview complete|conférence de presse|conference de presse|en intégralité|en integralite|l'intégrale|l’integrale|l’intégrale/i.test(String(title || '')); }
  function structuredLong(title){ return /^[^:|—–]{3,}\s+[:|—–]\s*\S/.test(String(title || '').trim()) || /^[^:|—–\-]{3,}\s+-\s+\S/.test(String(title || '').trim()); }

  window.classifyType = function(title, durationSecs, isLive){
    if (isLive) return 'live';
    const t = String(title || '').trim();
    const secs = Number(durationSecs) || 0;
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
    return rawClassifyType ? rawClassifyType(title, durationSecs, isLive) : 'video';
  };

  const rawBuildSports = window.buildSports;
  if (typeof rawBuildSports === 'function') {
    window.buildSports = function(videos){
      (videos || []).forEach(v => {
        if (!v || typeof v !== 'object') return;
        const corrected = v.__ftv_cls ? contradictsTitle(v, v.__ftv_cls) : null;
        if (corrected) {
          try { delete v.__ftv_cls; } catch(e) {}
          try { Object.defineProperty(v, '__ftv_cls', {value:corrected, configurable:true, enumerable:false}); } catch(e) { v.__ftv_cls = corrected; }
        }
        try { v.type = window.classifyType(getTitle(v), getDuration(v), v.type === 'live' || !!v.liveStreamingDetails?.actualStartTime); } catch(e) {}
      });
      return rawBuildSports(videos || []);
    };
  }

  window.FTVClassificationTitleGuard = {
    classify: window.classify,
    resolveByTitle,
    invalidate: window.invalidateClassifyCache
  };
})();
