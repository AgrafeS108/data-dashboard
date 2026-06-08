const { useState, useEffect, useRef, useCallback, useMemo } = React;
const { fmt, fmtFull, fmtDate, fmtDateShort, classify, buildSports, getDurationSecs, getVideoDate, saveCache, loadCache, fetchAll, MOCK_VIDEOS, CHANNEL_CONFIGS, DEFAULT_CHANNEL_KEY, getChannelConfig, getCacheKey } = window;
// ─── HELPERS ─────────────────────────────────────────────────────────────────
const __VIDEO_DATE_CACHE = new WeakMap();
function getVidDate(v) {
    if (v && v.__ftv_ts)
        return new Date(v.__ftv_ts);
    if (v && typeof v === 'object' && __VIDEO_DATE_CACHE.has(v))
        return __VIDEO_DATE_CACHE.get(v);
    const d = v.publishedAt ? new Date(v.publishedAt) : getVideoDate(v.id);
    if (v && typeof v === 'object')
        __VIDEO_DATE_CACHE.set(v, d);
    return d;
}
function getVideoDurationSecs(v) {
    if (!v)
        return 0;
    const raw = v.duration ?? v.dur ?? v.contentDetails?.duration ?? v.durationSeconds ?? 0;
    if (typeof raw === 'number' && Number.isFinite(raw))
        return Math.max(0, Math.round(raw));
    if (/^\d+(?:\.\d+)?$/.test(String(raw || '').trim()))
        return Math.max(0, Math.round(Number(raw)));
    return getDurationSecs(raw || '');
}
window.getVideoDurationSecs = getVideoDurationSecs;
window.fmtDuration = fmtDuration;
function fmtDuration(totalSecs, compact = false) {
    const s = Math.max(0, Math.round(Number(totalSecs || 0)));
    if (!s)
        return '—';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0)
        return compact ? `${h}h${String(m).padStart(2, '0')}` : `${h} h ${String(m).padStart(2, '0')}`;
    if (m > 0)
        return compact ? `${m}:${String(sec).padStart(2, '0')}` : `${m} min ${String(sec).padStart(2, '0')}`;
    return `${sec}s`;
}
function getLatestYearRange(videos, fallbackYear = 2025) {
    const dates = (videos || []).map(getVidDate).filter(d => d instanceof Date && !Number.isNaN(d.getTime()));
    if (!dates.length)
        return { start: new Date(fallbackYear, 0, 1), end: new Date(fallbackYear, 11, 31) };
    const latest = dates.reduce((max, d) => d > max ? d : max, dates[0]);
    const y = latest.getFullYear();
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };
}
function getCurrentYtdRange() {
    const now = new Date();
    return { start: new Date(now.getFullYear(), 0, 1), end: now };
}
// Index de recherche calculé une seule fois par vidéo. Avant, chaque frappe
// reconstruisait un gros texte + relançait classify(v) pour toutes les vidéos.
const __SEARCH_INDEX_CACHE = new WeakMap();
function getSearchIndex(v) {
    if (window.FTVSearch?.buildIndex) {
        const idx = window.FTVSearch.buildIndex(v);
        if (idx) return idx;
    }
    if (v && v.__ftv_search)
        return v.__ftv_search;
    if (__SEARCH_INDEX_CACHE.has(v))
        return __SEARCH_INDEX_CACHE.get(v);
    const cls = v && v.__ftv_cls ? v.__ftv_cls : classify(v);
    const tagText = Array.isArray(v.tags) ? v.tags.join(' ') : '';
    const idx = norm([
        v.title,
        v.description,
        tagText,
        v.id,
        v.type,
        cls.s,
        cls.c
    ].filter(Boolean).join(' '));
    __SEARCH_INDEX_CACHE.set(v, idx);
    return idx;
}
function videoMatchesSearch(v, query) {
    if (window.FTVSearch?.matches) return window.FTVSearch.matches(v, query);
    const q = norm(query || '').trim();
    if (!q)
        return true;
    const haystack = getSearchIndex(v);
    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.every(t => haystack.includes(t));
}
function sortSearchResults(videos, query) {
    if (window.FTVSearch?.sortResults) return window.FTVSearch.sortResults(videos, query, getVidDate);
    return videos;
}
// Prépare les calculs coûteux une seule fois par vidéo. Ces champs sont
// non-énumérables : ils n'alourdissent pas le cache localStorage.
function hydrateVideoDerivedFields(v) {
    if (!v || typeof v !== 'object')
        return v;
    try {
        if (window.ftvResolveContentType) {
            v.type = window.ftvResolveContentType(v);
        }
        // Préparation non bloquante : on évite de lancer ici la classification
        // complète et l'index de recherche sur toute la chaîne. La précision reste
        // inchangée : buildSports() et FTVSearch classent/indexent les vidéos au
        // moment utile, avec mise en cache par vidéo.
        if (!Object.prototype.hasOwnProperty.call(v, '__ftv_ts')) {
            const d = getVidDate(v);
            Object.defineProperty(v, '__ftv_ts', { value: (d instanceof Date && !Number.isNaN(d.getTime())) ? d.getTime() : 0, configurable: true, enumerable: false });
        }
    }
    catch (e) { }
    return v;
}
function prepareVideosForDashboard(videos, maxSync = Infinity) {
    const arr = Array.isArray(videos) ? videos : [];
    for (let i = 0; i < Math.min(arr.length, maxSync); i++)
        hydrateVideoDerivedFields(arr[i]);
    return arr;
}

// Construction non bloquante des groupes sport/compétition.
// Important : on ne retire aucune règle de classification. On découpe simplement
// le calcul en petits lots pour que le navigateur puisse continuer à rendre la page
// quand l'utilisateur change d'année, de chaîne ou de période.
function ftvCreateEmptySportsData() {
    return {};
}
function ftvAddVideoToSportsData(data, v) {
    if (!v || typeof v !== 'object')
        return data;
    let cls = null;
    try {
        // On appelle classify(v) volontairement, même si __ftv_cls existe déjà :
        // les verrous de titre et corrections manuelles passent ainsi avant un
        // éventuel cache historique incohérent.
        cls = window.classify ? window.classify(v) : null;
    }
    catch (e) { cls = null; }
    if (!cls || !cls.s) {
        cls = { s: 'Autres sports', c: 'Non classé', i: '•', bg: '#F5F5F5', fg: '#5A5A5A' };
    }
    try { delete v.__ftv_cls; } catch(e) {}
    try { Object.defineProperty(v, '__ftv_cls', { value: cls, configurable: true, enumerable: false }); } catch(e) { v.__ftv_cls = cls; }
    const durationSecs = window.getVideoDurationSecs ? window.getVideoDurationSecs(v) : (window.getDurationSecs ? window.getDurationSecs(v.duration) : 0);
    try {
        if (window.ftvResolveContentType) v.type = window.ftvResolveContentType(v);
    } catch(e) {}
    const sport = cls.s || 'Autres sports';
    const comp = cls.c || 'Non classé';
    const views = Number(v.views || 0) || 0;
    if (!data[sport]) data[sport] = { i: cls.i || '•', bg: cls.bg || '#F5F5F5', fg: cls.fg || '#5A5A5A', comps: {}, total: 0, views: 0, duration: 0 };
    if (!data[sport].comps[comp]) data[sport].comps[comp] = { videos: [], views: 0, duration: 0 };
    data[sport].comps[comp].videos.push(v);
    data[sport].comps[comp].views += views;
    data[sport].comps[comp].duration += durationSecs;
    data[sport].total++;
    data[sport].views += views;
    data[sport].duration += durationSecs;
    return data;
}
function ftvBuildSportsAsync(videos, onComplete, onProgress) {
    const arr = Array.isArray(videos) ? videos : [];
    let cancelled = false;
    let i = 0;
    const data = ftvCreateEmptySportsData();
    const total = arr.length;
    const schedule = (cb) => {
        if (window.requestIdleCallback) return window.requestIdleCallback(cb, { timeout: 120 });
        return window.setTimeout(() => cb({ timeRemaining: () => 6 }), 0);
    };
    const cancelSchedule = (h) => {
        if (h == null) return;
        if (window.cancelIdleCallback) window.cancelIdleCallback(h);
        else window.clearTimeout(h);
    };
    let handle = null;
    const step = (deadline) => {
        if (cancelled) return;
        const started = performance.now();
        let processed = 0;
        while (!cancelled && i < total) {
            ftvAddVideoToSportsData(data, arr[i]);
            i++;
            processed++;
            const noTime = deadline && deadline.timeRemaining && deadline.timeRemaining() <= 1;
            if (processed >= 45 || performance.now() - started > 10 || noTime) break;
        }
        if (onProgress && (i === total || i % 180 < 45)) {
            try { onProgress({ done: i, total }); } catch(e) {}
        }
        if (cancelled) return;
        if (i < total) handle = schedule(step);
        else {
            try { onComplete(data); } catch(e) { console.error('[FTV] buildSports async complete failed', e); }
        }
    };
    if (!total) {
        window.setTimeout(() => { if (!cancelled) onComplete(data); }, 0);
        return () => { cancelled = true; };
    }
    handle = schedule(step);
    return () => { cancelled = true; cancelSchedule(handle); };
}
function ftvBuildPresentationEventsAsync(videos, onComplete) {
    const arr = Array.isArray(videos) ? videos : [];
    let cancelled = false;
    let i = 0;
    const map = new Map();
    const schedule = (cb) => window.requestIdleCallback ? window.requestIdleCallback(cb, { timeout: 180 }) : window.setTimeout(() => cb({ timeRemaining: () => 5 }), 0);
    const cancelSchedule = (h) => { if (h == null) return; if (window.cancelIdleCallback) window.cancelIdleCallback(h); else window.clearTimeout(h); };
    let handle = null;
    const step = (deadline) => {
        if (cancelled) return;
        const started = performance.now();
        let processed = 0;
        while (!cancelled && i < arr.length) {
            const v = arr[i++];
            try {
                const key = window.ftvPresentationEventKey ? window.ftvPresentationEventKey(v) : null;
                if (key) {
                    const item = map.get(key) || { key, label: window.ftvPresentationEventLabel ? window.ftvPresentationEventLabel(key) : key.replace('|||', ' / '), views: 0, count: 0 };
                    item.views += Number(v.views || 0) || 0;
                    item.count += 1;
                    map.set(key, item);
                }
            } catch(e) {}
            processed++;
            const noTime = deadline && deadline.timeRemaining && deadline.timeRemaining() <= 1;
            if (processed >= 55 || performance.now() - started > 10 || noTime) break;
        }
        if (cancelled) return;
        if (i < arr.length) handle = schedule(step);
        else onComplete(Array.from(map.values()).sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,80));
    };
    handle = schedule(step);
    return () => { cancelled = true; cancelSchedule(handle); };
}
function LoadingOverlay({ message }) {
    return (React.createElement("div", { style: { position: 'fixed', inset: 0, background: 'rgba(244,244,245,0.92)', zIndex: 1000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, backdropFilter: 'blur(4px)' } },
        React.createElement("div", { style: { width: 36, height: 36, border: '3px solid rgba(0,0,0,0.1)', borderTop: '3px solid var(--red)',
                borderRadius: '50%', animation: 'spin .8s linear infinite' } }),
        React.createElement("div", { style: { fontSize: 14, color: 'var(--text2)', letterSpacing: '0.3px' } }, message || 'Chargement…')));
}
const API_KEY_STORAGE_KEYS = ['ftv_shared_youtube_api_key', 'ftvsport_apikey', 'ftv_youtube_api_key', 'youtube_api_key'];
function readSharedApiKey() {
    for (const storage of [localStorage, sessionStorage]) {
        try {
            for (const k of API_KEY_STORAGE_KEYS) {
                const v = storage.getItem(k);
                if (v && String(v).trim())
                    return String(v).trim();
            }
            // Compatibilité : retrouve aussi une clé enregistrée sous un ancien nom.
            for (let i = 0; i < storage.length; i++) {
                const k = storage.key(i) || '';
                const low = k.toLowerCase();
                if ((low.includes('youtube') || low.includes('yt_') || low.includes('google')) && low.includes('api') && !low.includes('anthropic') && !low.includes('claude')) {
                    const v = storage.getItem(k);
                    if (v && String(v).trim())
                        return String(v).trim();
                }
            }
        }
        catch (e) { }
    }
    return '';
}
function saveSharedApiKey(value) {
    const v = String(value || '').trim();
    if (!v)
        return;
    try {
        API_KEY_STORAGE_KEYS.forEach(k => localStorage.setItem(k, v));
    }
    catch (e) { }
    try {
        API_KEY_STORAGE_KEYS.forEach(k => sessionStorage.setItem(k, v));
    }
    catch (e) { }
}
const ANTHROPIC_KEY_STORAGE = 'ftv_anthropic_api_key';
const ANTHROPIC_KEY_STORAGE_KEYS = [
    'ftv_anthropic_api_key',
    'ftv_shared_anthropic_api_key',
    'ftv_claude_api_key',
    'anthropic_api_key',
    'claude_api_key'
];
function readSharedAnthropicKey() {
    try {
        const runtime = window.__FTV_ANTHROPIC_KEY_RUNTIME;
        if (runtime && String(runtime).trim())
            return String(runtime).trim();
    }
    catch (e) { }
    for (const storage of [localStorage, sessionStorage]) {
        try {
            for (const k of ANTHROPIC_KEY_STORAGE_KEYS) {
                const v = storage.getItem(k);
                if (v && String(v).trim())
                    return String(v).trim();
            }
        }
        catch (e) { }
    }
    return '';
}
function saveSharedAnthropicKey(value) {
    const v = String(value || '').trim();
    try {
        window.__FTV_ANTHROPIC_KEY_RUNTIME = v;
    }
    catch (e) { }
    for (const storage of [localStorage, sessionStorage]) {
        try {
            ANTHROPIC_KEY_STORAGE_KEYS.forEach(k => {
                if (v)
                    storage.setItem(k, v);
                else
                    storage.removeItem(k);
            });
        }
        catch (e) { }
    }
}

const YT_ANALYTICS_CLIENT_STORAGE_KEYS = ['ftv_youtube_analytics_client_id','ftv_analytics_oauth_client_id','yt_analytics_client_id'];
function readSharedAnalyticsClientId(){
    for(const storage of [localStorage,sessionStorage]){try{for(const k of YT_ANALYTICS_CLIENT_STORAGE_KEYS){const v=storage.getItem(k);if(v&&String(v).trim())return String(v).trim();}}catch(e){}}
    return '';
}
function saveSharedAnalyticsClientId(value){
    const v=String(value||'').trim();
    for(const storage of [localStorage,sessionStorage]){try{YT_ANALYTICS_CLIENT_STORAGE_KEYS.forEach(k=>v?storage.setItem(k,v):storage.removeItem(k));}catch(e){}}
}
const YT_ANALYTICS_SCOPE='https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly';
function toAnalyticsDate(d,fallback){try{const x=d instanceof Date?d:new Date(d);if(!isNaN(x.getTime()))return x.toISOString().slice(0,10);}catch(e){}return fallback;}
function analyticsRowsToObjects(data){const cols=(data?.columnHeaders||[]).map(c=>c.name);return(data?.rows||[]).map(row=>Object.fromEntries(cols.map((c,i)=>[c,row[i]])));}
async function queryYouTubeAnalytics(accessToken,params){
    const channelKey=String(params?.channelKey||window.DEFAULT_CHANNEL_KEY||'sport');
    const scope=String(params?.scope||'ytd');
    const res=await fetch(`/api/analytics-store?channel=${encodeURIComponent(channelKey)}&scope=${encodeURIComponent(scope)}&_live=${Date.now()}`,{cache:'no-store',headers:{'Cache-Control':'no-store'}});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.error)throw new Error(data.error||data.message||`Erreur Analytics store ${res.status}`);
    return data.payload||data;
}
function readAnalyticsChannelMap(){try{return JSON.parse(localStorage.getItem(FTV_ANALYTICS_CHANNEL_MAP_KEY)||'{}')||{};}catch(e){return {};}}
function saveAnalyticsChannelMap(map){try{localStorage.setItem(FTV_ANALYTICS_CHANNEL_MAP_KEY,JSON.stringify(map||{}));}catch(e){}}
async function fetchManagedAnalyticsChannels(){const res=await fetch('/api/youtube-managed-channels',{cache:'no-store',signal:AbortSignal.timeout(60000)});const data=await res.json().catch(()=>({}));if(!res.ok||data.error)throw new Error(data.error||data.message||`Erreur liste chaînes Analytics ${res.status}`);return data.channels||[];}
async function fetchAnalyticsHealth(){const res=await fetch('/api/youtube-analytics-health',{cache:'no-store',signal:AbortSignal.timeout(60000)});const data=await res.json().catch(()=>({}));if(!res.ok||data.error)throw new Error(data.error||data.message||`Erreur diagnostic Analytics ${res.status}`);return data;}
function normalizeChannelName(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function guessAnalyticsChannelId(channelKey, channels){const key=String(channelKey||'');const rules={sport:['france tv sport','francetv sport','ftv sport','france.tv sport'],francetv:['france tv','france.tv'],franceinfo:['franceinfo','france info'],francetvculture:['france tv culture','france.tv culture','culturebox'],slash:['slash','france tv slash','france.tv slash']};const wanted=rules[key]||[];const scored=(channels||[]).map(ch=>{const n=normalizeChannelName((ch.title||'')+' '+(ch.customUrl||''));let score=0;wanted.forEach(w=>{if(n.includes(normalizeChannelName(w)))score+=10;});if(key==='sport'&&/sport/.test(n))score+=5;if(key==='franceinfo'&&/info/.test(n))score+=5;if(key==='francetvculture'&&/culture/.test(n))score+=5;if(key==='slash'&&/slash/.test(n))score+=5;return{ch,score};}).sort((a,b)=>b.score-a.score);return scored[0]?.score>0?scored[0].ch:null;}
function chunkArray(arr,size){const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out;}
function getAnalyticsMetric(v,key,fallback=0){const n=Number(v?.analytics?.[key]);return Number.isFinite(n)?n:fallback;}
function sumAnalyticsMetric(videos,key,fallbackKey=null){return(videos||[]).reduce((s,v)=>s+getAnalyticsMetric(v,key,fallbackKey?Number(v[fallbackKey]||0):0),0);}
function weightedAnalyticsMetric(videos,key,weightKey='analyticsViews'){
    let num=0,den=0;(videos||[]).forEach(v=>{const w=getAnalyticsMetric(v,weightKey,Number(v.views||0));const val=getAnalyticsMetric(v,key,NaN);if(Number.isFinite(val)&&w>0){num+=val*w;den+=w;}});return den?num/den:0;
}
function mergeAnalyticsRow(target,row){
    if(!target)return;target.analytics=target.analytics||{};
    const add=(dst,src)=>{const n=Number(row[src]||0);target.analytics[dst]=Number(target.analytics[dst]||0)+(Number.isFinite(n)?n:0);};
    add('analyticsViews','views');add('watchTimeMinutes','estimatedMinutesWatched');add('analyticsLikes','likes');add('analyticsComments','comments');add('shares','shares');add('subscribersGained','subscribersGained');add('subscribersLost','subscribersLost');
    const avd=Number(row.averageViewDuration||0),avp=Number(row.averageViewPercentage||0),imp=Number(row.impressions||0),ctr=Number(row.impressionClickThroughRate||0);
    if(avd)target.analytics.averageViewDuration=avd;if(avp)target.analytics.averageViewPercentage=avp;if(imp)target.analytics.impressions=Number(target.analytics.impressions||0)+imp;
    if(ctr){const w=Math.max(1,imp||Number(row.views||0));target.analytics.ctrWeightedNumerator=Number(target.analytics.ctrWeightedNumerator||0)+ctr*w;target.analytics.ctrWeightedDenominator=Number(target.analytics.ctrWeightedDenominator||0)+w;target.analytics.impressionClickThroughRate=target.analytics.ctrWeightedNumerator/target.analytics.ctrWeightedDenominator;}
}
function summarizeAnalyticsForVideos(videos){
    const rows=videos||[];const views=sumAnalyticsMetric(rows,'analyticsViews');const watch=sumAnalyticsMetric(rows,'watchTimeMinutes');const impressions=sumAnalyticsMetric(rows,'impressions');
    const avgDuration=weightedAnalyticsMetric(rows,'averageViewDuration');const avgPct=weightedAnalyticsMetric(rows,'averageViewPercentage');
    const ctr=impressions?rows.reduce((s,v)=>s+getAnalyticsMetric(v,'impressionClickThroughRate')*getAnalyticsMetric(v,'impressions'),0)/impressions:0;
    const subsGained=sumAnalyticsMetric(rows,'subscribersGained'),subsLost=sumAnalyticsMetric(rows,'subscribersLost');
    return{videos:rows.length,views,watch,impressions,avgDuration,avgPct,ctr,subsGained,subsLost,netSubs:subsGained-subsLost,shares:sumAnalyticsMetric(rows,'shares')};
}
function summarizeAnalyticsBySport(videos){
    const map=new Map();(videos||[]).forEach(v=>{const cls=v&&v.__ftv_cls?v.__ftv_cls:classify(v);const key=`${cls.s}||${cls.c}`;const cur=map.get(key)||{sport:cls.s,comp:cls.c,i:cls.i,bg:cls.bg,fg:cls.fg,videos:[]};cur.videos.push(v);map.set(key,cur);});
    return[...map.values()].map(x=>({...x,...summarizeAnalyticsForVideos(x.videos)})).sort((a,b)=>(b.watch||b.views||0)-(a.watch||a.views||0));
}
async function fetchAnalyticsBundle({accessToken,videos,dateRange,channelKey,analyticsChannel,onProgress}){
    // Analytics est exécuté côté serveur via le refresh token Vercel ; aucun access token navigateur n'est requis.
    const startDate=toAnalyticsDate(dateRange?.start,`${new Date().getFullYear()}-01-01`),endDate=toAnalyticsDate(dateRange?.end,new Date().toISOString().slice(0,10)),ids='channel==MINE';
    const sourceVideos=Array.isArray(videos)?videos:[];const byId=new Map(sourceVideos.map(v=>[v.id,v]));sourceVideos.forEach(v=>{v.analytics={};});
    const videoIds=[...new Set(sourceVideos.map(v=>v.id).filter(Boolean))];const errors=[];let done=0;const requestMetas=[];
    for(const idsChunk of chunkArray(videoIds,35)){
        const filters=`video==${idsChunk.join(',')}`;
        try{const data=await queryYouTubeAnalytics(accessToken,{ids,startDate,endDate,channelKey,analyticsChannelId:analyticsChannel?.id||'',analyticsChannelTitle:analyticsChannel?.title||'',metrics:'views,estimatedMinutesWatched,averageViewDuration',dimensions:'video',filters,maxResults:idsChunk.length,sort:'-views'});if(data?.ftvMeta)requestMetas.push(data.ftvMeta);analyticsRowsToObjects(data).forEach(row=>mergeAnalyticsRow(byId.get(row.video),row));}
        catch(e){errors.push(`video chunk ${Math.floor(done/35)+1}: ${e.message||String(e)}`);}
        // Impressions/CTR ne sont pas demandés ici : ces métriques relèvent des Reach reports de la Reporting API, pas de cette requête ciblée.
        done+=idsChunk.length;if(onProgress)onProgress(`Analytics vidéos : ${done}/${videoIds.length}`);await new Promise(r=>setTimeout(r,0));
    }
    const safeQuery=async(name,config)=>{try{return{name,data:await queryYouTubeAnalytics(accessToken,{ids,startDate,endDate,channelKey,analyticsChannelId:analyticsChannel?.id||'',analyticsChannelTitle:analyticsChannel?.title||'',...config})};}catch(e){errors.push(`${name}: ${e.message||e}`);return{name,data:null};}};
    const [daily,traffic,devices,countries]=await Promise.all([
        safeQuery('daily',{metrics:'views,estimatedMinutesWatched,averageViewDuration',dimensions:'day',sort:'day',maxResults:500}),
        safeQuery('traffic',{metrics:'views,estimatedMinutesWatched',dimensions:'insightTrafficSourceType',sort:'-views',maxResults:50}),
        safeQuery('devices',{metrics:'views,estimatedMinutesWatched',dimensions:'deviceType',sort:'-views',maxResults:50}),
        safeQuery('countries',{metrics:'views,estimatedMinutesWatched,averageViewDuration',dimensions:'country',sort:'-views',maxResults:100})
    ]);
    const summary=summarizeAnalyticsForVideos(sourceVideos);
    const publicViews=sourceVideos.reduce((s,v)=>s+Number(v.views||0),0);
    const matchedAnalyticsVideos=sourceVideos.filter(v=>Number(v?.analytics?.analyticsViews||0)>0).length;
    summary.publicViews=publicViews;summary.sourceVideos=sourceVideos.length;summary.matchedAnalyticsVideos=matchedAnalyticsVideos;
    const diagnostics={publicViews,sourceVideoCount:sourceVideos.length,matchedAnalyticsVideos,requestMeta:requestMetas[0]||null,requestMetaCount:requestMetas.length,scopeLabel:'vidéos visibles dans le dashboard',selectedAnalyticsChannel:analyticsChannel||null,errors:errors.slice(0,8)};
    return{channelKey,startDate,endDate,loadedAt:Date.now(),videos:sourceVideos,byVideo:Object.fromEntries(sourceVideos.map(v=>[v.id,v.analytics||{}])),summary,diagnostics,daily:daily.data,traffic:traffic.data,devices:devices.data,countries:countries.data,errors:[...new Set(errors)].slice(0,8)};
}
function addAnalyticsToExportRow(row,sourceVideo){const a=sourceVideo?.analytics||{};return{...row,analyticsViews:Number(a.analyticsViews||0),watchTimeMinutes:Number(a.watchTimeMinutes||0),averageViewDuration:Number(a.averageViewDuration||0),averageViewPercentage:Number(a.averageViewPercentage||0),impressions:Number(a.impressions||0),impressionClickThroughRate:Number(a.impressionClickThroughRate||0),subscribersGained:Number(a.subscribersGained||0),subscribersLost:Number(a.subscribersLost||0),shares:Number(a.shares||0)};}

function exportCSV(rows, filename) {
    if (!rows.length)
        return;
    const ks = Object.keys(rows[0]);
    const lines = [ks.join(';'), ...rows.map(r => ks.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(';'))];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
    a.click();
}
function safeExcelText(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function normalizeExcelColor(hex, fallback = '#E30613') {
    const h = String(hex || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(h) ? h : fallback;
}
function paleExcelColor(hex) {
    const h = normalizeExcelColor(hex).replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const mix = (v) => Math.round(v * 0.12 + 255 * 0.88).toString(16).padStart(2, '0');
    return `#${mix(r)}${mix(g)}${mix(b)}`;
}
function excelCell(value, cls = '', attrs = '') {
    const isNum = typeof value === 'number' && Number.isFinite(value);
    return `<td class="${cls || ''}" ${attrs || ''}>${isNum ? Math.round(value) : safeExcelText(value)}</td>`;
}
function typeLabelForExport(t) { return t === 'short' ? 'Short' : t === 'live' ? 'Live' : 'Vidéo'; }
function getVideoUrl(v) { return v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : ''); }
function getExportRowsFromSelection({ selectedSports, selectedComps, selectedVideos, sportsData, allVideos }) {
    const rows = [];
    const seen = new Set();
    const addVideo = (v, sportName, compName, source) => {
        if (!v || !v.id || seen.has(v.id))
            return;
        seen.add(v.id);
        const cls = v.__ftv_cls || classify(v);
        const d = getVidDate(v);
        const baseRow = {
            source, sport: sportName || cls.s, competition: compName || cls.c, type: typeLabelForExport(v.type),
            title: v.title || '', publishedAt: (d instanceof Date && !Number.isNaN(d.getTime())) ? d.toLocaleDateString('fr-FR') : '',
            duration: getVideoDurationSecs(v), durationLabel: fmtDuration(getVideoDurationSecs(v), true), views: Number(v.views || 0),
            url: getVideoUrl(v), videoId: v.id || '', description: v.description || ''
        };
        rows.push(addAnalyticsToExportRow(baseRow, v));
    };
    Object.entries(sportsData || {}).forEach(([sportName, data]) => {
        const isSportSelected = selectedSports?.has(sportName);
        Object.entries(data.comps || {}).forEach(([compName, comp]) => {
            const compKey = `${sportName}::${compName}`;
            // Compatibilité : anciennes versions stockaient parfois seulement le nom de la compétition.
            // Les versions récentes stockent sport::compétition pour éviter les collisions entre dashboards/catégories.
            const isCompSelected = !!(selectedComps && (selectedComps.has(compKey) || selectedComps.has(compName)));
            (comp.videos || []).forEach(v => {
                if (isSportSelected)
                    addVideo(v, sportName, compName, 'Sport / thématique sélectionné(e)');
                else if (isCompSelected)
                    addVideo(v, sportName, compName, 'Compétition / sous-catégorie sélectionnée');
            });
        });
    });
    if (selectedVideos && selectedVideos.size) {
        (allVideos || []).forEach(v => {
            if (!selectedVideos.has(v.id))
                return;
            const cls = v.__ftv_cls || classify(v);
            addVideo(v, cls.s, cls.c, 'Vidéo sélectionnée');
        });
    }
    return rows.sort((a, b) => b.views - a.views);
}
function summarizeExportRows(rows) {
    const byCategory = new Map();
    rows.forEach(r => {
        const key = `${r.sport}||${r.competition}`;
        const cur = byCategory.get(key) || { sport: r.sport, competition: r.competition, contents: 0, views: 0, video: 0, short: 0, live: 0 };
        cur.contents++;
        cur.views += Number(r.views || 0);
        const t = String(r.type || '').toLowerCase();
        if (t.includes('short'))
            cur.short++;
        else if (t.includes('live'))
            cur.live++;
        else
            cur.video++;
        byCategory.set(key, cur);
    });
    return Array.from(byCategory.values()).sort((a, b) => b.views - a.views);
}
function exportStyledExcel({ rows, filename = 'export_francetv_youtube.xls', dateRange = null, accent = '#E30613', title = 'Export YouTube Analytics', subtitle = '' }) {
    if (!rows.length)
        return;
    const main = normalizeExcelColor(accent, '#E30613');
    const pale = paleExcelColor(main);
    const totalViews = rows.reduce((s, r) => s + Number(r.views || 0), 0);
    const totalWatch = rows.reduce((s, r) => s + Number(r.watchTimeMinutes || 0), 0);
    const totalImpressions = rows.reduce((s, r) => s + Number(r.impressions || 0), 0);
    const summary = summarizeExportRows(rows);
    const period = dateRange?.start && dateRange?.end ? `${fmtDateShort(dateRange.start)} → ${fmtDateShort(dateRange.end)}` : 'Toutes périodes sélectionnées';
    const exportedAt = new Date().toLocaleString('fr-FR');
    const safeFilename = filename.endsWith('.xls') ? filename : filename.replace(/\.csv$/i, '') + '.xls';
    const detailRows = rows.map(r => `<tr>
    ${excelCell(r.sport, 'cat')}${excelCell(r.competition, 'subcat')}${excelCell(r.type, 'type')}${excelCell(r.title, 'titleCell')}${excelCell(r.publishedAt, 'date')}${excelCell(r.duration, 'number')}${excelCell(r.views, 'number')}${excelCell(r.analyticsViews || 0, 'number')}${excelCell(Math.round(r.watchTimeMinutes || 0), 'number')}${excelCell(Math.round(r.averageViewDuration || 0), 'number')}${excelCell(r.impressions || 0, 'number')}${excelCell(r.impressionClickThroughRate ? (r.impressionClickThroughRate * 100).toFixed(2) + ' %' : '', 'number')}${excelCell(r.subscribersGained || 0, 'number')}${excelCell(r.subscribersLost || 0, 'number')}${excelCell(r.shares || 0, 'number')}${excelCell(r.url, 'url')}${excelCell(r.videoId, 'id')}
  </tr>`).join('');
    const summaryRows = summary.map(r => `<tr>
    ${excelCell(r.sport, 'cat')}${excelCell(r.competition, 'subcat')}${excelCell(r.contents, 'number')}${excelCell(r.video, 'number')}${excelCell(r.short, 'number')}${excelCell(r.live, 'number')}${excelCell(r.views, 'number')}${excelCell(totalViews ? Math.round(r.views / totalViews * 100) + ' %' : '0 %', 'number', 'colspan="2"')}
  </tr>`).join('');
    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Export YouTube</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--><style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111827;} table{border-collapse:collapse;width:100%;} td,th{border:1px solid #D6DAE2;padding:8px 10px;font-size:11pt;vertical-align:top;}
  .title{background:${main};color:#fff;font-size:18pt;font-weight:700;border-color:${main};}.subtitle{background:${pale};color:#111827;font-size:10pt;font-weight:600;border-color:#D6DAE2;}
  .metaLabel{background:#F3F4F6;color:#6B7280;font-weight:700;text-transform:uppercase;font-size:9pt;letter-spacing:.4px;}.metaValue{background:#FFFFFF;font-weight:600;}.section{background:#111827;color:#FFFFFF;font-weight:700;font-size:12pt;}
  .header{background:${main};color:#FFFFFF;font-weight:700;text-transform:uppercase;font-size:9pt;letter-spacing:.35px;text-align:left;}.cat{font-weight:700;background:${pale};color:#111827;}.subcat{font-weight:600;}.type{text-align:center;font-weight:700;background:#F9FAFB;}.titleCell{font-weight:600;}.number{text-align:right;mso-number-format:"0";}.date{text-align:center;white-space:nowrap;}.url{color:#0B3F7A;text-decoration:underline;}.id{color:#6B7280;font-size:9pt;}.note{background:#FFF7ED;color:#7C2D12;font-size:10pt;}
</style>

<!-- FTV MOBILE APP POLISH v61 — vrais écrans tactiles + anti-débordements -->
<style id="ftv-mobile-app-polish-v61">
  :root { --ftv-mobile-nav-h: 74px; --ftv-safe-bottom: env(safe-area-inset-bottom, 0px); }
  * { box-sizing: border-box; }
  html, body { max-width: 100%; overflow-x: hidden; }

  @media (max-width: 980px), (pointer: coarse) {
    body { background: var(--bg) !important; }
    #root, #root > div { width: 100% !important; max-width: 100vw !important; min-height: 100dvh !important; overflow-x: hidden !important; }
    #root > div { display: flex !important; flex-direction: column !important; height: auto !important; overflow: visible !important; }

    /* Header mobile : pleine largeur, propre, pas de panneau écrasé */
    #root > div > div:first-of-type {
      width: 100% !important;
      min-width: 0 !important;
      height: auto !important;
      max-height: none !important;
      flex: 0 0 auto !important;
      position: relative !important;
      top: auto !important;
      z-index: 20 !important;
      border-right: none !important;
      border-bottom: 1px solid var(--border) !important;
      background: var(--bg2) !important;
      overflow: visible !important;
      box-shadow: 0 12px 30px rgba(15,23,42,.06) !important;
    }
    #root > div > div:first-of-type > div:first-child {
      padding: 16px 18px 14px !important;
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 12px !important;
      width: 100% !important;
    }
    #root > div > div:first-of-type > div:first-child > div:first-child {
      margin: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      width: 100% !important;
    }
    #root > div > div:first-of-type > div:first-child select {
      max-width: 52vw !important;
      min-height: 40px !important;
      font-size: 18px !important;
      font-weight: 900 !important;
      color: var(--text) !important;
    }
    #root > div > div:first-of-type > div:first-child > div:nth-child(2) {
      width: 100% !important;
      display: grid !important;
      grid-template-columns: minmax(128px, 38%) 1fr !important;
      align-items: center !important;
      gap: 18px !important;
      padding: 6px 0 2px !important;
    }
    #root > div > div:first-of-type > div:first-child svg {
      max-width: 132px !important;
      max-height: 132px !important;
      width: 100% !important;
      height: auto !important;
      margin: 0 auto !important;
    }
    #root > div > div:first-of-type > div:first-child > div:nth-child(2) > div:last-child {
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      gap: 3px !important;
      min-width: 0 !important;
    }

    /* Liste des sports sous le header : scroll horizontal propre */
    #root > div > div:first-of-type > div:nth-child(2) {
      display: flex !important;
      flex-direction: row !important;
      gap: 10px !important;
      overflow-x: auto !important;
      overflow-y: hidden !important;
      -webkit-overflow-scrolling: touch !important;
      padding: 11px 16px 14px !important;
      max-height: none !important;
      scrollbar-width: none;
      scroll-snap-type: x proximity;
      background: var(--bg2) !important;
      border-top: 1px solid var(--border) !important;
    }
    #root > div > div:first-of-type > div:nth-child(2)::-webkit-scrollbar { display: none; }
    #root > div > div:first-of-type > div:nth-child(2) > * {
      flex: 0 0 210px !important;
      min-width: 210px !important;
      max-width: 230px !important;
      scroll-snap-align: start;
    }
    #root > div > div:first-of-type > div:nth-child(3) { display: none !important; }

    /* Contenu principal */
    #root > div > div:nth-of-type(2) {
      width: 100% !important;
      min-width: 0 !important;
      flex: 1 1 auto !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: visible !important;
      padding-bottom: calc(var(--ftv-mobile-nav-h) + var(--ftv-safe-bottom) + 10px) !important;
    }

    /* Navigation principale en bas façon app : toujours visible */
    #root > div > div:nth-of-type(2) > div:first-child {
      position: fixed !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      z-index: 999 !important;
      height: calc(var(--ftv-mobile-nav-h) + var(--ftv-safe-bottom)) !important;
      padding: 8px 8px calc(8px + var(--ftv-safe-bottom)) !important;
      background: rgba(255,255,255,.96) !important;
      backdrop-filter: blur(18px) !important;
      border-top: 1px solid var(--border) !important;
      box-shadow: 0 -12px 28px rgba(15,23,42,.08) !important;
      display: grid !important;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 4px !important;
      overflow: visible !important;
    }
    #root > div > div:nth-of-type(2) > div:first-child button {
      min-width: 0 !important;
      width: 100% !important;
      height: 54px !important;
      padding: 5px 2px !important;
      border-radius: 16px !important;
      font-size: 11px !important;
      line-height: 1.05 !important;
      justify-content: center !important;
      white-space: normal !important;
    }

    /* KPI : plus d'immenses cartes horizontales. Grille tactile */
    #root > div > div:nth-of-type(2) > div:nth-child(2) {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
      overflow: visible !important;
      padding: 14px 16px !important;
      align-items: stretch !important;
      background: var(--bg2) !important;
    }
    #root > div > div:nth-of-type(2) > div:nth-child(2) > div {
      min-width: 0 !important;
      width: 100% !important;
      margin: 0 !important;
      flex: none !important;
    }
    #root > div > div:nth-of-type(2) > div:nth-child(2) > div:last-child {
      grid-column: 1 / -1 !important;
      display: flex !important;
      justify-content: space-between !important;
      gap: 10px !important;
      align-items: center !important;
    }
    #root > div > div:nth-of-type(2) > div:nth-child(2) > div:last-child button {
      flex: 1 1 0 !important;
      justify-content: center !important;
      min-height: 46px !important;
      border-radius: 16px !important;
    }

    /* Filtres/recherche */
    #root > div > div:nth-of-type(2) > div:nth-child(3) {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 10px !important;
      padding: 12px 16px !important;
      background: var(--bg2) !important;
      border-bottom: 1px solid var(--border) !important;
      overflow: visible !important;
    }
    #root > div > div:nth-of-type(2) > div:nth-child(3) > * { margin-left: 0 !important; }
    #root > div > div:nth-of-type(2) > div:nth-child(3) > div[style*="flex: 1 1 360px"] {
      flex: 1 1 100% !important;
      min-width: 0 !important;
      max-width: none !important;
      order: 5 !important;
    }
    #root > div > div:nth-of-type(2) > div:nth-child(3) input {
      height: 48px !important;
      font-size: 16px !important;
      border-radius: 999px !important;
    }

    #root > div > div:nth-of-type(2) > div:nth-child(4) {
      flex: 1 1 auto !important;
      min-height: 60dvh !important;
      overflow: visible !important;
      width: 100% !important;
      max-width: 100vw !important;
    }

    /* Anti-débordements généraux */
    [style*="width: 315px"] { width: calc(100vw - 28px) !important; max-width: calc(100vw - 28px) !important; right: 14px !important; left: auto !important; }
    [style*="grid-template-columns"] { max-width: 100% !important; }
    [style*="overflow: auto"], [style*="overflow:auto"] { -webkit-overflow-scrolling: touch !important; max-width: 100% !important; }
    button { max-width: 100% !important; }
    table { min-width: 760px !important; }
    pre, code, .mono { white-space: pre-wrap !important; word-break: break-word !important; }
  }

  @media (max-width: 560px) {
    #root > div > div:first-of-type > div:first-child { padding: 14px 14px 12px !important; }
    #root > div > div:first-of-type > div:first-child > div:nth-child(2) {
      grid-template-columns: 120px 1fr !important;
      gap: 14px !important;
    }
    #root > div > div:first-of-type > div:first-child svg { max-width: 118px !important; max-height: 118px !important; }
    #root > div > div:first-of-type > div:nth-child(2) { padding-left: 14px !important; padding-right: 14px !important; }
    #root > div > div:first-of-type > div:nth-child(2) > * { flex-basis: 190px !important; min-width: 190px !important; }
    #root > div > div:nth-of-type(2) > div:nth-child(2) { padding: 12px 14px !important; gap: 9px !important; }
    #root > div > div:nth-of-type(2) > div:nth-child(3) { padding: 12px 14px !important; }
    [style*="font-size: 30px"], [style*="font-size: 28px"] { font-size: 24px !important; }
    [style*="font-size: 24px"] { font-size: 21px !important; }
    [style*="padding: 18px 22px"] { padding: 15px 14px !important; }
  }

  @media (max-width: 390px) {
    #root > div > div:first-of-type > div:first-child > div:nth-child(2) { grid-template-columns: 104px 1fr !important; gap: 10px !important; }
    #root > div > div:first-of-type > div:first-child svg { max-width: 102px !important; max-height: 102px !important; }
    #root > div > div:nth-of-type(2) > div:nth-child(2) { grid-template-columns: 1fr !important; }
    #root > div > div:nth-of-type(2) > div:nth-child(2) > div:last-child { grid-column: auto !important; }
    #root > div > div:nth-of-type(2) > div:first-child button { font-size: 10px !important; }
  }

  /* Admin responsive */
  @media (max-width: 760px) {
    body:has(.admin-wrap), .admin-wrap { overflow-x: hidden !important; }
    .admin-top { flex-wrap: wrap !important; gap: 12px !important; }
    .admin-grid { grid-template-columns: 1fr !important; }
    .admin-card, .card { width: 100% !important; max-width: 100% !important; }
  }
</style>


<style>
/* FTV v62 — AI Copilot premium responsive layer */
.ftv-copilot-shell{padding:18px;min-height:100%;overflow:auto;background:radial-gradient(circle at 0% 0%,rgba(227,6,19,.10),transparent 28%),radial-gradient(circle at 100% 0%,rgba(14,80,180,.10),transparent 28%),#f6f7fb;}
.ftv-copilot-hero{border-radius:24px;padding:22px;background:linear-gradient(135deg,#090b13 0%,#111827 52%,#1a0d13 100%);color:#fff;box-shadow:0 22px 65px rgba(17,24,39,.24);display:grid;grid-template-columns:1.2fr .8fr;gap:18px;align-items:stretch;}
.ftv-copilot-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px;}
.ftv-copilot-card{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);border-radius:18px;padding:14px;backdrop-filter:blur(12px);}
.ftv-copilot-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px;margin-top:16px;}
.ftv-copilot-panel{background:#fff;border:1px solid rgba(17,24,39,.08);border-radius:22px;padding:16px;box-shadow:0 14px 42px rgba(17,24,39,.07);}
.ftv-copilot-pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;background:#f3f4f6;color:#374151;}
.ftv-copilot-row{display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid rgba(17,24,39,.07);}
.ftv-copilot-score{font-size:24px;font-weight:900;color:#E30613;font-variant-numeric:tabular-nums;}
.ftv-copilot-scenario{border:1px solid rgba(17,24,39,.08);background:linear-gradient(180deg,#fff,#f9fafb);border-radius:16px;padding:12px;margin-bottom:10px;}
@media (max-width: 900px){
  body{overflow-x:hidden!important;}
  .ftv-copilot-shell{padding:12px 10px 90px;}
  .ftv-copilot-hero{grid-template-columns:1fr;border-radius:20px;padding:18px;}
  .ftv-copilot-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}
  .ftv-copilot-grid{grid-template-columns:1fr;}
  .ftv-copilot-row{grid-template-columns:44px 1fr;gap:10px;}
  .ftv-copilot-row .ftv-copilot-score{grid-column:1 / -1;justify-self:start;margin-left:54px;font-size:20px;}
  [style*="width: 244px"]{width:100%!important;max-width:none!important;min-height:auto!important;}
  [style*="height: 100vh"]{height:auto!important;min-height:100vh!important;overflow:visible!important;display:block!important;}
  [style*="left: 244px"]{left:0!important;}
  button{touch-action:manipulation;}
}
@media (max-width: 560px){
  .ftv-copilot-kpis{grid-template-columns:1fr;}
  .ftv-copilot-hero h2{font-size:26px!important;line-height:1.05!important;}
  .ftv-copilot-card{padding:12px;}
  .ftv-copilot-panel{padding:13px;border-radius:18px;}
}
</style>


<style id="ftv-v72-mobile-real-scroll-fix">
/* v72: preserve the v71 mobile app design, but make the central body the ONLY vertical scroll area.
   No visual reshaping of the bottom nav; this only fixes the scroll model. */
@media (max-width:760px), (pointer:coarse) and (max-width:920px){
  html, body, #root{
    width:100% !important;
    height:100% !important;
    min-height:100dvh !important;
    overflow:hidden !important;
    overscroll-behavior:none !important;
    background:var(--bg) !important;
  }

  .ftv-mobile-app{
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    position:fixed !important;
    inset:0 !important;
    width:100vw !important;
    height:100dvh !important;
    min-height:100dvh !important;
    max-height:100dvh !important;
    display:block !important;
    overflow:hidden !important;
    touch-action:auto !important;
    background:var(--bg) !important;
  }

  .ftv-m-topbar{
    position:fixed !important;
    top:0 !important;
    left:0 !important;
    right:0 !important;
    height:calc(var(--top) + var(--safe-top)) !important;
    z-index:120 !important;
  }

  .ftv-m-sports-rail{
    position:fixed !important;
    top:calc(var(--top) + var(--safe-top)) !important;
    left:0 !important;
    right:0 !important;
    height:var(--sports) !important;
    z-index:110 !important;
    overflow-x:auto !important;
    overflow-y:hidden !important;
    -webkit-overflow-scrolling:touch !important;
    touch-action:pan-x !important;
  }

  .ftv-m-body{
    position:fixed !important;
    left:0 !important;
    right:0 !important;
    top:calc(var(--top) + var(--safe-top) + var(--sports)) !important;
    bottom:calc(var(--nav) + var(--safe-bottom)) !important;
    height:auto !important;
    min-height:0 !important;
    max-height:none !important;
    overflow-y:scroll !important;
    overflow-x:hidden !important;
    -webkit-overflow-scrolling:touch !important;
    overscroll-behavior-y:contain !important;
    touch-action:pan-y !important;
    padding:12px 12px 18px !important;
    background:var(--bg) !important;
  }

  .ftv-m-body > *{
    max-width:100% !important;
  }

  .ftv-m-bottom-nav{
    position:fixed !important;
    left:0 !important;
    right:0 !important;
    bottom:0 !important;
    z-index:130 !important;
    /* keep the v71 shape exactly */
  }

  .ftv-m-drawer-backdrop{z-index:20000 !important;}
  .ftv-m-drawer{z-index:20001 !important;}
}
</style>


<style id="ftv-v73-mobile-accordion-calendar">
/* v73: mobile-app interaction layer — calendar + all sports as accordion list. */
@media (max-width:760px), (pointer:coarse) and (max-width:920px){
  .ftv-m-sports-rail{display:none!important;}
  .ftv-mobile-app{--top:58px;--sports:0px;--nav:68px;}
  .ftv-m-body{padding-top:12px!important;}
  .ftv-m-period-row{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:center;margin:0 0 10px;}
  .ftv-m-period-btn{height:42px;border-radius:999px;border:1px solid var(--border2);background:var(--bg2);color:var(--text);display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:850;padding:0 12px;min-width:0;box-shadow:0 6px 16px rgba(15,23,42,.035)}
  .ftv-m-period-btn span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .ftv-m-export-mini{width:42px;height:42px;border-radius:999px;border:1px solid var(--border2);background:var(--bg2);color:var(--text);font-size:17px;font-weight:900;display:flex;align-items:center;justify-content:center;}
  .ftv-m-type-pills{grid-template-columns:repeat(3,minmax(0,1fr))!important;margin-bottom:0!important;}
  .ftv-m-filters{position:relative!important;top:auto!important;padding:0!important;border-bottom:0!important;margin-bottom:12px!important;background:transparent!important;}
  .ftv-m-date-dot{display:none!important;}
  .ftv-m-sports-accordion{display:flex;flex-direction:column;gap:10px;padding-bottom:10px;}
  .ftv-m-sport-acc{background:var(--bg2);border:1px solid var(--border);border-radius:22px;box-shadow:0 10px 26px rgba(15,23,42,.055);overflow:hidden;}
  .ftv-m-sport-acc-head{width:100%;border:0;background:transparent;color:var(--text);padding:14px;display:grid;grid-template-columns:48px minmax(0,1fr) auto 18px;gap:12px;align-items:center;text-align:left;}
  .ftv-m-sport-acc-ico{width:46px;height:46px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:22px;background:var(--bg3);color:var(--fg);flex:0 0 auto;}
  .ftv-m-sport-acc-title{min-width:0;}
  .ftv-m-sport-acc-title h2{margin:0;font-size:18px;line-height:1.05;font-weight:950;letter-spacing:-.04em;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .ftv-m-sport-acc-title p{margin:5px 0 0;color:var(--text3);font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .ftv-m-sport-acc-views{text-align:right;min-width:82px;}
  .ftv-m-sport-acc-views strong{display:block;font-size:17px;line-height:1;font-weight:950;letter-spacing:-.035em;color:var(--text);white-space:nowrap;}
  .ftv-m-sport-acc-views span{display:block;margin-top:4px;font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:var(--text3);font-weight:850;}
  .ftv-m-sport-acc-chevron{font-size:16px;color:var(--text3);}
  .ftv-m-sport-acc-body{padding:0 12px 12px;display:grid;gap:10px;border-top:1px solid var(--border);background:linear-gradient(180deg,var(--bg3),var(--bg2));}
  .ftv-m-sport-acc-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding-top:12px;}
  .ftv-m-sport-acc-stats .ftv-m-stat{padding:9px;border-radius:14px;box-shadow:none;}
  .ftv-m-sport-acc-stats .ftv-m-stat-label{font-size:9px;}
  .ftv-m-sport-acc-stats .ftv-m-stat-value{font-size:18px;}
  .ftv-m-sport-acc-tags{display:flex;gap:7px;flex-wrap:wrap;}
  .ftv-m-sport-acc-tags span{font-size:12px;font-weight:900;border-radius:999px;padding:6px 9px;}
  .ftv-m-sport-acc-tags .video{background:var(--type-video-bg);color:var(--blue)}
  .ftv-m-sport-acc-tags .short{background:var(--type-short-bg);color:#7A3800}
  .ftv-m-sport-acc-tags .live{background:var(--type-live-bg);color:#166534}
  .ftv-m-calendar-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.38);backdrop-filter:blur(6px);z-index:250;}
  .ftv-m-calendar-sheet{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:251;background:var(--bg2);border:1px solid var(--border);border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:16px;display:grid;gap:12px;color:var(--text);}
  .ftv-m-calendar-head{display:flex;align-items:center;justify-content:space-between;gap:12px;}
  .ftv-m-calendar-head h2{margin:0;font-size:20px;font-weight:950;letter-spacing:-.04em;}
  .ftv-m-calendar-close{width:34px;height:34px;border-radius:50%;border:1px solid var(--border2);background:var(--bg3);color:var(--text);font-size:20px;font-weight:800;}
  .ftv-m-calendar-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .ftv-m-calendar-field{display:grid;gap:6px;}
  .ftv-m-calendar-field label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--text3);font-weight:900;}
  .ftv-m-calendar-field input{height:42px;border-radius:14px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);font:800 13px var(--font);padding:0 10px;min-width:0;}
  .ftv-m-calendar-presets{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .ftv-m-calendar-presets button,.ftv-m-calendar-apply{height:42px;border-radius:14px;border:1px solid var(--border2);background:var(--bg3);color:var(--text);font:850 13px var(--font);}
  .ftv-m-calendar-apply{background:var(--red);border-color:var(--red);color:#fff;font-weight:950;}
}
</style>


<style id="ftv-v95-password-auth-ui">
.ftv-auth-link-btn{border:0;background:transparent;color:#71717A;font:inherit;font-size:13px;font-weight:800;cursor:pointer;padding:0;text-decoration:none;white-space:nowrap}.ftv-auth-link-btn:hover{color:#E2001A}.ftv-auth-reset-panel{display:grid;gap:12px}.ftv-auth-reset-panel[hidden]{display:none!important}.ftv-auth-reset-title{font-size:18px;font-weight:950;letter-spacing:-.04em;color:#18181B}.ftv-auth-reset-panel p{margin:0 0 2px!important;font-size:13px!important;color:#71717A!important;line-height:1.45!important}.ftv-password-modal-backdrop{position:fixed;inset:0;z-index:30000;background:rgba(15,23,42,.42);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:none;align-items:center;justify-content:center;padding:20px}.ftv-password-modal-backdrop.is-open{display:flex}.ftv-password-modal{width:min(420px,100%);background:var(--bg2,#fff);color:var(--text,#111);border:1px solid var(--border,#e5e7eb);border-radius:28px;box-shadow:0 32px 110px rgba(15,23,42,.28);padding:24px;box-sizing:border-box}.ftv-password-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.ftv-password-modal h2{margin:0;font-size:24px;line-height:1;letter-spacing:-.055em}.ftv-password-modal p{margin:7px 0 0;color:var(--text3,#71717A);font-size:13px;line-height:1.45}.ftv-password-close{width:38px;height:38px;border-radius:14px;border:1px solid var(--border2,#e5e7eb);background:var(--bg4,#f5f5f5);color:var(--text,#111);font-size:19px;cursor:pointer}.ftv-password-field{display:grid;gap:7px;margin-bottom:12px}.ftv-password-field label{font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--text3,#71717A)}.ftv-password-field input{width:100%;box-sizing:border-box;border:1px solid var(--border,#ddd);background:var(--bg1,#fff);color:var(--text,#111);border-radius:15px;padding:13px 14px;font:inherit;font-size:14px;outline:none}.ftv-password-field input:focus{border-color:var(--red,#E2001A);box-shadow:0 0 0 4px rgba(226,0,26,.09)}.ftv-password-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:16px}.ftv-password-actions button{height:48px;border-radius:16px;font:inherit;font-size:14px;font-weight:950;cursor:pointer}.ftv-password-cancel{border:1px solid var(--border2,#ddd);background:var(--bg2,#fff);color:var(--text3,#777)}.ftv-password-save{border:0;background:var(--red,#E2001A);color:#fff}.ftv-password-msg{min-height:18px;font-size:12.5px;color:var(--text3,#71717A);line-height:1.4}.ftv-password-msg.is-error{color:#BE123C;font-weight:800}.ftv-password-msg.is-success{color:#047857;font-weight:800}@media(max-width:560px){.ftv-auth-row{align-items:flex-start;flex-direction:column}.ftv-password-modal-backdrop{align-items:flex-end;padding:14px}.ftv-password-modal{border-radius:26px}.ftv-password-actions{grid-template-columns:1fr}}
</style>

<style id="ftv-v98-client-platform-styles">
html.ftv-presentation-mode .ftv-sidebar select,
html.ftv-presentation-mode [title*="admin"],
html.ftv-presentation-mode .ftv-debug,
html.ftv-presentation-mode .ftv-technical-note { display:none !important; }
html.ftv-presentation-mode .ftv-main-tabs button:nth-last-child(1){ opacity:.92; }
.ftv-v98-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900;white-space:nowrap}.ftv-v98-btn{border:1px solid var(--border2);background:var(--bg3);color:var(--text);border-radius:14px;padding:10px 12px;font:inherit;font-size:12px;font-weight:900;cursor:pointer}.ftv-v98-btn.primary{background:var(--red);border-color:var(--red);color:#fff}.ftv-v98-panel{border:1px solid var(--border);background:var(--bg2);border-radius:22px;padding:18px;box-shadow:0 16px 40px rgba(15,23,42,.06)}.ftv-v98-title{font-size:18px;font-weight:950;letter-spacing:-.04em;margin:0 0 8px;color:var(--text)}.ftv-v98-muted{font-size:12px;color:var(--text3);line-height:1.5}.ftv-v98-list{display:grid;gap:10px}.ftv-v98-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;border-bottom:1px solid var(--border);padding:10px 0}.ftv-v98-row:last-child{border-bottom:0}.ftv-v98-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}html[data-ftv-theme="dark"] .ftv-v98-panel{box-shadow:none}
@media(max-width:760px){.ftv-v98-grid{grid-template-columns:1fr}.ftv-v98-panel{padding:14px;border-radius:18px}}
</style>

<style id="ftv-v108-analytics-visibility-fix">
.ftv-analytics-view > div:first-child{display:grid!important;visibility:visible!important;opacity:1!important;}
.ftv-analytics-view .ftv-analytics-load-btn{height:42px;background:var(--red)!important;color:#fff!important;border:0!important;border-radius:12px!important;font-weight:950!important;cursor:pointer!important;font-family:var(--font)!important;box-shadow:0 12px 24px rgba(226,0,26,.18)!important;}
@media(max-width:760px){.ftv-analytics-view > div:first-child{grid-template-columns:1fr!important}.ftv-analytics-view .ftv-analytics-load-btn{width:100%!important}}
</style>
</head><body><table>
  <tr><td class="title" colspan="17">${safeExcelText(title)}</td></tr><tr><td class="subtitle" colspan="17">${safeExcelText(subtitle || 'Export généré depuis le dashboard france.tv YouTube Analytics')}</td></tr>
  <tr><td class="metaLabel">Période</td><td class="metaValue" colspan="3">${safeExcelText(period)}</td><td class="metaLabel">Exporté le</td><td class="metaValue" colspan="3">${safeExcelText(exportedAt)}</td><td class="metaLabel">Vues publiques</td><td class="metaValue number" colspan="3">${Math.round(totalViews)}</td><td class="metaLabel">Watch time</td><td class="metaValue number" colspan="3">${Math.round(totalWatch)}</td></tr>
  <tr><td class="metaLabel">Contenus</td><td class="metaValue" colspan="3">${rows.length}</td><td class="metaLabel">Catégories exportées</td><td class="metaValue" colspan="3">${summary.length}</td><td class="metaLabel">Impressions</td><td class="metaValue number" colspan="3">${Math.round(totalImpressions)}</td><td class="metaLabel">Moy. vues/contenu</td><td class="metaValue number" colspan="3">${Math.round(totalViews / Math.max(1, rows.length))}</td></tr>
  <tr><td class="section" colspan="17">Synthèse par catégorie</td></tr><tr><th class="header">Sport / Thématique</th><th class="header">Compétition / Sous-catégorie</th><th class="header">Contenus</th><th class="header">Vidéos</th><th class="header">Shorts</th><th class="header">Lives</th><th class="header">Vues</th><th class="header" colspan="2">Part dans l'export</th></tr>${summaryRows}
  <tr><td class="section" colspan="17">Détail des contenus + Analytics</td></tr><tr><th class="header">Sport / Thématique</th><th class="header">Compétition / Sous-catégorie</th><th class="header">Type</th><th class="header">Titre</th><th class="header">Date</th><th class="header">Durée sec.</th><th class="header">Vues publiques</th><th class="header">Vues Analytics</th><th class="header">Watch time min.</th><th class="header">Durée moy. sec.</th><th class="header">Impressions</th><th class="header">CTR</th><th class="header">Abonnés +</th><th class="header">Abonnés -</th><th class="header">Shares</th><th class="header">URL YouTube</th><th class="header">ID</th></tr>${detailRows}
  <tr><td class="note" colspan="17">Note : export Excel HTML (.xls) mis en forme pour analyse. Les colonnes Analytics sont renseignées si la connexion YouTube Analytics a été chargée avant l'export ; sinon elles restent à 0.</td></tr>
</table></body></html>`;
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: safeFilename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}
// ─── ANIMATED NUMBER ──────────────────────────────────────────────────────────
function AnimNum({ value, duration = 220, format = fmt }) {
    const [d, setD] = useState(0);
    const s = useRef(null), r = useRef(null);
    useEffect(() => {
        s.current = null;
        if (r.current)
            cancelAnimationFrame(r.current);
        const raf = ts => {
            if (!s.current)
                s.current = ts;
            const p = Math.min((ts - s.current) / duration, 1);
            setD(Math.round((1 - Math.pow(1 - p, 3)) * value));
            if (p < 1)
                r.current = requestAnimationFrame(raf);
        };
        r.current = requestAnimationFrame(raf);
        return () => { if (r.current)
            cancelAnimationFrame(r.current); };
    }, [value]);
    return React.createElement(React.Fragment, null, format(d));
}
// ─── DONUT RING (fermé, segments normalisés) ──────────────────────────────────
function DonutRing({ activeSport, sportsData, totalViews, onSelectSport }) {
    const sz = 128, cx = 64, cy = 64, r = 46, sw = 7;
    const circ = 2 * Math.PI * r;
    const [drawn, setDrawn] = useState(false);
    const [hovered, setHovered] = useState(null);
    useEffect(() => { const t = setTimeout(() => setDrawn(true), 80); return () => clearTimeout(t); }, []);
    const total = sportsData.reduce((s, [, d]) => s + d.views, 0) || 1;
    const GAP = 0.007;
    let cum = 0;
    const segs = sportsData.map(([sport, data]) => {
        const frac = data.views / total;
        const seg = { sport, color: data.fg, start: cum, frac };
        cum += frac;
        return seg;
    });
    const hovSeg = hovered ? segs.find(s => s.sport === hovered) : null;
    return (React.createElement("div", { style: { position: 'relative', flexShrink: 0 } },
        React.createElement("svg", { width: sz, height: sz, viewBox: `0 0 ${sz} ${sz}`, style: { display: 'block', cursor: 'pointer' } },
            React.createElement("circle", { cx: cx, cy: cy, r: r, fill: "none", stroke: "rgba(0,0,0,0.03)", strokeWidth: sw }),
            segs.map(({ sport, start, frac }) => {
                const len = drawn ? Math.max(0, (frac - 0.001) * circ) : 0;
                const off = circ * (0.25 - start);
                return React.createElement("circle", { key: `hit-${sport}`, cx: cx, cy: cy, r: r, fill: "none", stroke: "transparent", strokeWidth: sw + 14, strokeDasharray: `${len} ${circ}`, strokeDashoffset: off, strokeLinecap: "butt", style: { cursor: 'pointer' }, onClick: () => onSelectSport && onSelectSport(sport), onMouseEnter: () => setHovered(sport), onMouseLeave: () => setHovered(null) });
            }),
            segs.map(({ sport, color, start, frac }) => {
                const len = drawn ? Math.max(0, (frac - GAP) * circ) : 0;
                const off = circ * (0.25 - start);
                const active = activeSport === sport;
                const isHov = hovered === sport;
                return React.createElement("circle", { key: sport, cx: cx, cy: cy, r: r, fill: "none", stroke: active || isHov ? color : color + '55', strokeWidth: active ? sw + 3 : isHov ? sw + 1.5 : sw, strokeDasharray: `${len} ${circ}`, strokeDashoffset: off, strokeLinecap: "butt", style: { transition: 'stroke-dasharray .25s ease,stroke .12s,stroke-width .12s', pointerEvents: 'none' } });
            }),
            hovSeg ? (React.createElement(React.Fragment, null,
                React.createElement("text", { x: cx, y: cy - 5, textAnchor: "middle", fill: hovSeg.color, fontFamily: "'Outfit'", fontWeight: "800", fontSize: "12", style: { pointerEvents: 'none' } }, hovSeg.sport.split(' ')[0]),
                React.createElement("text", { x: cx, y: cy + 9, textAnchor: "middle", fill: hovSeg.color, fontFamily: "'Outfit'", fontSize: "10", fontWeight: "600", style: { pointerEvents: 'none' } },
                    ((hovSeg.frac * 100).toFixed(1)),
                    "%"))) : (React.createElement(React.Fragment, null,
                React.createElement("text", { x: cx, y: cy - 4, textAnchor: "middle", fill: "var(--text)", fontFamily: "'Outfit'", fontWeight: "800", fontSize: "15" }, fmt(totalViews)),
                React.createElement("text", { x: cx, y: cy + 11, textAnchor: "middle", fill: "var(--text3)", fontFamily: "'Outfit'", fontSize: "7.5", fontWeight: "500", letterSpacing: "0.6" }, "VUES TOTALES"))))));
}
// ─── SPORT NAV ITEM ───────────────────────────────────────────────────────────
function SportNavItem({ sport, data, active, onClick, delay, maxViews, exportMode, checked, onCheck }) {
    const [m, setM] = useState(false);
    useEffect(() => { const t = setTimeout(() => setM(true), delay); return () => clearTimeout(t); }, []);
    const pct = Math.round((data.views / maxViews) * 100);
    return (React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 0, opacity: m ? 1 : 0, transform: m ? 'none' : 'translateX(-8px)', transition: 'opacity .12s,transform .12s' } },
        exportMode && React.createElement("label", { onClick: e => e.stopPropagation(), style: { display: 'flex', alignItems: 'center', padding: '0 4px 0 6px', cursor: 'pointer' } },
            React.createElement("input", { type: "checkbox", checked: checked, onChange: () => onCheck(sport), style: { accentColor: 'var(--red)', width: 13, height: 13 } })),
        React.createElement("button", { onClick: onClick, style: {
                flex: 1, display: 'flex', alignItems: 'center', gap: 9, background: active ? data.bg : 'transparent',
                border: `1px solid ${active ? data.fg + '33' : 'transparent'}`, borderRadius: 9, padding: '8px 10px',
                cursor: 'pointer', textAlign: 'left', transition: 'all .10s', minWidth: 0
            } },
            React.createElement("div", { style: { width: 26, height: 26, borderRadius: 7, background: active ? 'rgba(255,255,255,0.55)' : data.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 } }, data.i),
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                React.createElement("div", { style: { fontWeight: 600, fontSize: 13, color: active ? data.fg : 'var(--text2)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.1px' } }, sport),
                React.createElement("div", { style: { marginTop: 3, height: 2, borderRadius: 1, background: 'rgba(0,0,0,0.07)', overflow: 'hidden' } },
                    React.createElement("div", { style: { height: '100%', borderRadius: 1, background: data.fg, width: `${pct}%`,
                            transition: 'width .12s ease' } }))),
            React.createElement("div", { style: { fontWeight: 700, fontSize: 12, color: active ? data.fg : 'var(--text3)', letterSpacing: '0.3px', flexShrink: 0 } }, fmt(data.views)))));
}
// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, delay, format }) {
    const [m, setM] = useState(false);
    useEffect(() => { const t = setTimeout(() => setM(true), delay); return () => clearTimeout(t); }, []);
    return (React.createElement("div", { className: "ftv-kpi-card", style: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 16px',
            flex: 1, minWidth: 0, opacity: m ? 1 : 0, transform: m ? 'none' : 'translateY(8px)', transition: 'opacity .16s,transform .16s', position: 'relative', overflow: 'hidden' } },
        accent && React.createElement("div", { className: "ftv-kpi-accent", style: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: accent, borderRadius: '12px 12px 0 0' } }),
        React.createElement("div", { className: "ftv-kpi-label", style: { fontSize: 9.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1.1px', marginBottom: 5 } }, label),
        React.createElement("div", { className: "ftv-kpi-value", style: { fontWeight: 800, fontSize: 28, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1 } }, m ? React.createElement(AnimNum, { value: value, format: format || fmt }) : '—'),
        sub && React.createElement("div", { className: "ftv-kpi-sub", style: { fontSize: 10, color: 'var(--text3)', marginTop: 3 } }, sub)));
}
// ─── TYPE TAB ─────────────────────────────────────────────────────────────────
const TYPE_COLORS = { video: '#0B3F7A', short: '#7A3800', live: '#1A5C1A', all: 'var(--text)' };
const TYPE_BG = { video: '#E5EFF9', short: '#FAEEDA', live: '#E8F5E8', all: 'var(--bg4)' };
function TypeTab({ id, label, count, active, onClick }) {
    return (React.createElement("button", { onClick: onClick, style: { display: 'flex', alignItems: 'center', gap: 6,
            background: active ? TYPE_COLORS[id] : 'var(--bg3)', color: active ? '#fff' : 'var(--text2)',
            border: `1px solid ${active ? 'transparent' : 'var(--border2)'}`, borderRadius: 20,
            padding: '5px 13px', cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, transition: 'all .14s' } },
        label,
        React.createElement("span", { style: { fontSize: 10, padding: '1px 6px', borderRadius: 20, fontWeight: 600,
                background: active ? 'rgba(255,255,255,0.22)' : TYPE_BG[id], color: active ? '#fff' : TYPE_COLORS[id] } }, count)));
}
// ─── VIDEO ROW (drill-down) ───────────────────────────────────────────────────
function VideoRow({ v, exportMode, checked, onCheck, fg, onReclassify }) {
    const d = getVidDate(v);
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    const typeColor = { video: TYPE_COLORS.video, short: TYPE_COLORS.short, live: TYPE_COLORS.live }[v.type] || '#888';
    const typeBg = { video: TYPE_BG.video, short: TYPE_BG.short, live: TYPE_BG.live }[v.type] || '#eee';
    // Diagnostic de classification : au survol, on affiche les mots-clés qui
    // ont déclenché la classification, pour identifier facilement les faux
    // positifs sur des shorts mal rangés.
    const cls = classify(v);
    const dbg = cls._debug || {};
    const isOverridden = dbg.confidence === 'manual_override';
    const mainTaxonomyLabel = (window.isGeneralChannel && window.isGeneralChannel(v.channelKey)) ? 'Thématique' : 'Sport';
    const subTaxonomyLabel = (window.isGeneralChannel && window.isGeneralChannel(v.channelKey)) ? 'Sous-catégorie' : 'Compétition';
    const tooltip = `${v.title}\n\n— Classement —\n${mainTaxonomyLabel} : ${cls.s}${isOverridden ? ' (correction manuelle)' : ''}\n${subTaxonomyLabel} : ${cls.c}\nConfiance : ${dbg.confidence || '?'}\nScore : ${dbg.score || 0}\nMots-clés détectés : ${(dbg.kws || []).join(', ') || 'aucun'}\n\nClic sur le bouton ⋮ pour reclasser cette vidéo manuellement.`;
    const youtubeUrl = getVideoUrl(v);
    const durationSecs = getVideoDurationSecs(v);
    return (React.createElement("div", { className: "ftv-video-row", style: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 20px 7px 36px',
            borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background .12s' }, onMouseEnter: e => e.currentTarget.style.background = 'rgba(0,0,0,0.015)', onMouseLeave: e => e.currentTarget.style.background = 'transparent' },
        exportMode && React.createElement("input", { type: "checkbox", checked: checked, onChange: () => onCheck(v.id), style: { accentColor: 'var(--red)', width: 12, height: 12, flexShrink: 0 } }),
        React.createElement("span", { style: { fontSize: 9.5, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                background: typeBg, color: typeColor, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px' } }, v.type === 'video' ? 'Vid' : v.type === 'short' ? 'Short' : 'Live'),
        isOverridden && React.createElement("span", { title: "Cette vid\u00E9o a \u00E9t\u00E9 reclass\u00E9e manuellement", style: { fontSize: 10, color: '#7A3800', background: '#FEF3E2', padding: '1px 5px', borderRadius: 3, flexShrink: 0 } }, "\u270B"),
        React.createElement(youtubeUrl ? "a" : "span", { href: youtubeUrl || undefined, target: youtubeUrl ? "_blank" : undefined, rel: youtubeUrl ? "noopener noreferrer" : undefined, onClick: e => { if (youtubeUrl) e.stopPropagation(); }, style: { flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', cursor: youtubeUrl ? 'pointer' : 'default', display: 'block' }, title: tooltip }, v.title),
        React.createElement("span", { style: { fontSize: 10.5, color: 'var(--text3)', flexShrink: 0 } }, dateStr),
        React.createElement("span", { title: 'Durée de la vidéo', style: { fontSize: 10.5, color: 'var(--text3)', flexShrink: 0, minWidth: 54, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, fmtDuration(durationSecs, true)),
        React.createElement("span", { style: { fontWeight: 700, fontSize: 12, color: fg, flexShrink: 0, minWidth: 68, textAlign: 'right',
                fontVariantNumeric: 'tabular-nums' } }, fmtFull(v.views)),
        React.createElement("button", { title: "Reclasser cette vid\u00E9o", "aria-label": "Reclasser cette vid\u00E9o", onClick: (e) => { e.stopPropagation(); onReclassify && onReclassify(v); }, style: { background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                padding: '2px 4px', fontSize: 14, lineHeight: 1, flexShrink: 0, opacity: 0.5, transition: 'opacity .12s' }, onMouseEnter: (e) => e.currentTarget.style.opacity = 1, onMouseLeave: (e) => e.currentTarget.style.opacity = 0.5 }, "\u22EE")));
}
// ─── COMP ROW (cliquable, accordéon) ─────────────────────────────────────────
function CompRow({ name, compData, maxViews, fg, bg, index, exportMode, checked, onCheck, selectedVideos, onCheckVideo, onReclassify }) {
    const [expanded, setExpanded] = useState(false);
    const [sortBy, setSortBy] = useState('views'); // 'views' | 'date'
    const [barW, setBarW] = useState(0);
    useEffect(() => { const t = setTimeout(() => setBarW((compData.views / maxViews) * 100), Math.min(30 + index * 5, 90)); return () => clearTimeout(t); }, [compData.views, maxViews]);
    const videos = useMemo(() => [...compData.videos].sort((a, b) => sortBy === 'views' ? b.views - a.views : (getVidDate(b) - getVidDate(a))), [compData.videos, sortBy]);
    const videoStats = useMemo(() => {
        const acc = { video: { count: 0, views: 0 }, short: { count: 0, views: 0 }, live: { count: 0, views: 0 } };
        videos.forEach(v => { const t = acc[v.type] || acc.video; t.count++; t.views += v.views || 0; });
        return acc;
    }, [videos]);
    const nV = videoStats.video.count;
    const nS = videoStats.short.count;
    const nL = videoStats.live.count;
    const avg = Math.round(compData.views / (videos.length || 1));
    const compDuration = videos.reduce((s, v) => s + getVideoDurationSecs(v), 0);
    const avgDuration = Math.round(compDuration / (videos.length || 1));
    const top = videos[0] || {};
    const [visibleLimit, setVisibleLimit] = useState(180);
    useEffect(() => setVisibleLimit(180), [name, compData]);
    return (React.createElement("div", { className: "ftv-comp-row", style: { borderBottom: '1px solid var(--border)' } },
        React.createElement("div", { className: "ftv-comp-row-head", style: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', cursor: 'pointer', transition: 'background .14s' }, onClick: () => setExpanded(e => !e), onMouseEnter: e => e.currentTarget.style.background = 'rgba(0,0,0,0.018)', onMouseLeave: e => e.currentTarget.style.background = 'transparent' },
            exportMode && React.createElement("input", { type: "checkbox", checked: checked, onChange: e => { e.stopPropagation(); onCheck(name); }, onClick: e => e.stopPropagation(), style: { accentColor: 'var(--red)', width: 13, height: 13, flexShrink: 0 } }),
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, minWidth: 0, overflow: 'hidden' } },
                    React.createElement("span", { style: { fontWeight: 700, fontSize: 14, color: 'var(--text)', letterSpacing: '0.1px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, display: 'block', flex: 1 } }, name),
                    React.createElement("span", { style: { fontSize: 9, color: expanded ? fg : 'var(--text3)', transition: 'color .2s', flexShrink: 0 } }, expanded ? '▲' : '▼')),
                React.createElement("div", { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
                    nV > 0 && React.createElement("span", { style: { fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: TYPE_BG.video, color: TYPE_COLORS.video } },
                        nV,
                        " vid."),
                    nS > 0 && React.createElement("span", { style: { fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: TYPE_BG.short, color: TYPE_COLORS.short } },
                        nS,
                        " short",
                        nS > 1 ? 's' : ''),
                    nL > 0 && React.createElement("span", { style: { fontSize: 9.5, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: TYPE_BG.live, color: TYPE_COLORS.live } },
                        nL,
                        " live",
                        nL > 1 ? 's' : ''))),
            React.createElement("div", { style: { width: 200, flexShrink: 0 } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 } },
                    React.createElement("div", { style: { flex: 1, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.07)', overflow: 'hidden', display: 'flex' } },
                        nV > 0 && React.createElement("div", { style: { height: '100%', background: TYPE_COLORS.video, width: `${(videoStats.video.views / compData.views) * barW}%`, opacity: .8, transition: 'width .18s ease' } }),
                        nS > 0 && React.createElement("div", { style: { height: '100%', background: TYPE_COLORS.short, width: `${(videoStats.short.views / compData.views) * barW}%`, opacity: .8, transition: 'width .18s ease' } }),
                        nL > 0 && React.createElement("div", { style: { height: '100%', background: TYPE_COLORS.live, width: `${(videoStats.live.views / compData.views) * barW}%`, opacity: .8, transition: 'width .18s ease' } })),
                    React.createElement("span", { style: { fontWeight: 700, fontSize: 13, color: 'var(--text)', minWidth: 68, textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums', flexShrink: 0 } }, fmtFull(compData.views))),
                React.createElement("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' } },
                    React.createElement("span", { style: { fontSize: 9, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' } },
                        "Durée ",
                        fmtDuration(compDuration, true)),
                    React.createElement("span", { style: { fontSize: 9, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' } },
                        "moy. ",
                        fmtDuration(avgDuration, true))),
                React.createElement("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                    nV > 0 && React.createElement("span", { style: { fontSize: 9, color: TYPE_COLORS.video } },
                        "\u25AA ",
                        fmtFull(videoStats.video.views),
                        " vid."),
                    nS > 0 && React.createElement("span", { style: { fontSize: 9, color: TYPE_COLORS.short } },
                        "\u25AA ",
                        fmtFull(videoStats.short.views),
                        " sh."))),
            React.createElement("div", { style: { width: 90, flexShrink: 0, textAlign: 'right' } },
                React.createElement("div", { style: { fontSize: 10, color: 'var(--text3)' } }, "moy./vid\u00E9o"),
                React.createElement("div", { style: { fontWeight: 600, fontSize: 12, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' } }, fmtFull(avg)))),
        expanded && (React.createElement("div", { style: { background: `${bg}44`, borderTop: '1px solid var(--border)', animation: 'fadeUp .2s ease' } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 18px 6px 36px',
                    borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' } },
                React.createElement("span", { style: { fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 } }, "Trier par"),
                [['views', 'Vues'], ['date', 'Date']].map(([v, l]) => (React.createElement("button", { key: v, onClick: e => { e.stopPropagation(); setSortBy(v); }, style: {
                        fontSize: 10.5, padding: '2px 9px', borderRadius: 20, fontWeight: sortBy === v ? 700 : 400,
                        background: sortBy === v ? fg : 'var(--bg4)', color: sortBy === v ? '#fff' : 'var(--text3)',
                        border: `1px solid ${sortBy === v ? fg : 'var(--border2)'}`, cursor: 'pointer',
                        fontFamily: 'var(--font)', transition: 'all .12s'
                    } }, l)))),
            [
                { type: 'video', label: 'Vidéos', color: TYPE_COLORS.video, bg: TYPE_BG.video },
                { type: 'short', label: 'Shorts', color: TYPE_COLORS.short, bg: TYPE_BG.short },
                { type: 'live', label: 'Lives', color: TYPE_COLORS.live, bg: TYPE_BG.live },
            ].map(({ type, label, color, bg: tbg }) => {
                const group = [...videos].filter(v => v.type === type).sort((a, b) => sortBy === 'date' ? (getVidDate(b) - getVidDate(a)) : (b.views - a.views));
                if (!group.length)
                    return null;
                const groupViews = group.reduce((s, v) => s + v.views, 0);
                const groupDuration = group.reduce((s, v) => s + getVideoDurationSecs(v), 0);
                return (React.createElement("div", { key: type },
                    React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 20px 5px 36px',
                            background: tbg, borderBottom: `1px solid ${color}22` } },
                        React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '1px' } }, label),
                        React.createElement("span", { style: { fontSize: 10, color, opacity: .7 } },
                            group.length,
                            " contenu",
                            group.length > 1 ? 's' : ''),
                        React.createElement("span", { style: { marginLeft: 'auto', fontSize: 11, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' } },
                            fmtFull(groupViews),
                            " vues"),
                        React.createElement("span", { style: { fontSize: 10, color, opacity: .8, fontVariantNumeric: 'tabular-nums' } },
                            "durée ",
                            fmtDuration(groupDuration, true)),
                        React.createElement("span", { style: { fontSize: 10, color, opacity: .7, fontVariantNumeric: 'tabular-nums' } },
                            "moy. vues ",
                            fmtFull(Math.round(groupViews / group.length)))),
                    group.slice(0, visibleLimit).map(v => (React.createElement(VideoRow, { key: v.id, v: v, exportMode: exportMode, checked: selectedVideos?.has(v.id) || false, onCheck: onCheckVideo, fg: color, onReclassify: onReclassify }))),
                    group.length > visibleLimit && (React.createElement("div", { style: { padding: '8px 20px 10px 36px' } },
                        React.createElement("button", { onClick: () => setVisibleLimit(n => n + 180), style: { border: '1px solid var(--border2)', background: 'var(--bg2)', borderRadius: 8, padding: '7px 10px', fontSize: 11, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)' } },
                            "Afficher 180 contenus de plus \u00B7 ",
                            group.length - visibleLimit,
                            " restants")))));
            })))));
}
// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
function DetailPanel({ sport, data, totalViews, typeFilter, exportMode, selectedComps, onCheckComp, selectedVideos, onCheckVideo, taxonomyMode = 'sport', onReclassify }) {
    const taxonomy = taxonomyMode === 'general' ? { unit: 'sous-catégorie', header: 'Sous-catégorie' } : { unit: 'compétition', header: 'Compétition' };
    const filteredComps = useMemo(() => (Object.entries(data.comps).map(([n, cd]) => {
        const vids = typeFilter === 'all' ? cd.videos : cd.videos.filter(v => v.type === typeFilter);
        if (!vids.length)
            return null;
        return [n, { videos: vids, views: vids.reduce((s, v) => s + v.views, 0), duration: vids.reduce((s, v) => s + getVideoDurationSecs(v), 0) }];
    }).filter(Boolean).sort((a, b) => b[1].views - a[1].views)), [data, typeFilter]);
    const allVids = filteredComps.flatMap(([, cd]) => cd.videos);
    const totalV = allVids.reduce((s, v) => s + v.views, 0);
    const totalDuration = allVids.reduce((s, v) => s + getVideoDurationSecs(v), 0);
    const maxC = filteredComps[0]?.[1]?.views || 1;
    const nV = allVids.filter(v => v.type === 'video').length;
    const nS = allVids.filter(v => v.type === 'short').length;
    const nL = allVids.filter(v => v.type === 'live').length;
    const [compactHeader, setCompactHeader] = useState(false);
    return (React.createElement("div", { className: `ftv-detail-panel ${compactHeader ? 'is-compact' : ''}`, style: { display: 'flex', flexDirection: 'column', height: '100%', animation: 'slideIn .12s ease' } },
        React.createElement("div", { className: "ftv-detail-header", style: { padding: compactHeader ? '7px 18px' : '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexShrink: 0, background: 'var(--bg2)', transition: 'padding .16s ease, min-height .16s ease' } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 11 } },
                React.createElement("div", { style: { width: compactHeader ? 30 : 40, height: compactHeader ? 30 : 40, borderRadius: compactHeader ? 9 : 11, background: data.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: compactHeader ? 15 : 19, border: `1px solid ${data.fg}22`, transition: 'all .16s ease' } }, data.i),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontWeight: 900, fontSize: compactHeader ? 15 : 20, letterSpacing: '0.3px', color: 'var(--text)', textTransform: 'uppercase', transition: 'font-size .16s ease' } }, sport),
                    !compactHeader && React.createElement("div", { style: { fontSize: 10.5, color: 'var(--text3)', marginTop: 1 } },
                        filteredComps.length,
                        " ",
                        taxonomy.unit,
                        filteredComps.length > 1 ? 's' : '',
                        " \u00B7 ",
                        allVids.length,
                        " contenu",
                        allVids.length > 1 ? 's' : ''))),
            !compactHeader && React.createElement("div", { style: { display: 'flex', gap: 18 } }, [
                { v: fmt(totalV), l: 'vues' },
                { v: fmtDuration(totalDuration), l: 'durée totale' },
                { v: fmtDuration(Math.round(totalDuration / (allVids.length || 1)), true), l: 'durée moy.' },
                { v: fmtFull(Math.round(totalV / (allVids.length || 1))), l: 'moy./vidéo' },
                { v: ((totalV / totalViews) * 100).toFixed(1) + '%', l: 'part totale', c: data.fg },
            ].map(({ v, l, c }) => (React.createElement("div", { key: l, style: { textAlign: 'right' } },
                React.createElement("div", { style: { fontWeight: 800, fontSize: 18, color: c || 'var(--text)' } }, v),
                React.createElement("div", { style: { fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px' } }, l)))))),
        React.createElement("div", { className: "ftv-detail-type-pills", style: { display: 'flex', gap: 7, padding: compactHeader ? '4px 18px' : '8px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0,
                flexWrap: 'wrap', background: 'var(--bg3)', transition: 'padding .16s ease' } }, [[nV, 'Vidéos', TYPE_BG.video, TYPE_COLORS.video], [nS, 'Shorts', TYPE_BG.short, TYPE_COLORS.short], [nL, 'Lives', TYPE_BG.live, TYPE_COLORS.live]]
            .filter(([n]) => n > 0).map(([n, l, b, c]) => (React.createElement("div", { key: l, style: { display: 'flex', alignItems: 'center', gap: 5, background: b, borderRadius: 7, padding: '4px 9px' } },
            React.createElement("span", { style: { fontSize: 10.5, color: c, fontWeight: 600 } },
                n,
                " ",
                l))))),
        React.createElement("div", { className: "ftv-comp-list-header", style: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 18px',
                borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.015)', flexShrink: 0 } },
            exportMode && React.createElement("div", { style: { width: 13, flexShrink: 0 } }),
            React.createElement("div", { style: { flex: 1, fontSize: 9.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px' } },
                taxonomy.header,
                " \u2014 cliquer pour le d\u00E9tail des vid\u00E9os"),
            React.createElement("div", { style: { width: 200, flexShrink: 0, fontSize: 9.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px', textAlign: 'right', paddingRight: 0 } }, "Vues + durée"),
            React.createElement("div", { style: { width: 90, flexShrink: 0, fontSize: 9.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px', textAlign: 'right' } }, "Moy./vid\u00E9o")),
        React.createElement("div", { className: "ftv-comp-list", onScroll: e => setCompactHeader(e.currentTarget.scrollTop > 36), style: { overflowY: 'auto', flex: 1 } },
            filteredComps.map(([name, cd], i) => (React.createElement(CompRow, { key: name, name: name, compData: cd, maxViews: maxC, fg: data.fg, bg: data.bg, index: i, exportMode: exportMode, checked: selectedComps?.has(`${sport}::${name}`) || false, onCheck: n => onCheckComp(`${sport}::${n}`), selectedVideos: selectedVideos, onCheckVideo: onCheckVideo, onReclassify: onReclassify }))),
            filteredComps.length === 0 && (React.createElement("div", { style: { padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 } }, "Aucun contenu pour ce filtre.")))));
}
// ─── CALENDAR PICKER ──────────────────────────────────────────────────────────
// ─── CHARTS VIEW ─────────────────────────────────────────────────────────────
function ChartsView({ sportsData, totalViews, typeFilter, onSelectSport }) {
    const sorted = Object.entries(sportsData)
        .sort((a, b) => {
        if (a[0] === 'Autres sports')
            return 1;
        if (b[0] === 'Autres sports')
            return -1;
        return b[1].views - a[1].views;
    });
    const maxV = sorted[0]?.[1]?.views || 1;
    const [expanded, setExpanded] = useState(null);
    const TYPE_C = { video: '#0B3F7A', short: '#7A3800', live: '#1A5C1A' };
    const TYPE_BG_C = { video: '#E5EFF9', short: '#FAEEDA', live: '#E8F5E8' };
    return (React.createElement("div", { className: "ftv-charts-view", style: { height: '100%', overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 6 } },
        React.createElement("div", { style: { display: 'flex', gap: 14, marginBottom: 8, flexShrink: 0 } },
            [['video', 'Vidéos'], ['short', 'Shorts'], ['live', 'Lives']].map(([t, l]) => (React.createElement("div", { key: t, style: { display: 'flex', alignItems: 'center', gap: 5 } },
                React.createElement("div", { style: { width: 10, height: 10, borderRadius: 2, background: TYPE_C[t] } }),
                React.createElement("span", { style: { fontSize: 11, color: 'var(--text3)' } }, l)))),
            React.createElement("span", { style: { fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' } }, "Cliquer sur un sport pour voir le d\u00E9tail comp\u00E9titions")),
        sorted.map(([sport, data]) => {
            const allVids = Object.values(data.comps).flatMap(c => c.videos);
            const filtered = typeFilter === 'all' ? allVids : allVids.filter(v => v.type === typeFilter);
            const views = filtered.reduce((s, v) => s + v.views, 0);
            if (!views)
                return null;
            const nV = allVids.filter(v => v.type === 'video').reduce((s, v) => s + v.views, 0);
            const nS = allVids.filter(v => v.type === 'short').reduce((s, v) => s + v.views, 0);
            const nL = allVids.filter(v => v.type === 'live').reduce((s, v) => s + v.views, 0);
            const total = nV + nS + nL || 1;
            const pct = (views / maxV) * 100;
            const isExp = expanded === sport;
            // Sub-competition data
            const comps = Object.entries(data.comps)
                .map(([n, cd]) => {
                const cvids = typeFilter === 'all' ? cd.videos : cd.videos.filter(v => v.type === typeFilter);
                return { n, views: cvids.reduce((s, v) => s + v.views, 0),
                    nV: cd.videos.filter(v => v.type === 'video').reduce((s, v) => s + v.views, 0),
                    nS: cd.videos.filter(v => v.type === 'short').reduce((s, v) => s + v.views, 0),
                    nL: cd.videos.filter(v => v.type === 'live').reduce((s, v) => s + v.views, 0),
                };
            })
                .filter(c => c.views > 0)
                .sort((a, b) => b.views - a.views);
            const maxComp = comps[0]?.views || 1;
            return (React.createElement("div", { key: sport, className: "ftv-chart-sport-card", style: { background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)',
                    overflow: 'hidden', transition: 'box-shadow .15s', flexShrink: 0,
                    boxShadow: isExp ? '0 4px 16px rgba(0,0,0,0.08)' : 'none' } },
                React.createElement("div", { className: "ftv-chart-card-head", style: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer' }, onClick: () => setExpanded(isExp ? null : sport) },
                    React.createElement("div", { style: { width: 32, height: 32, borderRadius: 9, background: data.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 } }, data.i),
                    React.createElement("div", { style: { width: 120, flexShrink: 0 } },
                        React.createElement("div", { style: { fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, sport),
                        React.createElement("div", { style: { fontSize: 10, color: 'var(--text3)', marginTop: 1 } },
                            fmt(views),
                            " vues")),
                    React.createElement("div", { style: { flex: 1, height: 18, borderRadius: 4, background: 'rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex' } },
                        [['video', nV], ['short', nS], ['live', nL]].map(([t, v]) => {
                            const w = (v / total) * (pct);
                            return w > 0.3 ? React.createElement("div", { key: t, style: {
                                    height: '100%', width: `${w}%`, background: TYPE_C[t],
                                    transition: 'width .7s cubic-bezier(0.4,0,0.2,1)',
                                    borderRight: '1px solid rgba(255,255,255,0.3)'
                                } }) : null;
                        }),
                        React.createElement("div", { style: { height: '100%', flex: 1, background: 'transparent' } })),
                    React.createElement("div", { style: { width: 44, textAlign: 'right', fontSize: 12, fontWeight: 700, color: data.fg, flexShrink: 0 } },
                        ((views / totalViews) * 100).toFixed(1),
                        "%"),
                    React.createElement("button", { onClick: e => { e.stopPropagation(); onSelectSport(sport); }, style: { fontSize: 10, padding: '3px 9px', borderRadius: 20, background: data.bg, color: data.fg,
                            border: `1px solid ${data.fg}33`, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600,
                            flexShrink: 0, whiteSpace: 'nowrap' } }, "D\u00E9tail \u2192"),
                    React.createElement("span", { style: { fontSize: 11, color: 'var(--text3)', flexShrink: 0, width: 14, textAlign: 'center' } }, isExp ? '▲' : '▼')),
                isExp && (React.createElement("div", { style: { borderTop: '1px solid var(--border)', background: 'var(--bg3)' } },
                    React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 180px 60px', gap: 8,
                            padding: '5px 16px 5px 60px', borderBottom: '1px solid var(--border)' } }, ['Compétition', 'Répartition vues', 'Part'].map((h, i) => (React.createElement("div", { key: h, style: { fontSize: 9, fontWeight: 600, color: 'var(--text3)',
                            textTransform: 'uppercase', letterSpacing: '.8px', textAlign: i > 0 ? 'right' : 'left' } }, h)))),
                    comps.map(({ n, views: cv, nV: cV, nS: cS, nL: cL }) => {
                        const cTotal = cV + cS + cL || 1;
                        return (React.createElement("div", { key: n, style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 180px 60px', gap: 8,
                                padding: '6px 16px 6px 60px', borderBottom: '1px solid rgba(0,0,0,0.04)',
                                transition: 'background .1s' }, onMouseEnter: e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)', onMouseLeave: e => e.currentTarget.style.background = 'transparent' },
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, n),
                                React.createElement("div", { style: { fontSize: 9.5, color: 'var(--text3)', marginTop: 1 } },
                                    fmtFull(cv),
                                    " vues")),
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                                React.createElement("div", { style: { flex: 1, height: 8, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden', display: 'flex' } }, [['video', cV], ['short', cS], ['live', cL]].map(([t, v]) => {
                                    const w = (v / cTotal) * ((cv / maxComp) * 100);
                                    return w > 0.5 ? React.createElement("div", { key: t, style: {
                                            height: '100%', width: `${w}%`, background: TYPE_C[t],
                                            transition: 'width .6s cubic-bezier(0.4,0,0.2,1)'
                                        } }) : null;
                                }))),
                            React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: data.fg, textAlign: 'right' } },
                                ((cv / views) * 100).toFixed(0),
                                "%")));
                    })))));
        })));
}

function AnalyticsView({ allVideos, analyticsBundle, analyticsStatus, onConnect, onLoad, analyticsClientId, setAnalyticsClientId, analyticsAccessToken, channelKey, managedAnalyticsChannels, analyticsChannelMap, onAnalyticsChannelMapChange, onRefreshAnalyticsChannels, analyticsHealth }) {
    const rows = useMemo(() => summarizeAnalyticsBySport(allVideos || []), [allVideos, analyticsBundle]);
    const summary = analyticsBundle?.summary || summarizeAnalyticsForVideos((allVideos || []).filter(v => v.analytics && Object.keys(v.analytics).length));
    const hasAnalytics = !!(analyticsBundle && analyticsBundle.loadedAt);
    const topRows = rows.filter(r => r.views || r.watch || r.impressions).slice(0, 100);
    const fmtSec = n => n ? `${Math.round(n)}s` : '—';
    const fmtPctLocal = n => n ? `${(n * 100).toFixed(2)}%` : '—';
    const Table = ({ title, data }) => {
        const objects = analyticsRowsToObjects(data); const cols = objects[0] ? Object.keys(objects[0]) : [];
        return React.createElement("div", { style: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' } },
            React.createElement("div", { style: { padding: '11px 14px', fontWeight: 800, fontSize: 13, borderBottom: '1px solid var(--border)' } }, title),
            React.createElement("div", { style: { maxHeight: 260, overflow: 'auto' } }, objects.length ? React.createElement("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 11 } },
                React.createElement("thead", null, React.createElement("tr", null, cols.map(c => React.createElement("th", { key: c, style: { textAlign: 'left', padding: '8px 10px', color: 'var(--text3)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg2)' } }, c)))),
                React.createElement("tbody", null, objects.map((r,i) => React.createElement("tr", { key: i }, cols.map(c => React.createElement("td", { key: c, style: { padding: '7px 10px', borderBottom: '1px solid rgba(0,0,0,.04)', color: 'var(--text2)' } }, typeof r[c] === 'number' ? fmtFull(r[c]) : String(r[c] ?? ''))))))) : React.createElement("div", { style: { padding: 14, color: 'var(--text3)', fontSize: 12 } }, hasAnalytics ? 'Aucune donnée retournée.' : 'Clique sur le bouton rouge pour charger Analytics.')));
    };
    return React.createElement("div", { className: "ftv-analytics-view", style: { height: '100%', overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement("div", { style: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) 150px', gap: 12, alignItems: 'end' } },
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: 'var(--text)', marginBottom: 4 } }, "YouTube Analytics"),
                React.createElement("div", { style: { fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 0 } }, "Analytics est géré côté serveur. L’accès console est déplacé dans le menu burger. Les résultats sont croisés avec les sports/événements déjà classés.")),
            React.createElement("button", { className: 'ftv-analytics-load-btn', onClick: onLoad, style: { height: 42, background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 950, cursor: 'pointer', fontFamily: 'var(--font)' } }, 'Charger les vraies données Analytics')),
        React.createElement("div", { style: { display:'grid', gridTemplateColumns:'minmax(280px,1fr) 160px minmax(260px,1fr)', gap:10, alignItems:'end', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, padding:12 } },
            React.createElement("div", null,
                React.createElement("div", { style:{fontSize:10,fontWeight:950,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--text3)',marginBottom:6}}, 'Chaîne Analytics utilisée'),
                React.createElement("select", { value: analyticsChannelMap?.[channelKey]?.id || '', onChange: e => { const id=e.target.value; const ch=(managedAnalyticsChannels||[]).find(c=>c.id===id)||null; onAnalyticsChannelMapChange?.(channelKey, ch ? {id:ch.id,title:ch.title,customUrl:ch.customUrl||''} : null); }, style:{width:'100%',height:40,border:'1px solid var(--border)',borderRadius:10,background:'var(--card)',color:'var(--text)',fontWeight:800,padding:'0 10px',fontFamily:'var(--font)'} },
                    React.createElement("option", { value:'' }, 'Auto / non forcée'),
                    (managedAnalyticsChannels||[]).map(ch=>React.createElement("option", { key:ch.id, value:ch.id }, `${ch.title||ch.id} — ${ch.id}`))
                ),
                React.createElement("div", { style:{fontSize:11,color:'var(--text3)',marginTop:6}}, analyticsChannelMap?.[channelKey]?.id ? `Mapping forcé pour ${channelKey}.` : 'Si les données sont incohérentes, sélectionne ici la vraie chaîne du Content Manager.')),
            React.createElement("button", { onClick:onRefreshAnalyticsChannels, style:{height:40,border:'1px solid var(--border)',borderRadius:10,background:'var(--card)',fontWeight:900,cursor:'pointer',fontFamily:'var(--font)',color:'var(--text)'}}, 'Actualiser liste'),
            React.createElement("div", { style:{fontSize:11,color:'var(--text3)',lineHeight:1.45} },
                React.createElement("strong", { style:{color:'var(--text)'}}, 'Diagnostic : '), analyticsHealth ? `${analyticsHealth.tokenOk?'Token OK':'Token KO'} · ${analyticsHealth.contentOwnerOk?'Content Owner OK':'Content Owner KO'} · ${analyticsHealth.managedChannelsCount||0} chaînes gérées` : 'diagnostic non chargé',
                analyticsHealth?.tokenError ? React.createElement("div", { style:{color:'#C0392B',fontWeight:800}}, String(analyticsHealth.tokenError?.error||analyticsHealth.tokenError?.message||'Erreur token')) : null)
        ),
        analyticsStatus?.type && analyticsStatus.type !== 'ok' ? React.createElement("div", { style: { fontSize: 12, color: analyticsStatus?.type === 'error' ? '#C0392B' : 'var(--text3)', background: analyticsStatus?.type === 'error' ? '#FEE2E2' : 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px' } }, analyticsStatus?.message || 'Analytics non chargé.') : null,
        analyticsBundle?.diagnostics ? React.createElement("div", { style: { display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:10 } },
            React.createElement("div", { style:{border:'1px solid var(--border)',borderRadius:12,padding:'10px 12px',background:'var(--card)'} }, React.createElement("div",{style:{fontSize:10,fontWeight:900,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.08em'}},'Scope utilisé'), React.createElement("div",{style:{fontSize:14,fontWeight:950,color:'var(--text)'}},`${analyticsBundle.diagnostics.sourceVideoCount||0} vidéos visibles`), React.createElement("div",{style:{fontSize:11,color:'var(--text3)'}},`${analyticsBundle.startDate} → ${analyticsBundle.endDate}`)),
            React.createElement("div", { style:{border:'1px solid var(--border)',borderRadius:12,padding:'10px 12px',background:'var(--card)'} }, React.createElement("div",{style:{fontSize:10,fontWeight:900,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.08em'}},'Vues publiques'), React.createElement("div",{style:{fontSize:14,fontWeight:950,color:'var(--text)'}},fmtFull(analyticsBundle.diagnostics.publicViews||0)), React.createElement("div",{style:{fontSize:11,color:'var(--text3)'}},'lifetime des vidéos visibles')),
            React.createElement("div", { style:{border:'1px solid var(--border)',borderRadius:12,padding:'10px 12px',background:'var(--card)'} }, React.createElement("div",{style:{fontSize:10,fontWeight:900,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.08em'}},'Vidéos matchées'), React.createElement("div",{style:{fontSize:14,fontWeight:950,color:'var(--text)'}},`${analyticsBundle.diagnostics.matchedAnalyticsVideos||0}/${analyticsBundle.diagnostics.sourceVideoCount||0}`), React.createElement("div",{style:{fontSize:11,color:'var(--text3)'}},'ID vidéo retrouvé dans Analytics')),
            React.createElement("div", { style:{border:'1px solid var(--border)',borderRadius:12,padding:'10px 12px',background:'var(--card)'} }, React.createElement("div",{style:{fontSize:10,fontWeight:900,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.08em'}},'Chaîne Analytics'), React.createElement("div",{style:{fontSize:14,fontWeight:950,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},analyticsBundle.diagnostics.requestMeta?.channelTitle||analyticsBundle.diagnostics.requestMeta?.channelId||'—'), React.createElement("div",{style:{fontSize:11,color:'var(--text3)'}},analyticsBundle.diagnostics.requestMeta?.mode==='contentOwner'?'Content Owner + filtre chaîne':'scope standard'))
        ) : null,
        analyticsBundle?.errors?.length ? null : (analyticsBundle?.summary && !(analyticsBundle.summary.views || analyticsBundle.summary.watch || analyticsBundle.summary.impressions) ? React.createElement("div", { style: { fontSize: 12, color: '#7C2D12', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '9px 12px' } }, "Analytics connecté, mais aucune donnée privée exploitable n'a été retournée pour cette chaîne/période. Les valeurs ne sont pas remplacées par les vues publiques.") : null),
        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 12 } },
            React.createElement(KpiCard, { label: "Vues Analytics", value: summary.views || 0, sub: hasAnalytics ? "authentifiées" : "non chargé", accent: 'var(--red)', delay: 0 }),
            React.createElement(KpiCard, { label: "Watch time", value: summary.watch || 0, sub: "minutes", accent: '#0B3F7A', delay: 20 }),
            React.createElement(KpiCard, { label: "Durée moyenne", value: summary.avgDuration || 0, sub: "secondes", accent: '#7A3800', delay: 40, format: v => `${Math.round(v)}s` }),
            React.createElement(KpiCard, { label: "Impressions", value: summary.impressions || 0, sub: "si disponible", accent: '#4A0E8F', delay: 60 }),
            React.createElement(KpiCard, { label: "CTR", value: summary.ctr || 0, sub: "pondéré", accent: '#16A34A', delay: 80, format: v => `${(v * 100).toFixed(2)}%` })),
        React.createElement("div", { style: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', flex: '1 1 auto', minHeight: 520 } },
            React.createElement("div", { style: { padding: '12px 14px', fontWeight: 900, borderBottom: '1px solid var(--border)' } }, "Analytics par sport / compétition / thématique"),
            React.createElement("div", { style: { height: 'min(68vh,720px)', minHeight: 470, overflow: 'auto' } }, React.createElement("table", { style: { width: '100%', borderCollapse: 'collapse', fontSize: 11 } },
                React.createElement("thead", null, React.createElement("tr", null, ['Catégorie','Sous-catégorie','Contenus','Vues Analytics','Watch time','Durée moy.','Impressions','CTR','Abonnés nets'].map(h => React.createElement("th", { key: h, style: { textAlign: h==='Catégorie'||h==='Sous-catégorie'?'left':'right', padding: '8px 10px', color: 'var(--text3)', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', position: 'sticky', top: 0 } }, h)))),
                React.createElement("tbody", null, (topRows.length ? topRows : rows.slice(0,30)).map(r => React.createElement("tr", { key: `${r.sport}::${r.comp}` },
                    React.createElement("td", { style: { padding: '8px 10px', fontWeight: 800, color: r.fg } }, `${r.i || ''} ${r.sport}`),
                    React.createElement("td", { style: { padding: '8px 10px', color: 'var(--text2)' } }, r.comp),
                    React.createElement("td", { style: { padding: '8px 10px', textAlign: 'right' } }, fmtFull(Array.isArray(r.videos)?r.videos.length:Number(r.videos||r.videoCount||0))),
                    React.createElement("td", { style: { padding: '8px 10px', textAlign: 'right', fontWeight: 800 } }, fmtFull(r.views || 0)),
                    React.createElement("td", { style: { padding: '8px 10px', textAlign: 'right' } }, fmtFull(Math.round(r.watch || 0))),
                    React.createElement("td", { style: { padding: '8px 10px', textAlign: 'right' } }, fmtSec(r.avgDuration)),
                    React.createElement("td", { style: { padding: '8px 10px', textAlign: 'right' } }, fmtFull(r.impressions || 0)),
                    React.createElement("td", { style: { padding: '8px 10px', textAlign: 'right' } }, fmtPctLocal(r.ctr)),
                    React.createElement("td", { style: { padding: '8px 10px', textAlign: 'right' } }, fmtFull(r.netSubs || 0)))))))),
        analyticsBundle?.errors?.length ? React.createElement("div", { style: { background: '#FFF7ED', border: '1px solid #FED7AA', color: '#7C2D12', borderRadius: 10, padding: 12, fontSize: 11, lineHeight: 1.5 } }, React.createElement("strong", null, "Alertes Analytics : "), analyticsBundle.errors.join(' · ')) : null,
        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 } },
            React.createElement(Table, { title: "Sources de trafic", data: analyticsBundle?.traffic }),
            React.createElement(Table, { title: "Devices", data: analyticsBundle?.devices }),
            React.createElement(Table, { title: "Pays", data: analyticsBundle?.countries }),
            React.createElement(Table, { title: "Évolution quotidienne", data: analyticsBundle?.daily })));
}

// ─── PRÉVISIONS / ANALYSE STRATÉGIQUE ────────────────────────────────────────
// V32 : on supprime le modèle automatique bloquant.
// À la place :
//   1) un diagnostic YouTube interne instantané par compétition/thématique ;
//   2) une analyse Claude à la demande, une ligne à la fois ;
//   3) tentative de web_search Anthropic quand disponible, puis fallback sans web.
const avg = (arr) => arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const median = (arr) => { if (!arr || !arr.length)
    return 0; const a = [...arr].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2); };
const pctile = (arr, p) => { if (!arr || !arr.length)
    return 0; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))]; };
const cleanNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9#]+/g, ' ').trim();
const isGenericForecastComp = (comp) => /(resume|temps fort|replay|integralite|extrait|moment fort|interview|reaction|reportage|portrait|actualite|magazine|emission|hors competition|autre|contenu sport general)/.test(cleanNorm(comp || ''));
const byNumDesc = (a, b) => (Number(b.views) || 0) - (Number(a.views) || 0);
const fmtPct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v)}%`;
const getYear = (v) => { try {
    return getVidDate(v).getFullYear();
}
catch (e) {
    return new Date(v.publishedAt || v.date || Date.now()).getFullYear();
} };
function buildPrevisionRows(sportsData) {
    const rows = [];
    Object.entries(sportsData || {}).forEach(([sport, data]) => {
        Object.entries(data.comps || {}).forEach(([comp, c]) => {
            const videos = c.videos || [];
            if (!videos.length)
                return;
            const views = videos.map(v => Number(v.views) || 0).filter(n => n > 0);
            const nV = videos.filter(v => v.type === 'video').length;
            const nS = videos.filter(v => v.type === 'short').length;
            const nL = videos.filter(v => v.type === 'live').length;
            const generic = isGenericForecastComp(comp);
            rows.push({
                sport, comp, videos, views: c.views || 0, count: videos.length,
                i: data.i, bg: data.bg, fg: data.fg, nV, nS, nL, generic,
                mean: Math.round(avg(views)), median: median(views), p25: pctile(views, .25), p75: pctile(views, .75),
                topVideos: [...videos].sort(byNumDesc).slice(0, 8)
            });
        });
    });
    return rows
        .filter(r => r.count >= 1)
        .sort((a, b) => {
        if (a.generic !== b.generic)
            return a.generic ? 1 : -1;
        return b.views - a.views;
    })
        .slice(0, 40);
}
function buildHistoricalStatsFor(row, allVideos) {
    const byYear = {};
    const targetSport = row.sport, targetComp = row.comp;
    (allVideos || []).forEach(v => {
        let cls = v && v.__ftv_cls;
        if (!cls) {
            try {
                cls = classify(v);
                Object.defineProperty(v, '__ftv_cls', { value: cls, configurable: true, enumerable: false });
            }
            catch (e) {
                cls = null;
            }
        }
        if (!cls || cls.s !== targetSport || cls.c !== targetComp)
            return;
        const y = getYear(v);
        if (!byYear[y])
            byYear[y] = { year: y, videos: [], views: 0, nV: 0, nS: 0, nL: 0 };
        byYear[y].videos.push(v);
        byYear[y].views += Number(v.views) || 0;
        if (v.type === 'video')
            byYear[y].nV++;
        else if (v.type === 'short')
            byYear[y].nS++;
        else if (v.type === 'live')
            byYear[y].nL++;
    });
    Object.values(byYear).forEach(s => {
        const views = s.videos.map(v => Number(v.views) || 0).filter(n => n > 0);
        s.mean = Math.round(avg(views));
        s.median = median(views);
        s.p25 = pctile(views, .25);
        s.p75 = pctile(views, .75);
        s.topVideos = [...s.videos].sort(byNumDesc).slice(0, 5);
    });
    return Object.values(byYear).sort((a, b) => a.year - b.year);
}
function quickDiagnostic(row, hist, refYear, targetYear) {
    const ref = hist.find(h => h.year === refYear) || hist[hist.length - 1];
    const prev = hist.filter(h => h.year < refYear).slice(-1)[0];
    const sample = ref?.videos?.length || row.count || 0;
    const total = ref?.views || row.views || 0;
    const med = ref?.median || row.median || 0;
    const mean = ref?.mean || row.mean || 0;
    let confidence = 'Prudent';
    if (sample >= 12 && med > 0)
        confidence = 'Solide';
    else if (sample >= 4 && med > 0)
        confidence = 'Indicatif';
    const vsPrev = prev && prev.views ? ((total / prev.views - 1) * 100) : null;
    let label = 'Base insuffisante';
    if (vsPrev !== null)
        label = vsPrev > 15 ? 'Historique en hausse' : vsPrev < -15 ? 'Historique en baisse' : 'Historique stable';
    else if (sample >= 4)
        label = 'Base exploitable';
    const scenarioBase = med || mean || Math.round(total / Math.max(sample, 1));
    const low = Math.round(scenarioBase * (confidence === 'Solide' ? 0.85 : confidence === 'Indicatif' ? 0.70 : 0.50));
    const central = Math.round(scenarioBase * (confidence === 'Solide' ? 1.05 : confidence === 'Indicatif' ? 1.00 : 0.90));
    const high = Math.round(scenarioBase * (confidence === 'Solide' ? 1.30 : confidence === 'Indicatif' ? 1.45 : 1.70));
    return { ref, prev, sample, total, med, mean, confidence, vsPrev, label, scenarioBase, low, central, high, targetYear };
}
function stripMarkdownNoise(text) {
    return String(text || '').replace(/\n{3,}/g, '\n\n').trim();
}
function stripDeltaLine(text) {
    return String(text || '')
        .replace(/^\s*DELTA[_\s-]*ESTIM[ÉE]?\s*:\s*[^\n]+\n?/im, '')
        .replace(/^\s*ESTIMATION[_\s-]*DELTA\s*:\s*[^\n]+\n?/im, '')
        .trim();
}
function parseDeltaEstimate(text) {
    const raw = String(text || '');
    const clean = raw.replace(/,/g, '.');
    const patterns = [
        /DELTA[_\s-]*ESTIM[ÉE]?\s*:\s*(?:de\s*)?([+-]?\d+(?:\.\d+)?)\s*%?\s*(?:à|a|→|->|–|—|-|to)\s*([+-]?\d+(?:\.\d+)?)\s*%?/i,
        /estimation[^\n]{0,60}?(?:de\s*)?([+-]?\d+(?:\.\d+)?)\s*%\s*(?:à|a|→|->|–|—|-|to)\s*([+-]?\d+(?:\.\d+)?)\s*%/i,
        /sc[ée]nario\s+bas[^\n-+]*([+-]?\d+(?:\.\d+)?)\s*%[\s\S]{0,180}?sc[ée]nario\s+haut[^\n-+]*([+-]?\d+(?:\.\d+)?)\s*%/i
    ];
    let match = null;
    for (const pattern of patterns) {
        match = clean.match(pattern);
        if (match)
            break;
    }
    if (!match)
        return null;
    let low = parseFloat(match[1]);
    let high = parseFloat(match[2]);
    if (!Number.isFinite(low) || !Number.isFinite(high))
        return null;
    if (low > high) {
        const tmp = low;
        low = high;
        high = tmp;
    }
    const centralMatch = clean.match(/CENTRAL\s*:\s*([+-]?\d+(?:\.\d+)?)\s*%?/i) || clean.match(/sc[ée]nario\s+central[^\n-+]*([+-]?\d+(?:\.\d+)?)\s*%/i);
    const confMatch = raw.match(/CONFIANCE\s*:\s*([^|\n]+)/i) || raw.match(/niveau de confiance\s*:?\s*([^\n]+)/i);
    const central = centralMatch ? parseFloat(centralMatch[1]) : Math.round((low + high) / 2);
    return { low: Math.round(low), high: Math.round(high), central: Number.isFinite(central) ? Math.round(central) : Math.round((low + high) / 2), confidence: confMatch ? String(confMatch[1]).trim().replace(/[.;]$/, '') : null, inferred: false };
}
function buildFallbackDeltaEstimate(diag) {
    if (!diag)
        return null;
    let central = 0;
    if (Number.isFinite(diag.vsPrev))
        central = Math.max(-35, Math.min(45, Math.round(diag.vsPrev * 0.35)));
    else if (diag.confidence === 'Solide')
        central = 5;
    else if (diag.confidence === 'Indicatif')
        central = 0;
    else
        central = 0;
    const spread = diag.confidence === 'Solide' ? 12 : diag.confidence === 'Indicatif' ? 20 : 30;
    return { low: central - spread, high: central + spread, central, confidence: diag.confidence || 'Prudent', inferred: true };
}
function DeltaEstimateChip({ delta }) {
    if (!delta)
        return null;
    const allDown = delta.high < 0;
    const allUp = delta.low > 0;
    const mixed = !allDown && !allUp;
    const color = allUp ? '#166534' : allDown ? '#991B1B' : '#7A3800';
    const bg = allUp ? '#DCFCE7' : allDown ? '#FEF2F2' : '#FFF7ED';
    const border = allUp ? '#86EFAC' : allDown ? '#FCA5A5' : '#FDBA74';
    const label = `${delta.low >= 0 ? '+' : ''}${delta.low}% à ${delta.high >= 0 ? '+' : ''}${delta.high}%`;
    return React.createElement("div", { title: delta.inferred ? 'Estimation de secours si Claude ne renvoie pas de delta structuré' : 'Delta extrait de l’analyse Claude', style: { background: bg, color, border: `1px solid ${border}`, borderRadius: 999, padding: '6px 9px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 } },
        React.createElement("span", null, mixed ? '≈' : allUp ? '↗' : '↘'),
        React.createElement("span", null, label),
        delta.confidence && React.createElement("span", { style: { fontSize: 9, opacity: .7, fontWeight: 700 } }, delta.confidence.split(/[,.|]/)[0]));
}
function extractClaudeTextAndSources(json) {
    const parts = [];
    const sources = [];
    (json.content || []).forEach(block => {
        if (block.type === 'text' && block.text) {
            parts.push(block.text);
            (block.citations || []).forEach(c => { if (c.url)
                sources.push({ url: c.url, title: c.title || c.url }); });
        }
        if (block.type === 'server_tool_use')
            parts.push(`\n[Recherche web Claude : ${block.input?.query || 'requête'}]`);
        if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
            block.content.forEach(r => { if (r.url)
                sources.push({ url: r.url, title: r.title || r.url }); });
        }
    });
    const uniq = [];
    const seen = new Set();
    sources.forEach(s => { if (!seen.has(s.url)) {
        seen.add(s.url);
        uniq.push(s);
    } });
    return { text: stripMarkdownNoise(parts.join('\n')), sources: uniq.slice(0, 8) };
}
async function callAnthropicStrategic(prompt, apiKey, { withWeb = true } = {}) {
    const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, withWeb }),
        signal: AbortSignal.timeout(withWeb ? 90000 : 45000)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json?.error || json?.message || `Claude API ${resp.status}`);
    return extractClaudeTextAndSources(json);
}
function buildStrategicPrompt(row, hist, diag, channelKey, dateRange, analyticsBundle) {
    const refYear = diag.ref?.year || (dateRange?.start ? dateRange.start.getFullYear() : new Date().getFullYear());
    const targetYear = refYear + 1;
    const channelLabel = (getChannelConfig(channelKey)?.label || channelKey || 'chaîne').toLowerCase();
    const histLines = hist.map(h => {
        const delta = diag.prev && h.year === refYear && diag.prev.views ? ` (${fmtPct((h.views / diag.prev.views - 1) * 100)} vs ${diag.prev.year})` : '';
        return `- ${h.year}: ${h.videos.length} contenus | ${fmtFull(h.views)} vues totales | médiane ${fmtFull(h.median || 0)} | moyenne ${fmtFull(h.mean || 0)} | vidéos ${h.nV}, shorts ${h.nS}, lives ${h.nL}${delta}`;
    }).join('\n') || '- Aucun historique pluriannuel disponible.';
    const topLines = (diag.ref?.topVideos || row.topVideos || []).slice(0, 8).map((v, i) => `${i + 1}. ${v.title} — ${fmtFull(v.views || 0)} vues — ${v.type || 'video'} — ${v.publishedAt || v.date || ''}`).join('\n') || 'Aucune vidéo top disponible.';
    const formatShare = `vidéos longues ${row.nV}, shorts ${row.nS}, lives ${row.nL}`;
    const analyticsRows = analyticsBundle ? summarizeAnalyticsBySport(analyticsBundle.videos || []).filter(x => x.sport === row.sport && x.comp === row.comp) : [];
    const ar = analyticsRows[0] || null;
    const analyticsLines = ar ? `- Vues Analytics : ${fmtFull(ar.views || 0)}\n- Watch time : ${fmtFull(Math.round(ar.watch || 0))} minutes\n- Durée moyenne : ${Math.round(ar.avgDuration || 0)} secondes\n- Impressions : ${fmtFull(ar.impressions || 0)}\n- CTR moyen : ${ar.ctr ? (ar.ctr * 100).toFixed(2) + ' %' : 'non disponible'}\n- Abonnés nets : ${fmtFull(ar.netSubs || 0)}\n- Shares : ${fmtFull(ar.shares || 0)}` : '- Données YouTube Analytics non chargées pour cette ligne : utiliser uniquement les vues publiques Data API et signaler cette limite.';
    const task = channelKey === 'sport'
        ? `Quelles sont les prévisions ${targetYear} de performance YouTube pour ${row.comp} sur la chaîne ${channelLabel}, par rapport à ${refYear} ?`
        : `Quelles sont les perspectives ${targetYear} de performance YouTube pour la thématique/programme ${row.comp} sur la chaîne ${channelLabel}, par rapport à ${refYear} ?`;
    return `
Question à traiter : ${task}

Données YouTube internes du dashboard :
- Chaîne : ${channelLabel}
- Catégorie principale : ${row.sport}
- Sous-catégorie / compétition / thématique : ${row.comp}
- Période affichée : ${dateRange?.start ? fmtDateShort(dateRange.start) : 'non précisée'} → ${dateRange?.end ? fmtDateShort(dateRange.end) : 'non précisée'}
- Base ${refYear} utilisée : ${diag.sample} contenus, ${fmtFull(diag.total)} vues totales, médiane ${fmtFull(diag.med)}, moyenne ${fmtFull(diag.mean)}
- Mix formats actuel : ${formatShare}
- Diagnostic automatique : ${diag.label}, confiance ${diag.confidence}
- Scénario interne indicatif par contenu : bas ${fmtFull(diag.low)}, central ${fmtFull(diag.central)}, haut ${fmtFull(diag.high)} vues/contenu

Historique disponible par année :
${histLines}

Top contenus de l'année de référence :
${topLines}

Travail attendu :
1. Fais une analyse stratégique type consultant data/média, pas une simple phrase.
2. Croise les données YouTube internes avec le contexte public récent si tu as accès à la recherche web.
3. Recherche en priorité : dispositif ${row.comp} ${targetYear} France Télévisions, audiences/résultats ${row.comp} ${refYear}, droits TV/digital, nouveautés éditoriales, contexte sportif ou médiatique, concurrence éventuelle.
4. Si la recherche web n'est pas disponible, dis-le clairement et base-toi uniquement sur les données internes + hypothèses à vérifier.
5. Ne donne pas un chiffre unique trop affirmatif. Donne scénario bas / central / haut, tendance vs ${refYear}, et niveau de confiance.
6. Explique les facteurs de hausse, facteurs de baisse, risques, et recommandations éditoriales YouTube.
7. N'invente pas de sources. Si tu utilises des sources web, cite-les dans le texte.
8. Tout en haut de ta réponse, ajoute impérativement une ligne machine lisible EXACTEMENT sous cette forme :
DELTA_ESTIME: -5% à +12% | CENTRAL: +4% | CONFIANCE: Moyenne
Cette ligne doit résumer ton estimation finale de variation des vues totales ${targetYear} vs ${refYear} pour cette compétition/thématique.

Format de réponse souhaité :
- Résumé exécutif en 3 lignes
- Lecture des données YouTube ${refYear}
- Contexte externe ${targetYear}
- Scénario bas / central / haut vs ${refYear}
- Niveau de confiance
- Recommandations éditoriales concrètes
`.trim();
}
function StatPill({ label, value, color = '#0B3F7A', bg = '#E5EFF9' }) {
    return React.createElement("div", { style: { background: bg, color, borderRadius: 10, padding: '9px 11px', border: `1px solid ${color}22`, minWidth: 0 } },
        React.createElement("div", { style: { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.7px', fontWeight: 700, opacity: .7, marginBottom: 3 } }, label),
        React.createElement("div", { style: { fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, value));
}
function normalizeClaudeAnalysisText(text) {
    return stripDeltaLine(text)
        .replace(/\r/g, '')
        .replace(/^\s*\[Recherche web Claude\s*:[^\n]+\]\s*$/gmi, '')
        .replace(/\n\s*-\s*\n(?=\S)/g, '\n- ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
function stripMarkdownEmphasis(text) {
    return String(text || '').replace(/^\s*#+\s*/, '').replace(/\*\*/g, '').replace(/`/g, '').trim();
}
function renderInlineMarkdown(text, keyPrefix) {
    const raw = String(text || '');
    const parts = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0, idx = 0, match;
    const pushText = (s) => { if (s)
        parts.push(s); };
    while ((match = re.exec(raw))) {
        pushText(raw.slice(last, match.index));
        const token = match[0];
        if (token.startsWith('**')) {
            parts.push(React.createElement('strong', { key: `${keyPrefix}-b-${idx++}`, style: { fontWeight: 800, color: 'var(--text)' } }, token.slice(2, -2)));
        }
        else {
            parts.push(React.createElement('code', { key: `${keyPrefix}-c-${idx++}`, style: { background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 4px', fontSize: '92%', fontFamily: 'JetBrains Mono, monospace' } }, token.slice(1, -1)));
        }
        last = match.index + token.length;
    }
    pushText(raw.slice(last));
    return parts;
}
function splitMarkdownTableRow(line) {
    return String(line || '')
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(c => c.trim())
        .filter((c, i, arr) => !(c === '' && arr.length > 1));
}
function renderMarkdownTable(lines, key) {
    const rawRows = (lines || []).map(splitMarkdownTableRow).filter(cells => cells.length > 1);
    const rows = rawRows.filter(cells => !cells.every(c => /^:?-{2,}:?$/.test(c.replace(/\s/g, ''))));
    if (!rows.length)
        return null;
    const hasHeader = (lines || []).some(l => /^\s*\|?\s*:?-{2,}:?/.test(l));
    const header = hasHeader ? rows[0] : null;
    const body = hasHeader ? rows.slice(1) : rows;
    return React.createElement('div', { key, style: { overflowX: 'auto', margin: '12px 0', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' } }, React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5, lineHeight: 1.45 } }, header && React.createElement('thead', null, React.createElement('tr', null, header.map((cell, i) => React.createElement('th', { key: i, style: { textAlign: 'left', padding: '9px 10px', background: 'var(--bg4)', borderBottom: '1px solid var(--border)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--text2)', fontWeight: 800 } }, renderInlineMarkdown(cell, `${key}-h-${i}`))))), React.createElement('tbody', null, body.map((cells, r) => React.createElement('tr', { key: r }, cells.map((cell, c) => React.createElement('td', { key: c, style: { padding: '9px 10px', borderTop: r === 0 && !header ? 'none' : '1px solid rgba(0,0,0,.06)', verticalAlign: 'top', color: 'var(--text2)' } }, renderInlineMarkdown(cell, `${key}-r-${r}-${c}`))))))));
}
function renderClaudeAnalysis(text) {
    const cleaned = normalizeClaudeAnalysisText(text);
    if (!cleaned)
        return null;
    const lines = cleaned.split('\n');
    const blocks = [];
    let paragraph = [];
    let bulletList = [];
    let numberedList = [];
    let tableLines = [];
    let key = 0;
    const flushParagraph = () => {
        if (!paragraph.length)
            return;
        const txt = paragraph.join(' ').replace(/\s+/g, ' ').trim();
        paragraph = [];
        if (txt)
            blocks.push(React.createElement('p', { key: `p-${key++}`, style: { margin: '7px 0 11px', color: 'var(--text2)', lineHeight: 1.72 } }, renderInlineMarkdown(txt, `p-${key}`)));
    };
    const flushBullets = () => {
        if (!bulletList.length)
            return;
        const items = bulletList;
        bulletList = [];
        blocks.push(React.createElement('ul', { key: `ul-${key++}`, style: { margin: '6px 0 13px 18px', padding: 0, color: 'var(--text2)', lineHeight: 1.65 } }, items.map((item, i) => React.createElement('li', { key: i, style: { margin: '4px 0', paddingLeft: 2 } }, renderInlineMarkdown(item, `ul-${key}-${i}`)))));
    };
    const flushNumbers = () => {
        if (!numberedList.length)
            return;
        const items = numberedList;
        numberedList = [];
        blocks.push(React.createElement('ol', { key: `ol-${key++}`, style: { margin: '6px 0 13px 20px', padding: 0, color: 'var(--text2)', lineHeight: 1.65 } }, items.map((item, i) => React.createElement('li', { key: i, style: { margin: '4px 0', paddingLeft: 2 } }, renderInlineMarkdown(item, `ol-${key}-${i}`)))));
    };
    const flushTable = () => {
        if (!tableLines.length)
            return;
        const table = renderMarkdownTable(tableLines, `tbl-${key++}`);
        tableLines = [];
        if (table)
            blocks.push(table);
    };
    const flushAll = () => { flushParagraph(); flushBullets(); flushNumbers(); flushTable(); };
    lines.forEach((raw) => {
        const line = String(raw || '').trim();
        if (!line) {
            flushAll();
            return;
        }
        if (/^[-–—]{3,}$/.test(line)) {
            flushAll();
            return;
        }
        if (/^[-•*]$/.test(line))
            return;
        if (/^\|.*\|$/.test(line) || (tableLines.length && line.includes('|'))) {
            flushParagraph();
            flushBullets();
            flushNumbers();
            tableLines.push(line);
            return;
        }
        else if (tableLines.length) {
            flushTable();
        }
        const h = line.match(/^(#{1,4})\s+(.+)$/);
        if (h) {
            flushAll();
            const level = h[1].length;
            const tag = level <= 2 ? 'h3' : 'h4';
            blocks.push(React.createElement(tag, { key: `h-${key++}`, style: { margin: key === 1 ? '0 0 10px' : '16px 0 8px', fontSize: level <= 2 ? 15 : 13.5, fontWeight: 850, color: 'var(--text)', lineHeight: 1.35 } }, renderInlineMarkdown(stripMarkdownEmphasis(h[2]), `h-${key}`)));
            return;
        }
        const boldTitle = line.match(/^\*\*(.+?)\*\*\s*:?$/);
        if (boldTitle && line.length < 120) {
            flushAll();
            blocks.push(React.createElement('h4', { key: `h-${key++}`, style: { margin: key === 1 ? '0 0 9px' : '15px 0 7px', fontSize: 13.5, fontWeight: 850, color: 'var(--text)', lineHeight: 1.35 } }, stripMarkdownEmphasis(boldTitle[1])));
            return;
        }
        const bullet = line.match(/^[-*•]\s+(.+)$/);
        if (bullet) {
            flushParagraph();
            flushNumbers();
            bulletList.push(bullet[1].trim());
            return;
        }
        const numbered = line.match(/^\d+[.)]\s+(.+)$/);
        if (numbered) {
            flushParagraph();
            flushBullets();
            numberedList.push(numbered[1].trim());
            return;
        }
        paragraph.push(line);
    });
    flushAll();
    return React.createElement('div', { style: { fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'normal' } }, blocks);
}
function StrategicAnalysisBlock({ item }) {
    if (!item)
        return null;
    if (item.status === 'loading')
        return React.createElement('div', { style: { fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, display: 'flex', gap: 8, alignItems: 'center' } }, React.createElement('span', { style: { width: 13, height: 13, border: '2px solid rgba(0,0,0,.12)', borderTop: '2px solid var(--red)', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' } }), 'Analyse stratégique en cours… Claude peut chercher sur le web si l’option est disponible. Timeout sécurisé : 90 s.');
    if (item.status === 'error')
        return React.createElement('div', { style: { fontSize: 13, color: '#991B1B', lineHeight: 1.7, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: 12 } }, React.createElement('strong', null, 'Analyse impossible.'), React.createElement('br', null), item.error);
    return React.createElement('div', { style: { fontSize: 13, color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'normal' } }, renderClaudeAnalysis(item.text), item.sources && item.sources.length > 0 && React.createElement('div', { style: { marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)', whiteSpace: 'normal' } }, React.createElement('strong', null, 'Sources web détectées par Claude :'), React.createElement('ul', { style: { margin: '6px 0 0 18px', padding: 0 } }, item.sources.map((s, i) => React.createElement('li', { key: i, style: { margin: '3px 0' } }, s.title)))));
}
function PrevisionsView({ sportsData, totalViews, anthropicKey, allVideos, dateRange, channelKey, analyticsBundle }) {
    const rows = useMemo(() => buildPrevisionRows(sportsData), [sportsData]);
    const [expanded, setExpanded] = useState(null);
    const [analyses, setAnalyses] = useState({});
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const refYear = dateRange?.start ? dateRange.start.getFullYear() : new Date().getFullYear();
    const shownRows = useMemo(() => rows.filter(r => {
        if (filter === 'events' && r.generic)
            return false;
        if (filter === 'generic' && !r.generic)
            return false;
        const q = cleanNorm(query);
        if (!q)
            return true;
        return cleanNorm(`${r.sport} ${r.comp}`).includes(q);
    }), [rows, filter, query]);
    async function runStrategic(row) {
        const apiKey = String(anthropicKey || '').trim() || readSharedAnthropicKey();
        if (!apiKey) {
            const key = `${row.sport}::${row.comp}`;
            setAnalyses(p => ({ ...p, [key]: { status: 'error', error: 'Clé Anthropic manquante : saisis-la dans la sidebar, puis relance cette analyse.' } }));
            setExpanded(key);
            return;
        }
        saveSharedAnthropicKey(apiKey);
        const key = `${row.sport}::${row.comp}`;
        const hist = buildHistoricalStatsFor(row, allVideos || []);
        const diag = quickDiagnostic(row, hist, refYear, refYear + 1);
        const prompt = buildStrategicPrompt(row, hist, diag, channelKey, dateRange, analyticsBundle);
        setExpanded(key);
        setAnalyses(p => ({ ...p, [key]: { status: 'loading', prompt, hist, diag } }));
        try {
            let out;
            try {
                out = await callAnthropicStrategic(prompt, apiKey, { withWeb: true });
            }
            catch (webErr) {
                // Certaines clés Anthropic n'ont pas le web_search activé. Fallback propre.
                out = await callAnthropicStrategic(prompt + '\n\nImportant : l\'appel avec recherche web a échoué ou n\'est pas disponible. Fais donc une analyse basée uniquement sur les données internes ci-dessus, en listant explicitement les informations externes à vérifier.', apiKey, { withWeb: false });
                out.text = '⚠️ Recherche web Claude non disponible avec cette clé ou ce modèle. Analyse basée sur les données internes du dashboard.\n\n' + out.text;
            }
            const delta = parseDeltaEstimate(out.text) || buildFallbackDeltaEstimate(diag);
            setAnalyses(p => ({ ...p, [key]: { status: 'done', text: out.text, sources: out.sources, hist, diag, prompt, delta } }));
        }
        catch (e) {
            setAnalyses(p => ({ ...p, [key]: { status: 'error', error: String(e.message || e), hist, diag, prompt } }));
        }
    }
    return (React.createElement("div", { className: "ftv-previsions-view", style: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' } },
        React.createElement("div", { style: { padding: '16px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexShrink: 0 } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontWeight: 800, fontSize: 16, color: 'var(--text)' } }, "Analyses strat\u00E9giques"),
                    React.createElement("div", { style: { fontSize: 11, color: 'var(--text3)', marginTop: 2 } },
                        "YouTube interne + Analytics + analyse Claude \u00E0 la demande \u00B7 ",
                        rows.length,
                        " lignes exploitables")),
                React.createElement("div", { style: { marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
                    React.createElement("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "Chercher une comp\u00E9tition / th\u00E9matique\u2026", style: { height: 32, width: 260, maxWidth: '40vw', border: '1px solid var(--border2)', borderRadius: 18, padding: '0 12px', fontSize: 12, outline: 'none', background: 'var(--bg3)', color: 'var(--text)' } }))),
            React.createElement("div", { style: { display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' } },
                [{ k: 'all', l: 'Tout' }, { k: 'events', l: 'Compétitions / thèmes' }, { k: 'generic', l: 'Formats éditoriaux' }].map(({ k, l }) => React.createElement("button", { key: k, onClick: () => setFilter(k), style: { fontSize: 11, padding: '5px 11px', borderRadius: 20, background: filter === k ? 'var(--text)' : 'var(--bg4)', color: filter === k ? '#fff' : 'var(--text2)', border: `1px solid ${filter === k ? 'var(--text)' : 'var(--border2)'}`, cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600 } }, l)),
                React.createElement("span", { style: { fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 20, background: '#E5EFF9', color: '#0B3F7A' } }, "\u2022 Donn\u00E9es YouTube r\u00E9elles"),
                React.createElement("span", { style: { fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 20, background: '#F0E8FF', color: '#4A0E8F' } }, "\u2022 Claude consultant"),
                React.createElement("span", { style: { fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 20, background: '#FFF7ED', color: '#7A3800' } }, "\u2022 Web si disponible"))),
        React.createElement("div", { style: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 } },
            shownRows.map(row => {
                const key = `${row.sport}::${row.comp}`;
                const isExp = expanded === key;
                const hist = isExp ? buildHistoricalStatsFor(row, allVideos || []) : [];
                const diag = isExp ? quickDiagnostic(row, hist, refYear, refYear + 1) : null;
                const item = analyses[key];
                return React.createElement("div", { key: key, className: "ftv-prevision-card", style: { background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0, boxShadow: isExp ? '0 4px 20px rgba(0,0,0,0.08)' : 'none' } },
                    React.createElement("div", { className: "ftv-prevision-head", style: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', cursor: 'pointer' }, onClick: () => setExpanded(isExp ? null : key) },
                        React.createElement("div", { style: { width: 38, height: 38, borderRadius: 11, background: row.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 } }, row.i),
                        React.createElement("div", { style: { minWidth: 0, flex: 1 } },
                            React.createElement("div", { style: { fontWeight: 800, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, row.comp),
                            React.createElement("div", { style: { fontSize: 10.5, color: 'var(--text3)', marginTop: 1 } },
                                row.sport,
                                " \u00B7 ",
                                row.count,
                                " contenus \u00B7 ",
                                row.generic ? 'format éditorial' : 'compétition / thématique')),
                        React.createElement("div", { style: { textAlign: 'right', minWidth: 90, flexShrink: 0 } },
                            React.createElement("div", { style: { fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px' } }, "Vues totales"),
                            React.createElement("div", { style: { fontWeight: 800, fontSize: 14, color: row.fg, fontVariantNumeric: 'tabular-nums' } }, fmtFull(row.views))),
                        React.createElement("div", { style: { textAlign: 'right', minWidth: 90, flexShrink: 0 } },
                            React.createElement("div", { style: { fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px' } }, "M\u00E9diane"),
                            React.createElement("div", { style: { fontWeight: 700, fontSize: 13, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' } }, fmtFull(row.median || 0))),
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 } },
                            item?.status === 'done' && item.delta && React.createElement(DeltaEstimateChip, { delta: item.delta }),
                            React.createElement("button", { onClick: (e) => { e.stopPropagation(); runStrategic(row); }, disabled: item?.status === 'loading', style: { background: item?.status === 'loading' ? 'var(--bg4)' : 'var(--red)', color: item?.status === 'loading' ? 'var(--text3)' : '#fff', border: 'none', borderRadius: 9, padding: '8px 13px', fontSize: 12, fontWeight: 800, cursor: item?.status === 'loading' ? 'default' : 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' } }, item?.status === 'loading' ? React.createElement(React.Fragment, null,
                                React.createElement("span", { style: { width: 11, height: 11, border: '2px solid rgba(0,0,0,.14)', borderTop: '2px solid var(--text2)', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' } }),
                                "Analyse\u2026") : item?.status === 'done' ? 'Relancer' : 'Analyser avec Claude')),
                        React.createElement("span", { style: { fontSize: 11, color: 'var(--text3)', flexShrink: 0 } }, isExp ? '▲' : '▼')),
                    isExp && React.createElement("div", { style: { borderTop: '1px solid var(--border)', background: 'var(--bg3)', padding: '16px 18px', animation: 'fadeUp .2s ease' } },
                        React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 14 } },
                            React.createElement(StatPill, { label: "Base interne", value: `${row.count} contenus · ${fmtFull(row.views)} vues` }),
                            React.createElement(StatPill, { label: "M\u00E9diane / moyenne", value: `${fmtFull(row.median || 0)} / ${fmtFull(row.mean || 0)}` }),
                            React.createElement(StatPill, { label: "Mix formats", value: `${row.nV} vidéos · ${row.nS} shorts · ${row.nL} lives`, color: "#7A3800", bg: "#FFF7ED" }),
                            React.createElement(StatPill, { label: "Diagnostic", value: diag ? `${diag.label} · ${diag.confidence}` : '—', color: "#4A0E8F", bg: "#F0E8FF" })),
                        hist.length > 0 && React.createElement("div", { style: { background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 12 } },
                            React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 } }, "Historique disponible"),
                            React.createElement("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, hist.map(h => React.createElement("div", { key: h.year, style: { background: 'var(--bg4)', borderRadius: 8, padding: '7px 9px', minWidth: 130 } },
                                React.createElement("div", { style: { fontWeight: 800, fontSize: 13, color: 'var(--text)' } }, h.year),
                                React.createElement("div", { style: { fontSize: 11, color: 'var(--text2)' } },
                                    h.videos.length,
                                    " contenus \u00B7 ",
                                    fmtFull(h.views),
                                    " vues"),
                                React.createElement("div", { style: { fontSize: 10, color: 'var(--text3)' } },
                                    "m\u00E9d. ",
                                    fmtFull(h.median || 0),
                                    " \u00B7 moy. ",
                                    fmtFull(h.mean || 0)))))),
                        React.createElement("div", { style: { background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 14 } },
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' } },
                                React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: '#4A0E8F', textTransform: 'uppercase', letterSpacing: '.8px' } }, "\uD83E\uDD16 Analyse strat\u00E9gique"),
                                item?.status === 'done' && React.createElement("span", { style: { fontSize: 10, color: '#166534', background: '#DCFCE7', padding: '3px 7px', borderRadius: 20, fontWeight: 700 } }, "termin\u00E9e"),
                                item?.status === 'done' && item.delta && React.createElement(DeltaEstimateChip, { delta: item.delta })),
                            item ? React.createElement(StrategicAnalysisBlock, { item: item }) : React.createElement("div", { style: { fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 } },
                                "Clique sur ",
                                React.createElement("strong", null, "Analyser avec Claude"),
                                " pour g\u00E9n\u00E9rer une vraie note : comparaison avec l\u2019historique YouTube, lecture des formats, sc\u00E9narios bas/central/haut, risques, opportunit\u00E9s et recommandations \u00E9ditoriales. L\u2019analyse est lanc\u00E9e seulement pour cette ligne pour \u00E9viter les chargements interminables."))));
            }),
            !shownRows.length && React.createElement("div", { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text3)', padding: 60, textAlign: 'center' } },
                React.createElement("div", { style: { fontSize: 42 } }, "\uD83D\uDD0E"),
                React.createElement("div", { style: { fontWeight: 800, color: 'var(--text2)' } }, "Aucune ligne \u00E0 analyser"),
                React.createElement("div", { style: { fontSize: 12 } }, "Essaie d\u2019\u00E9largir la p\u00E9riode ou de vider la recherche.")))));
}


function ftvCopilotDate(v) {
    try {
        if (!v) return null;
        if (v.__ftv_ts) return new Date(v.__ftv_ts);
        if (v.publishedAt) return new Date(v.publishedAt);
        if (v.date) return new Date(v.date);
        if (window.getVideoDate && v.id) return window.getVideoDate(v.id);
    } catch (e) {}
    return null;
}
function ftvCopilotYear(v) {
    const d = ftvCopilotDate(v);
    return d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null;
}
function ftvCopilotInRange(v, range) {
    if (!range || !range.start || !range.end) return true;
    const d = ftvCopilotDate(v);
    if (!d || Number.isNaN(d.getTime())) return false;
    return d >= range.start && d <= range.end;
}
function ftvCopilotCls(v) {
    try {
        return v && v.__ftv_cls ? v.__ftv_cls : window.classify(v);
    } catch (e) {
        return { s: v?.sport || 'Autres', c: v?.comp || 'Général', i: '•', fg: '#143F7D', bg: '#eef6ff' };
    }
}
function ftvCopilotViews(v) {
    return Number(v?.views || v?.statistics?.viewCount || 0) || 0;
}
function ftvMedian(arr) {
    const a = (arr || []).map(Number).filter(n => Number.isFinite(n)).sort((x,y)=>x-y);
    if (!a.length) return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
}
function ftvCopilotFormatPct(n) {
    if (!Number.isFinite(Number(n))) return '—';
    const v = Math.round(Number(n));
    return (v > 0 ? '+' : '') + v + '%';
}
function ftvCopilotBuildEvents({ channelVideos, currentVideos }) {
    const byKey = new Map();
    (channelVideos || []).forEach(v => {
        const cls = ftvCopilotCls(v);
        const sport = cls.s || 'Autres';
        const comp = cls.c || 'Général';
        const key = sport + '|||'+ comp;
        const y = ftvCopilotYear(v) || 'n/a';
        if (!byKey.has(key)) byKey.set(key, { key, sport, comp, icon: cls.i || '•', fg: cls.fg || '#143F7D', bg: cls.bg || '#eef6ff', allVideos: [], years: {} });
        const row = byKey.get(key);
        row.allVideos.push(v);
        if (!row.years[y]) row.years[y] = { year: y, views: 0, count: 0, shorts: 0, videos: 0, lives: 0, items: [] };
        const ys = row.years[y];
        const views = ftvCopilotViews(v);
        ys.views += views;
        ys.count += 1;
        ys.items.push(v);
        if (v.type === 'short') ys.shorts += 1;
        else if (v.type === 'live') ys.lives += 1;
        else ys.videos += 1;
    });
    const currentKeys = new Set();
    (currentVideos || []).forEach(v => {
        const cls = ftvCopilotCls(v);
        currentKeys.add((cls.s || 'Autres') + '|||' + (cls.c || 'Général'));
    });
    return Array.from(byKey.values()).map(row => {
        const cur = { views: 0, count: 0, shorts: 0, videos: 0, lives: 0, items: [] };
        (currentVideos || []).forEach(v => {
            const cls = ftvCopilotCls(v);
            if (((cls.s || 'Autres') + '|||' + (cls.c || 'Général')) !== row.key) return;
            cur.views += ftvCopilotViews(v);
            cur.count += 1;
            cur.items.push(v);
            if (v.type === 'short') cur.shorts += 1;
            else if (v.type === 'live') cur.lives += 1;
            else cur.videos += 1;
        });
        const history = Object.values(row.years).filter(y => y.year !== 'n/a').sort((a,b)=>Number(b.year)-Number(a.year));
        const previous = history.filter(y => !cur.items.some(v => ftvCopilotYear(v) === y.year));
        const previousViews = previous.map(y => y.views);
        const median = ftvMedian(previousViews);
        const best = previous.reduce((m,y)=> y.views > (m?.views || 0) ? y : m, null);
        const last = previous[0] || null;
        const deltaMedian = median ? ((cur.views - median) / median) * 100 : null;
        const deltaLast = last?.views ? ((cur.views - last.views) / last.views) * 100 : null;
        const projection = median ? Math.max(cur.views, Math.round((cur.views * 0.55) + (median * 0.45))) : Math.round(cur.views * 1.18);
        return { ...row, current: cur, history, previous, median, best, last, deltaMedian, deltaLast, projection, hasCurrent: currentKeys.has(row.key) };
    }).filter(row => row.hasCurrent || row.allVideos.length >= 2).sort((a,b)=> (b.current.views || b.median || 0) - (a.current.views || a.median || 0));
}
function ftvCopilotChannelName(channelKey) {
    try { return (window.CHANNEL_CONFIGS && window.CHANNEL_CONFIGS[channelKey]?.label) || channelKey || 'Chaîne'; }
    catch(e) { return channelKey || 'Chaîne'; }
}
function ftvCopilotEventPrompt(row, channelKey, dateRange) {
    const years = (row.history || []).map(y => `${y.year}: ${window.fmtFull(y.views)} vues, ${y.count} contenus`).join('\n');
    return `Analyse média comparative pour la chaîne ${ftvCopilotChannelName(channelKey)}.\nÉvènement: ${row.sport} / ${row.comp}.\nPériode actuelle: ${dateRange?.start ? window.fmtDateShort(dateRange.start) : '—'} → ${dateRange?.end ? window.fmtDateShort(dateRange.end) : '—'}.\nPerformance actuelle: ${window.fmtFull(row.current.views)} vues, ${row.current.count} contenus.\nHistorique par année:\n${years || 'pas assez d historique'}.\nDonne une analyse très concise: 1) comparaison avec années précédentes, 2) projection prudente, 3) risque principal, 4) opportunité éditoriale.`;
}

function ftvCopilotTitle(v){
    return String(v?.title || v?.snippet?.title || v?.name || '').trim();
}
function ftvCopilotType(v){
    const t = String(v?.type || v?.format || v?.kind || '').toLowerCase();
    if (t.includes('short')) return 'short';
    if (v?.isShort || v?.is_short) return 'short';
    if (t.includes('live') || v?.isLive) return 'live';
    return 'video';
}
function ftvCopilotDurationSeconds(v){
    const raw = String(v?.duration || v?.contentDetails?.duration || v?.durationISO || '');
    const m = raw.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (m) return (Number(m[1]||0)*3600)+(Number(m[2]||0)*60)+Number(m[3]||0);
    const n = Number(v?.durationSeconds || v?.durationSec || v?.seconds || 0);
    return Number.isFinite(n) ? n : 0;
}
function ftvCopilotEditorialScore(v){
    const title = ftvCopilotTitle(v);
    const len = title.length;
    const views = ftvCopilotViews(v);
    let score = 45;
    if (len >= 45 && len <= 85) score += 14;
    if (/\b(finale|direct|résumé|exploit|incroyable|victoire|record|but|essai|émotion|choc|historique|meilleur|top|moments?)\b/i.test(title)) score += 13;
    if (/[A-ZÉÈÀÙÂÊÎÔÛÇ][a-zéèàùâêîôûç]+\s+[A-ZÉÈÀÙÂÊÎÔÛÇ][a-zéèàùâêîôûç]+/.test(title)) score += 9;
    if (/#/.test(title)) score += 4;
    if (/[!?]/.test(title)) score += 3;
    if (len < 25) score -= 10;
    if (len > 105) score -= 10;
    if (ftvCopilotType(v)==='short') score += 4;
    if (views > 100000) score += 5;
    return Math.max(5, Math.min(100, Math.round(score)));
}
function ftvCopilotBuildAlerts(events, periodVideos, channelName){
    const alerts = [];
    const sorted = [...events].sort((a,b)=>b.current.views-a.current.views);
    sorted.slice(0,8).forEach(e=>{
        if (e.deltaMedian !== null && e.deltaMedian >= 120) alerts.push({level:'hot', title:`${e.comp} surperforme fortement`, detail:`${ftvCopilotFormatPct(e.deltaMedian)} vs médiane historique sur ${channelName}.`, action:'Capitaliser rapidement avec extrait court, relance sociale ou angle éditorial complémentaire.', event:e});
        if (e.deltaMedian !== null && e.deltaMedian <= -35) alerts.push({level:'risk', title:`${e.comp} sous-performe`, detail:`${ftvCopilotFormatPct(e.deltaMedian)} vs médiane historique.`, action:'Vérifier titre, timing, concurrence événementielle et potentiel Shorts.', event:e});
    });
    const total = periodVideos.reduce((s,v)=>s+ftvCopilotViews(v),0) || 1;
    if (sorted[0] && sorted[0].current.views / total > .55) alerts.push({level:'dep', title:'Dépendance événementielle élevée', detail:`${sorted[0].comp} concentre ${Math.round((sorted[0].current.views/total)*100)}% des vues de la période.`, action:'Préparer des relais sur 2 ou 3 verticales secondaires pour réduire la dépendance.', event:sorted[0]});
    const shorts = periodVideos.filter(v=>ftvCopilotType(v)==='short').length;
    if (periodVideos.length && shorts / periodVideos.length > .65) alerts.push({level:'format', title:'Mix très orienté Shorts', detail:`${Math.round(shorts/periodVideos.length*100)}% des contenus sont des Shorts.`, action:'Comparer vues moyennes Shorts vs longs formats avant d’augmenter encore le volume.', event:sorted[0]});
    return alerts.slice(0,8);
}
function ftvCopilotBuildActions(alerts, events){
    const actions = alerts.slice(0,4).map((a,i)=>({rank:i+1, title:a.action, source:a.title, priority:a.level==='risk'?'Haute':a.level==='hot'?'Opportunité':'Moyenne'}));
    if (actions.length < 4) {
        events.slice(0,4-actions.length).forEach((e,i)=>actions.push({rank:actions.length+1, title:`Comparer ${e.comp} avec sa meilleure année historique et isoler les formats qui tirent la performance.`, source:`${e.sport} · ${window.fmtFull(e.current.views)} vues`, priority:'Analyse'}));
    }
    return actions;
}
function ftvCopilotBuildWatchlist(events, channelKey){
    try {
        const saved = JSON.parse(localStorage.getItem('ftv-watchlist-'+channelKey) || '[]');
        return events.filter(e=>saved.includes(e.key)).slice(0,20);
    } catch(e) { return []; }
}
function ftvCopilotToggleWatch(eventKey, channelKey){
    try {
        const k = 'ftv-watchlist-'+channelKey;
        const saved = JSON.parse(localStorage.getItem(k) || '[]');
        const next = saved.includes(eventKey) ? saved.filter(x=>x!==eventKey) : [eventKey, ...saved].slice(0,24);
        localStorage.setItem(k, JSON.stringify(next));
        return next;
    } catch(e) { return []; }
}
function ftvCopilotSeasonality(channelVideos){
    const months = Array.from({length:12},(_,i)=>({month:i+1, views:0, count:0}));
    channelVideos.forEach(v=>{ const d=ftvCopilotDate(v); if(!d) return; const m=d.getMonth(); months[m].views += ftvCopilotViews(v); months[m].count += 1; });
    const max = Math.max(...months.map(m=>m.views),1);
    const names = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
    return months.map((m,i)=>({...m,label:names[i], pct:m.views/max*100}));
}
function ftvCopilotBrief({channelName, periodLabel, selected, alerts, actions, totalViews, count}){
    const lines = [];
    lines.push(`Brief Copilot — ${channelName}`);
    lines.push(`Période : ${periodLabel}`);
    lines.push(`Performance : ${window.fmtFull(totalViews)} vues · ${count} contenus`);
    if (selected) lines.push(`Évènement de référence : ${selected.sport} / ${selected.comp} — ${window.fmtFull(selected.current.views)} vues`);
    lines.push('');
    lines.push('Alertes prioritaires :');
    (alerts.length?alerts:[]).slice(0,4).forEach(a=>lines.push(`- ${a.title} : ${a.detail}`));
    lines.push('');
    lines.push('Actions recommandées :');
    actions.slice(0,4).forEach(a=>lines.push(`${a.rank}. ${a.title}`));
    return lines.join('\n');
}
function PredictiveCopilotView({ allVideos, currentVideos, sportsData, totalViews, channelKey, dateRange, analyticsBundle }) {
    const [selectedKey, setSelectedKey] = React.useState('');
    const [compareYear, setCompareYear] = React.useState('');
    const [analysisMode, setAnalysisMode] = React.useState('performance');
    const [analysis, setAnalysis] = React.useState(null);
    const [loadingAnalysis, setLoadingAnalysis] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [watchTick, setWatchTick] = React.useState(0);
    const [remoteWatchKeys, setRemoteWatchKeys] = React.useState([]);
    const compact = window.AIMediaCopilot?.formatCompact || window.fmt || ((n)=>String(Math.round(Number(n)||0)));
    const channelName = ftvCopilotChannelName(channelKey);
    const channelVideos = React.useMemo(() => (allVideos || []).filter(v => !v.channelKey || !channelKey || v.channelKey === channelKey), [allVideos, channelKey]);
    const periodVideos = React.useMemo(() => {
        const base = currentVideos && currentVideos.length ? currentVideos : channelVideos.filter(v => ftvCopilotInRange(v, dateRange));
        return base.filter(v => !v.channelKey || !channelKey || v.channelKey === channelKey);
    }, [currentVideos, channelVideos, dateRange, channelKey]);
    const events = React.useMemo(() => ftvCopilotBuildEvents({ channelVideos, currentVideos: periodVideos }), [channelVideos, periodVideos]);
    const selected = React.useMemo(() => events.find(e => e.key === selectedKey) || events[0] || null, [events, selectedKey]);
    React.useEffect(() => { if (events[0] && !events.find(e => e.key === selectedKey)) setSelectedKey(events[0].key); }, [events, selectedKey]);
    React.useEffect(() => { setAnalysis(null); setCompareYear(''); }, [selectedKey, channelKey, dateRange?.start?.getTime?.(), dateRange?.end?.getTime?.()]);
    React.useEffect(() => { setAnalysis(null); }, [analysisMode]);
    const channelTotalViews = periodVideos.reduce((s,v)=>s+ftvCopilotViews(v),0);
    const recurringEvents = events.filter(e => e.previous.length > 0).slice(0, 8);
    const topVsHistory = events.filter(e => e.deltaMedian !== null).sort((a,b)=>(b.deltaMedian||-999)-(a.deltaMedian||-999)).slice(0, 5);
    const alerts = React.useMemo(()=>ftvCopilotBuildAlerts(events, periodVideos, channelName), [events, periodVideos, channelName]);
    const actions = React.useMemo(()=>ftvCopilotBuildActions(alerts, events), [alerts, events]);
    React.useEffect(() => {
        let cancelled = false;
        async function loadRemoteWatchlist(){
            try {
                const r = await fetch('/api/user-watchlist?channel=' + encodeURIComponent(channelKey), { credentials:'include' });
                const j = await r.json().catch(()=>({}));
                if (!cancelled && r.ok && Array.isArray(j.items)) {
                    setRemoteWatchKeys(j.items.map(x => x.event_key).filter(Boolean));
                }
            } catch(e) {}
        }
        loadRemoteWatchlist();
        return () => { cancelled = true; };
    }, [channelKey, watchTick]);
    const watchlist = React.useMemo(()=>{
        const local = ftvCopilotBuildWatchlist(events, channelKey).map(e=>e.key);
        const merged = Array.from(new Set([...(remoteWatchKeys || []), ...local]));
        return events.filter(e=>merged.includes(e.key)).slice(0,20);
    }, [events, channelKey, watchTick, remoteWatchKeys]);
    const toggleWatchlist = async (eventKey) => {
        const nextLocal = ftvCopilotToggleWatch(eventKey, channelKey);
        setRemoteWatchKeys(nextLocal);
        setWatchTick(x=>x+1);
        try {
            const r = await fetch('/api/user-watchlist', { method:'POST', credentials:'include', headers:{'content-type':'application/json'}, body:JSON.stringify({ channel:channelKey, event_key:eventKey }) });
            const j = await r.json().catch(()=>({}));
            if (r.ok && Array.isArray(j.items)) setRemoteWatchKeys(j.items.map(x=>x.event_key).filter(Boolean));
        } catch(e) {}
    };
    const seasonality = React.useMemo(()=>ftvCopilotSeasonality(channelVideos), [channelVideos]);
    const qualityVideos = React.useMemo(()=>periodVideos.slice().sort((a,b)=>ftvCopilotViews(b)-ftvCopilotViews(a)).slice(0,8).map(v=>({v, score:ftvCopilotEditorialScore(v)})), [periodVideos]);
    const periodLabel = dateRange?.start && dateRange?.end ? `${window.fmtDateShort(dateRange.start)} → ${window.fmtDateShort(dateRange.end)}` : 'Période affichée';
    const referenceYears = selected ? selected.previous.map(y=>String(y.year)) : [];
    const reference = selected ? (selected.previous.find(y=>String(y.year)===String(compareYear)) || selected.previous[0] || null) : null;
    const modeLabels = { performance:'Performance', projection:'Projection', editorial:'Éditorial' };
    const modeDescriptions = {
        performance:'Compare les vues, volumes, écarts vs historique et dépendance événementielle.',
        projection:'Met l’accent sur les scénarios bas / central / haut et la trajectoire future.',
        editorial:'Analyse les titres, formats, angles, potentiel de reprise et qualité éditoriale.'
    };
    const brief = ftvCopilotBrief({channelName, periodLabel, selected, alerts, actions, totalViews: channelTotalViews || totalViews || 0, count: periodVideos.length});
    const runAnalysis = async () => {
        if (!selected) return;
        if (!window.ftvAuthCan?.('editor')) { setAnalysis('Analyse Claude réservée aux rôles editor/admin.'); return; }
        setLoadingAnalysis(true);
        try {
            const out = await callAnthropicStrategic(ftvCopilotEventPrompt(selected, channelKey, dateRange) + '\n\nMode d’analyse demandé: ' + (modeLabels[analysisMode] || analysisMode) + ' — ' + (modeDescriptions[analysisMode] || '') + '\n\nAlertes détectées:\n' + alerts.map(a=>`- ${a.title}: ${a.detail}`).join('\n') + '\n\nActions proposées:\n' + actions.map(a=>`${a.rank}. ${a.title}`).join('\n'), null, { withWeb:false });
            setAnalysis(out?.text || 'Analyse indisponible.');
        } catch (e) {
            setAnalysis('Impossible de générer l’analyse Claude pour le moment. Le comparatif interne reste disponible ci-dessus.');
        } finally { setLoadingAnalysis(false); }
    };
    const card = (title, value, sub, tone) => React.createElement('div', { className:'ftv-copilot-card', style:{background:'var(--bg2)', color:'var(--text)', border:'1px solid var(--border)'} },
        React.createElement('div',{style:{fontSize:10,textTransform:'uppercase',letterSpacing:1.6,color:'var(--text3)',fontWeight:900}},title),
        React.createElement('div',{style:{fontSize:26,fontWeight:950,marginTop:6,color:tone||'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},value),
        sub && React.createElement('div',{style:{fontSize:11,color:'var(--text3)',marginTop:3}},sub)
    );
    return React.createElement('div', { className:'ftv-copilot-shell ftv-copilot-v91' },
        React.createElement('div', { className:'ftv-copilot-hero', style:{gridTemplateColumns:'1fr', background:'linear-gradient(135deg,#0b1020,#171827)', color:'#fff'} },
            React.createElement('div', null,
                React.createElement('div', { style:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14} },
                    React.createElement('span', { className:'ftv-copilot-pill', style:{background:'rgba(227,6,19,.20)',color:'#fff'} }, 'Intelligence opérationnelle'),
                    React.createElement('span', { className:'ftv-copilot-pill', style:{background:'rgba(255,255,255,.12)',color:'#e5e7eb'} }, channelName),
                    React.createElement('span', { className:'ftv-copilot-pill', style:{background:'rgba(255,255,255,.12)',color:'#e5e7eb'} }, periodLabel)
                ),
                React.createElement('h2', { style:{fontSize:34,lineHeight:1,letterSpacing:'-.055em',margin:'0 0 10px',fontWeight:950,color:'#fff'} }, 'AI Copilot décisionnel'),
                React.createElement('p', { style:{margin:0,color:'rgba(255,255,255,.76)',fontSize:14,lineHeight:1.55,maxWidth:1040} }, 'Le Copilot analyse uniquement la chaîne active, compare les évènements entre années, détecte les alertes, construit une watchlist, évalue la qualité éditoriale et prépare un brief directement exploitable.'),
                React.createElement('div', { className:'ftv-copilot-kpis' },
                    [['Chaîne', channelName, 'base active'], ['Vues période', compact(channelTotalViews || totalViews), `${periodVideos.length} contenus`], ['Alertes', compact(alerts.length), 'anomalies / opportunités'], ['Évènements comparables', compact(recurringEvents.length), 'avec historique']].map(([k,v,s]) => React.createElement('div',{className:'ftv-copilot-card',key:k,style:{background:'rgba(255,255,255,.09)',border:'1px solid rgba(255,255,255,.14)',color:'#fff'}}, React.createElement('div',{style:{fontSize:10,textTransform:'uppercase',letterSpacing:1.6,color:'rgba(255,255,255,.55)',fontWeight:900}},k), React.createElement('div',{style:{fontSize:26,fontWeight:950,marginTop:6,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:'#fff'}},v), React.createElement('div',{style:{fontSize:11,color:'rgba(255,255,255,.62)',marginTop:2}},s)))
                )
            )
        ),
        React.createElement('div', { className:'ftv-copilot-panel ftv-copilot-settings', style:{marginTop:16,marginBottom:16,border:'1px solid var(--border)',background:'var(--bg2)',color:'var(--text)'} },
            React.createElement('div', { style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap',marginBottom:14} },
                React.createElement('div', null,
                    React.createElement('div', { style:{fontSize:10,fontWeight:950,letterSpacing:'1.6px',textTransform:'uppercase',color:'var(--text3)',marginBottom:5} }, 'Paramètres Copilot'),
                    React.createElement('h3', { style:{margin:0,fontSize:20,fontWeight:950,letterSpacing:'-.04em'} }, 'Choisis précisément ce que l’IA doit comparer'),
                    React.createElement('p', { style:{margin:'6px 0 0',fontSize:12,lineHeight:1.45,color:'var(--text3)',maxWidth:760} }, 'Le Copilot utilise la chaîne active, la période du calendrier et les vidéos réellement chargées. Les projections restent des estimations tant que CTR, impressions, watch time et rétention Analytics ne sont pas connectés.')
                ),
                React.createElement('div', { style:{display:'flex',gap:8,flexWrap:'wrap'} },
                    React.createElement('span', { className:'ftv-copilot-pill', style:{background:'var(--bg3)',color:'var(--text2)',border:'1px solid var(--border)'} }, channelName),
                    React.createElement('span', { className:'ftv-copilot-pill', style:{background:'var(--bg3)',color:'var(--text2)',border:'1px solid var(--border)'} }, periodLabel)
                )
            ),
            React.createElement('div', { style:{display:'grid',gridTemplateColumns:'minmax(240px,1.4fr) minmax(150px,.65fr) minmax(180px,.75fr)',gap:12,alignItems:'end'} },
                React.createElement('label', { style:{display:'grid',gap:6,fontSize:11,fontWeight:900,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'1px'} }, 'Événement étudié',
                    React.createElement('select', { value:selected?.key||'', onChange:e=>setSelectedKey(e.target.value), style:{height:44,border:'1px solid var(--border2)',borderRadius:14,padding:'0 12px',fontFamily:'var(--font)',background:'var(--bg)',color:'var(--text)',fontWeight:800,minWidth:0,width:'100%'} }, events.slice(0,200).map(e=>React.createElement('option',{key:e.key,value:e.key}, `${e.sport} — ${e.comp}`)))
                ),
                React.createElement('label', { style:{display:'grid',gap:6,fontSize:11,fontWeight:900,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'1px'} }, 'Comparer avec',
                    React.createElement('select', { value:compareYear, onChange:e=>setCompareYear(e.target.value), style:{height:44,border:'1px solid var(--border2)',borderRadius:14,padding:'0 12px',fontFamily:'var(--font)',background:'var(--bg)',color:'var(--text)',fontWeight:800,minWidth:0,width:'100%'} }, React.createElement('option',{value:''}, referenceYears.length ? `Médiane historique` : 'Aucune référence'), referenceYears.map(y=>React.createElement('option',{key:y,value:y},y)))
                ),
                React.createElement('label', { style:{display:'grid',gap:6,fontSize:11,fontWeight:900,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'1px'} }, 'Type d’analyse',
                    React.createElement('select', { value:analysisMode, onChange:e=>setAnalysisMode(e.target.value), style:{height:44,border:'1px solid var(--border2)',borderRadius:14,padding:'0 12px',fontFamily:'var(--font)',background:'var(--bg)',color:'var(--text)',fontWeight:800,minWidth:0,width:'100%'} },
                        React.createElement('option',{value:'performance'},'Performance'),
                        React.createElement('option',{value:'projection'},'Projection'),
                        React.createElement('option',{value:'editorial'},'Éditorial')
                    )
                )
            ),
            React.createElement('div', { style:{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginTop:12} },
                React.createElement('div', { style:{border:'1px solid var(--border)',background:'var(--bg3)',borderRadius:14,padding:'10px 12px'} }, React.createElement('b',{style:{fontSize:11,color:'var(--text2)'}},'Données réelles'), React.createElement('div',{style:{fontSize:11,color:'var(--text3)',lineHeight:1.45,marginTop:4}},'Vues publiques, dates, titres, formats, chaînes, classifications et historique chargé.')),
                React.createElement('div', { style:{border:'1px solid var(--border)',background:'var(--bg3)',borderRadius:14,padding:'10px 12px'} }, React.createElement('b',{style:{fontSize:11,color:'var(--text2)'}},'Estimations'), React.createElement('div',{style:{fontSize:11,color:'var(--text3)',lineHeight:1.45,marginTop:4}},'Projection, risque, potentiel, scénarios et recommandations sont calculés par heuristique.')),
                React.createElement('div', { style:{border:'1px solid var(--border)',background:'var(--bg3)',borderRadius:14,padding:'10px 12px'} }, React.createElement('b',{style:{fontSize:11,color:'var(--text2)'}}, modeLabels[analysisMode] || 'Mode'), React.createElement('div',{style:{fontSize:11,color:'var(--text3)',lineHeight:1.45,marginTop:4}}, modeDescriptions[analysisMode] || 'Analyse du contexte média.'))
            )
        ),
        React.createElement('div', { className:'ftv-copilot-grid', style:{gridTemplateColumns:'minmax(0,1.08fr) minmax(360px,.92fr)'} },
            React.createElement('div', { className:'ftv-copilot-panel' },
                React.createElement('div', { style:{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:14,flexWrap:'wrap'} },
                    React.createElement('div', null,
                        React.createElement('h3', { style:{margin:'0 0 4px',fontSize:20,fontWeight:950,letterSpacing:'-.04em'} }, 'Comparateur d’évènements'),
                        React.createElement('div', { style:{fontSize:12,color:'var(--text3)',lineHeight:1.45} }, 'Choisis une compétition ou thématique, puis compare la période actuelle à une année de référence de la même chaîne.')
                    ),
                    React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
                        React.createElement('select', { value:selected?.key||'', onChange:e=>setSelectedKey(e.target.value), style:{height:40,border:'1px solid var(--border2)',borderRadius:12,padding:'0 10px',fontFamily:'var(--font)',maxWidth:340,background:'var(--bg2)',color:'var(--text)'} }, events.slice(0,160).map(e=>React.createElement('option',{key:e.key,value:e.key}, `${e.sport} — ${e.comp}`))),
                        React.createElement('select', { value:compareYear, onChange:e=>setCompareYear(e.target.value), style:{height:40,border:'1px solid var(--border2)',borderRadius:12,padding:'0 10px',fontFamily:'var(--font)',background:'var(--bg2)',color:'var(--text)'} }, React.createElement('option',{value:''},'Référence'), referenceYears.map(y=>React.createElement('option',{key:y,value:y},y)))
                    )
                ),
                selected ? React.createElement('div', null,
                    React.createElement('div', { style:{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:10,marginBottom:14} },
                        [card('Période', window.fmtFull(selected.current.views), `${selected.current.count} contenus`), card('Référence', reference?window.fmtFull(reference.views):'—', reference?`${reference.year} · ${reference.count} contenus`:'aucune année'), card('Écart', reference?ftvCopilotFormatPct((selected.current.views-reference.views)/Math.max(1,reference.views)*100):(selected.deltaMedian!==null?ftvCopilotFormatPct(selected.deltaMedian):'—'), 'vs référence', (reference && selected.current.views>=reference.views)?'#166534':'#9A3412'), card('Projection', window.fmtFull(selected.projection), 'scénario central')]
                    ),
                    React.createElement('div', { style:{border:'1px solid var(--border)',borderRadius:16,overflow:'hidden',marginBottom:14} },
                        React.createElement('div', { style:{display:'grid',gridTemplateColumns:'90px 1fr 100px 100px',gap:0,background:'var(--bg3)',fontSize:10,fontWeight:900,color:'var(--text3)',letterSpacing:1,textTransform:'uppercase',padding:'10px 12px'} }, React.createElement('div',null,'Année'),React.createElement('div',null,'Performance'),React.createElement('div',null,'Contenus'),React.createElement('div',null,'Mix')),
                        (selected.history || []).map(y => {
                            const max = Math.max(...selected.history.map(h=>h.views), 1);
                            return React.createElement('div',{key:y.year,style:{display:'grid',gridTemplateColumns:'90px 1fr 100px 100px',alignItems:'center',gap:0,padding:'11px 12px',borderTop:'1px solid var(--border)',fontSize:12,background:reference&&String(reference.year)===String(y.year)?'rgba(227,6,19,.045)':'transparent'}},
                                React.createElement('div',{style:{fontWeight:950,color:String(y.year)===String(dateRange?.start?.getFullYear?.())?'#E30613':'var(--text)'}},y.year),
                                React.createElement('div',null,React.createElement('div',{style:{fontWeight:950,marginBottom:5}},window.fmtFull(y.views),' vues'),React.createElement('div',{style:{height:7,background:'var(--bg4)',borderRadius:99,overflow:'hidden'}},React.createElement('div',{style:{height:'100%',width:`${Math.max(4,(y.views/max)*100)}%`,background:'linear-gradient(90deg,#E30613,#143F7D)',borderRadius:99}}))),
                                React.createElement('div',{style:{fontWeight:850}},y.count),
                                React.createElement('div',{style:{color:'var(--text3)'}},`${y.videos}V · ${y.shorts}S`)
                            );
                        })
                    ),
                    React.createElement('div', { style:{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:10,marginBottom:14} },
                        [['Scénario bas', Math.round((selected.median || selected.current.views) * .82), 'vélocité faible / concurrence'], ['Central', selected.projection, 'trajectoire historique'], ['Haut', Math.round(Math.max(selected.current.views, selected.best?.views || selected.projection) * 1.12), 'moment éditorial fort']].map(([k,v,s])=>React.createElement('div',{key:k,className:'ftv-copilot-scenario'},React.createElement('div',{style:{fontWeight:950,fontSize:13}},k),React.createElement('div',{style:{fontSize:22,fontWeight:950,color:'#E30613',marginTop:4}},compact(v)),React.createElement('div',{style:{fontSize:11,color:'var(--text3)',lineHeight:1.45,marginTop:4}},s)))
                    ),
                    React.createElement('button',{onClick:()=>toggleWatchlist(selected.key),style:{height:38,borderRadius:12,border:'1px solid var(--border2)',background:'var(--bg2)',fontWeight:900,fontFamily:'var(--font)',padding:'0 14px',cursor:'pointer'}}, watchlist.find(w=>w.key===selected.key)?'Retirer de la watchlist':'Ajouter à la watchlist')
                ) : React.createElement('div',{style:{color:'var(--text3)',padding:24}},'Pas assez de données sur cette chaîne pour construire un comparatif.')
            ),
            React.createElement('div', { className:'ftv-copilot-panel' },
                React.createElement('h3', { style:{margin:'0 0 10px',fontSize:19,fontWeight:950} }, 'Alertes intelligentes'),
                alerts.length ? alerts.map((a,i)=>React.createElement('div',{key:i,style:{display:'grid',gridTemplateColumns:'10px 1fr',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}},React.createElement('span',{style:{width:10,height:10,borderRadius:99,background:a.level==='risk'?'#f59e0b':a.level==='hot'?'#16a34a':'#E30613',marginTop:4}},''),React.createElement('div',null,React.createElement('div',{style:{fontWeight:950,fontSize:13}},a.title),React.createElement('div',{style:{fontSize:11,color:'var(--text3)',lineHeight:1.45,marginTop:2}},a.detail),React.createElement('div',{style:{fontSize:11,color:'var(--text2)',lineHeight:1.45,marginTop:5,fontWeight:800}},a.action)))) : React.createElement('div',{style:{fontSize:12,color:'var(--text3)'}},'Aucune anomalie forte détectée sur cette période.'),
                React.createElement('h3', { style:{margin:'18px 0 10px',fontSize:16,fontWeight:950} }, 'Top actions'),
                actions.map(a=>React.createElement('div',{key:a.rank,style:{display:'grid',gridTemplateColumns:'28px 1fr auto',gap:10,alignItems:'start',padding:'9px 0',borderBottom:'1px solid var(--border)'}},React.createElement('div',{style:{width:24,height:24,borderRadius:999,background:'var(--bg3)',display:'grid',placeItems:'center',fontWeight:950,fontSize:11}},a.rank),React.createElement('div',null,React.createElement('div',{style:{fontWeight:900,fontSize:12,lineHeight:1.35}},a.title),React.createElement('div',{style:{fontSize:10,color:'var(--text3)',marginTop:3}},a.source)),React.createElement('span',{style:{fontSize:10,fontWeight:900,color:'#E30613'}},a.priority)))
            )
        ),
        React.createElement('div', { className:'ftv-copilot-grid', style:{gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)'} },
            React.createElement('div', { className:'ftv-copilot-panel' },
                React.createElement('h3', { style:{margin:'0 0 10px',fontSize:18,fontWeight:950} }, 'Watchlist événementielle'),
                watchlist.length ? watchlist.map(w=>React.createElement('div',{key:w.key,style:{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}},React.createElement('div',null,React.createElement('div',{style:{fontWeight:950,fontSize:13}},w.comp),React.createElement('div',{style:{fontSize:11,color:'var(--text3)'}},w.sport,' · ',window.fmtFull(w.current.views),' vues')),React.createElement('button',{onClick:()=>{setSelectedKey(w.key); window.scrollTo({top:0,behavior:'smooth'});},style:{border:'1px solid var(--border)',borderRadius:999,padding:'6px 10px',fontWeight:900,background:'var(--bg2)'}},'Ouvrir'))) : React.createElement('div',{style:{fontSize:12,color:'var(--text3)',lineHeight:1.5}},'Aucun évènement épinglé. Ajoute une compétition depuis le comparateur pour la suivre entre les visites.'),
                React.createElement('h3', { style:{margin:'18px 0 10px',fontSize:18,fontWeight:950} }, 'Dépendance événementielle'),
                events.slice(0,5).map(e=>{ const pct = channelTotalViews ? e.current.views/channelTotalViews*100 : 0; return React.createElement('div',{key:e.key,style:{marginBottom:10}},React.createElement('div',{style:{display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:900}},React.createElement('span',null,e.comp),React.createElement('span',null,Math.round(pct),'%')),React.createElement('div',{style:{height:8,background:'var(--bg4)',borderRadius:999,overflow:'hidden',marginTop:5}},React.createElement('div',{style:{height:'100%',width:`${Math.min(100,pct)}%`,background:pct>50?'#E30613':'#143F7D'}})));})
            ),
            React.createElement('div', { className:'ftv-copilot-panel' },
                React.createElement('h3', { style:{margin:'0 0 10px',fontSize:18,fontWeight:950} }, 'Saisonnalité'),
                React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:5,alignItems:'end',height:160,padding:'8px 0 4px'}},seasonality.map(m=>React.createElement('div',{key:m.month,style:{display:'flex',flexDirection:'column',alignItems:'center',gap:5}},React.createElement('div',{title:`${m.label}: ${window.fmtFull(m.views)} vues`,style:{width:'100%',height:`${Math.max(4,m.pct)}%`,background:m.pct>70?'#E30613':'#cbd5e1',borderRadius:'8px 8px 2px 2px'}},''),React.createElement('span',{style:{fontSize:9,color:'var(--text3)',fontWeight:800}},m.label)))) ,
                React.createElement('div',{style:{fontSize:11,color:'var(--text3)',lineHeight:1.5,marginTop:8}},'Lecture rapide : les mois les plus hauts correspondent aux temps forts récurrents de la chaîne. Cette base peut alimenter les prévisions éditoriales à l’année.')
            )
        ),
        React.createElement('div', { className:'ftv-copilot-grid', style:{gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)'} },
            React.createElement('div', { className:'ftv-copilot-panel' },
                React.createElement('h3', { style:{margin:'0 0 10px',fontSize:18,fontWeight:950} }, 'Qualité éditoriale des vidéos'),
                qualityVideos.length ? qualityVideos.map(({v,score})=>React.createElement('div',{key:v.id||ftvCopilotTitle(v),style:{display:'grid',gridTemplateColumns:'1fr 54px',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}},React.createElement('div',null,React.createElement('div',{style:{fontWeight:900,fontSize:12,lineHeight:1.35,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}},ftvCopilotTitle(v)||'Vidéo sans titre'),React.createElement('div',{style:{fontSize:10,color:'var(--text3)',marginTop:4}},window.fmtFull(ftvCopilotViews(v)),' vues · ',ftvCopilotType(v))),React.createElement('div',{style:{fontWeight:950,color:score>=70?'#166534':score>=50?'#9A3412':'#991B1B',textAlign:'right'}},score,'/100'))) : React.createElement('div',{style:{fontSize:12,color:'var(--text3)'}},'Pas de vidéos sur la période.'),
                React.createElement('div',{style:{fontSize:11,color:'var(--text3)',lineHeight:1.5,marginTop:10}},'Score heuristique : clarté du titre, dimension événementielle, présence d’un nom propre, longueur, format et traction publique.')
            ),
            React.createElement('div', { className:'ftv-copilot-panel' },
                React.createElement('div',{style:{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:10}},React.createElement('h3', { style:{margin:0,fontSize:18,fontWeight:950} }, 'Brief prêt à partager'),React.createElement('button',{onClick:async()=>{try{await navigator.clipboard.writeText(brief);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch(e){}},style:{border:'0',borderRadius:999,background:'#E30613',color:'#fff',height:34,padding:'0 14px',fontWeight:950,fontFamily:'var(--font)'}},copied?'Copié':'Copier')),
                React.createElement('pre',{style:{whiteSpace:'pre-wrap',fontFamily:'var(--font)',fontSize:12,lineHeight:1.55,color:'var(--text2)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:16,padding:14,maxHeight:320,overflow:'auto'}},brief),
                selected && React.createElement('button', { onClick:runAnalysis, disabled:loadingAnalysis, style:{width:'100%',height:44,borderRadius:14,border:0,background:'#111827',color:'#fff',fontWeight:950,fontFamily:'var(--font)',cursor:'pointer',marginTop:12} }, loadingAnalysis ? 'Analyse en cours…' : 'Enrichir ce brief avec Claude'),
                analysis && React.createElement('div', { style:{whiteSpace:'pre-wrap',fontSize:12,lineHeight:1.6,color:'var(--text2)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:16,padding:12,marginTop:12} }, analysis)
            )
        )
    );
}

function ftvCopilotBuildEventComparison(left, right) {
    if (!left || !right) return null;
    const lViews = Number(left.current?.views || left.median || 0);
    const rViews = Number(right.current?.views || right.median || 0);
    const lCount = Number(left.current?.count || 0);
    const rCount = Number(right.current?.count || 0);
    const delta = rViews ? ((lViews - rViews) / rViews) * 100 : null;
    const avgL = lCount ? lViews / lCount : 0;
    const avgR = rCount ? rViews / rCount : 0;
    const deltaAvg = avgR ? ((avgL - avgR) / avgR) * 100 : null;
    return { lViews, rViews, lCount, rCount, delta, avgL, avgR, deltaAvg };
}

function OperationalIntelligenceView({ allVideos, currentVideos, sportsData, totalViews, channelKey, dateRange, analyticsBundle }) {
    const compact = window.AIMediaCopilot?.formatCompact || window.fmt || ((n)=>String(Math.round(Number(n)||0)));
    const channelName = ftvCopilotChannelName(channelKey);
    const channelVideos = React.useMemo(() => (allVideos || []).filter(v => !v.channelKey || !channelKey || v.channelKey === channelKey), [allVideos, channelKey]);
    const periodVideos = React.useMemo(() => {
        const base = currentVideos && currentVideos.length ? currentVideos : channelVideos.filter(v => ftvCopilotInRange(v, dateRange));
        return base.filter(v => !v.channelKey || !channelKey || v.channelKey === channelKey);
    }, [currentVideos, channelVideos, dateRange, channelKey]);
    const events = React.useMemo(() => ftvCopilotBuildEvents({ channelVideos, currentVideos: periodVideos }), [channelVideos, periodVideos]);
    const alerts = React.useMemo(()=>ftvCopilotBuildAlerts(events, periodVideos, channelName), [events, periodVideos, channelName]);
    const actions = React.useMemo(()=>ftvCopilotBuildActions(alerts, events), [alerts, events]);
    const [leftKey, setLeftKey] = React.useState('');
    const [rightKey, setRightKey] = React.useState('');
    React.useEffect(() => {
        if (!events.length) return;
        if (!events.find(e=>e.key===leftKey)) setLeftKey(events[0]?.key || '');
        if (!events.find(e=>e.key===rightKey)) setRightKey(events[1]?.key || events[0]?.key || '');
    }, [events, leftKey, rightKey]);
    const [leftYear, setLeftYear] = React.useState('current');
    const [rightYear, setRightYear] = React.useState('previous');
    const left = events.find(e=>e.key===leftKey) || events[0] || null;
    const right = events.find(e=>e.key===rightKey) || events[1] || events[0] || null;
    const yearOptions = React.useMemo(() => {
        const years = new Set();
        [left, right].forEach(row => (row?.history || []).forEach(y => { if (y.year && y.year !== 'n/a') years.add(String(y.year)); }));
        return Array.from(years).sort((a,b)=>Number(b)-Number(a));
    }, [left, right]);
    const pickYearStats = (row, yearChoice) => {
        if (!row) return { views:0, count:0, label:'—', avg:0 };
        if (yearChoice === 'current') {
            const views = Number(row.current?.views || 0), count = Number(row.current?.count || 0);
            return { views, count, label:'Période actuelle', avg: count ? views / count : 0 };
        }
        if (yearChoice === 'previous') {
            const prev = (row.previous || [])[0] || (row.history || [])[0] || null;
            const views = Number(prev?.views || 0), count = Number(prev?.count || 0);
            return { views, count, label: prev?.year ? `Année ${prev.year}` : 'Historique', avg: count ? views / count : 0 };
        }
        const y = (row.history || []).find(h => String(h.year) === String(yearChoice));
        const views = Number(y?.views || 0), count = Number(y?.count || 0);
        return { views, count, label: y?.year ? `Année ${y.year}` : String(yearChoice), avg: count ? views / count : 0 };
    };
    const leftStats = pickYearStats(left, leftYear);
    const rightStats = pickYearStats(right, rightYear);
    const cmp = left && right ? {
        lViews:leftStats.views,
        rViews:rightStats.views,
        lCount:leftStats.count,
        rCount:rightStats.count,
        avgL:leftStats.avg,
        avgR:rightStats.avg,
        delta:rightStats.views ? ((leftStats.views - rightStats.views) / rightStats.views) * 100 : null,
        deltaAvg:rightStats.avg ? ((leftStats.avg - rightStats.avg) / rightStats.avg) * 100 : null
    } : null;
    const periodLabel = dateRange?.start && dateRange?.end ? `${window.fmtDateShort(dateRange.start)} → ${window.fmtDateShort(dateRange.end)}` : 'Période affichée';
    const severityColor = lvl => lvl==='risk' ? '#f59e0b' : lvl==='hot' ? '#16a34a' : lvl==='dep' ? '#E30613' : '#143F7D';
    const eventOption = e => `${e.sport} — ${e.comp}`;
    const yearSelectOptions = yearOptions.length ? yearOptions : ['2026','2025','2024'];
    return React.createElement('div', { className:'ftv-copilot-shell ftv-operational-v94' },
        React.createElement('div', { className:'ftv-copilot-hero', style:{gridTemplateColumns:'1fr', background:'linear-gradient(135deg,#0b1020,#171827)', color:'#fff'} },
            React.createElement('div', null,
                React.createElement('div', { style:{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14} },
                    React.createElement('span', { className:'ftv-copilot-pill', style:{background:'rgba(227,6,19,.20)',color:'#fff'} }, 'Centre d’action'),
                    React.createElement('span', { className:'ftv-copilot-pill', style:{background:'rgba(255,255,255,.12)',color:'#e5e7eb'} }, channelName),
                    React.createElement('span', { className:'ftv-copilot-pill', style:{background:'rgba(255,255,255,.12)',color:'#e5e7eb'} }, periodLabel)
                ),
                React.createElement('h2', { style:{fontSize:34,lineHeight:1,letterSpacing:'-.055em',margin:'0 0 10px',fontWeight:950,color:'#fff'} }, 'Intelligence opérationnelle'),
                React.createElement('p', { style:{margin:0,color:'rgba(255,255,255,.76)',fontSize:14,lineHeight:1.55,maxWidth:1040} }, 'Un onglet orienté décision : alertes, priorités, comparateur évènement A vs B et signaux à traiter. Les données utilisées sont celles de la chaîne active et de la période sélectionnée.'),
                React.createElement('div', { className:'ftv-copilot-kpis' },
                    [['Vues période', compact(periodVideos.reduce((s,v)=>s+ftvCopilotViews(v),0) || totalViews), `${periodVideos.length} contenus`], ['Alertes', compact(alerts.length), 'signaux détectés'], ['Actions', compact(actions.length), 'priorités'], ['Évènements', compact(events.length), 'comparables']].map(([k,v,s]) => React.createElement('div',{className:'ftv-copilot-card',key:k,style:{background:'rgba(255,255,255,.09)',border:'1px solid rgba(255,255,255,.14)',color:'#fff'}}, React.createElement('div',{style:{fontSize:10,textTransform:'uppercase',letterSpacing:1.6,color:'rgba(255,255,255,.55)',fontWeight:900}},k), React.createElement('div',{style:{fontSize:26,fontWeight:950,marginTop:6,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:'#fff'}},v), React.createElement('div',{style:{fontSize:11,color:'rgba(255,255,255,.62)',marginTop:2}},s)))
                )
            )
        ),
        React.createElement(BriefAutoView, { channelName, periodLabel, sportsData: Object.fromEntries(events.map(e => [e.comp, { views:e.current.views, count:e.current.count }])), totalViews: periodVideos.reduce((s,v)=>s+ftvCopilotViews(v),0) || totalViews, filteredCount: periodVideos.length }),
        React.createElement('div', { className:'ftv-copilot-grid', style:{gridTemplateColumns:'minmax(0,1.05fr) minmax(360px,.95fr)'} },
            React.createElement('div', { className:'ftv-copilot-panel' },
                React.createElement('h3', { style:{margin:'0 0 12px',fontSize:20,fontWeight:950} }, 'Alertes à traiter'),
                alerts.length ? alerts.map((a,i)=>React.createElement('div',{key:i,style:{display:'grid',gridTemplateColumns:'12px 1fr auto',gap:12,padding:'13px 0',borderBottom:'1px solid var(--border)',alignItems:'start'}},
                    React.createElement('span',{style:{width:12,height:12,borderRadius:99,background:severityColor(a.level),marginTop:4}},''),
                    React.createElement('div',null,React.createElement('div',{style:{fontWeight:950,fontSize:14}},a.title),React.createElement('div',{style:{fontSize:12,color:'var(--text3)',lineHeight:1.45,marginTop:4}},a.detail),React.createElement('div',{style:{fontSize:12,color:'var(--text2)',lineHeight:1.45,marginTop:7,fontWeight:800}},a.action)),
                    React.createElement('span',{style:{fontSize:10,fontWeight:950,color:severityColor(a.level),textTransform:'uppercase'}},a.level)
                )) : React.createElement('div',{style:{fontSize:13,color:'var(--text3)',lineHeight:1.55}},'Aucune alerte critique détectée sur cette période. Essaie une période plus courte pour faire ressortir les anomalies.'),
                React.createElement('h3', { style:{margin:'22px 0 10px',fontSize:18,fontWeight:950} }, 'Top actions'),
                actions.map(a=>React.createElement('div',{key:a.rank,style:{display:'grid',gridTemplateColumns:'32px 1fr auto',gap:10,alignItems:'start',padding:'10px 0',borderBottom:'1px solid var(--border)'}},React.createElement('div',{style:{width:28,height:28,borderRadius:999,background:'var(--bg3)',display:'grid',placeItems:'center',fontWeight:950,fontSize:11}},a.rank),React.createElement('div',null,React.createElement('div',{style:{fontWeight:900,fontSize:13,lineHeight:1.35}},a.title),React.createElement('div',{style:{fontSize:11,color:'var(--text3)',marginTop:3}},a.source)),React.createElement('span',{style:{fontSize:10,fontWeight:900,color:'#E30613'}},a.priority)))
            ),
            React.createElement('div', { className:'ftv-copilot-panel' },
                React.createElement('h3', { style:{margin:'0 0 10px',fontSize:20,fontWeight:950} }, 'Comparateur évènement A vs B'),
                React.createElement('p', { style:{fontSize:12,color:'var(--text3)',lineHeight:1.45,margin:'0 0 14px'} }, 'Compare deux évènements différents ou le même évènement sur deux années distinctes. Exemple : Rugby — Six Nations en période actuelle vs Rugby — Six Nations en 2025.'),
                React.createElement('div',{style:{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:14,marginBottom:16}},
                    React.createElement('div',{style:{display:'grid',gap:8,minWidth:0}},
                        React.createElement('label',{style:{display:'grid',gap:6,fontSize:11,fontWeight:900,color:'var(--text3)',textTransform:'uppercase'}},'Évènement A',React.createElement('select',{value:left?.key||'',onChange:e=>setLeftKey(e.target.value),style:{height:42,border:'1px solid var(--border2)',borderRadius:14,padding:'0 10px',background:'var(--bg)',color:'var(--text)',fontFamily:'var(--font)',fontWeight:800,minWidth:0,width:'100%'}},events.slice(0,200).map(e=>React.createElement('option',{key:e.key,value:e.key},eventOption(e))))),
                        React.createElement('label',{style:{display:'grid',gap:6,fontSize:11,fontWeight:900,color:'var(--text3)',textTransform:'uppercase'}},'Période A',React.createElement('select',{value:leftYear,onChange:e=>setLeftYear(e.target.value),style:{height:40,border:'1px solid var(--border2)',borderRadius:13,padding:'0 10px',background:'var(--bg)',color:'var(--text)',fontFamily:'var(--font)',fontWeight:800,minWidth:0,width:'100%'}},React.createElement('option',{value:'current'},'Période actuelle'),React.createElement('option',{value:'previous'},'Année précédente disponible'),yearSelectOptions.map(y=>React.createElement('option',{key:'la-'+y,value:y},y))))
                    ),
                    React.createElement('div',{style:{display:'grid',gap:8,minWidth:0}},
                        React.createElement('label',{style:{display:'grid',gap:6,fontSize:11,fontWeight:900,color:'var(--text3)',textTransform:'uppercase'}},'Évènement B',React.createElement('select',{value:right?.key||'',onChange:e=>setRightKey(e.target.value),style:{height:42,border:'1px solid var(--border2)',borderRadius:14,padding:'0 10px',background:'var(--bg)',color:'var(--text)',fontFamily:'var(--font)',fontWeight:800,minWidth:0,width:'100%'}},events.slice(0,200).map(e=>React.createElement('option',{key:e.key,value:e.key},eventOption(e))))),
                        React.createElement('label',{style:{display:'grid',gap:6,fontSize:11,fontWeight:900,color:'var(--text3)',textTransform:'uppercase'}},'Période B',React.createElement('select',{value:rightYear,onChange:e=>setRightYear(e.target.value),style:{height:40,border:'1px solid var(--border2)',borderRadius:13,padding:'0 10px',background:'var(--bg)',color:'var(--text)',fontFamily:'var(--font)',fontWeight:800,minWidth:0,width:'100%'}},React.createElement('option',{value:'current'},'Période actuelle'),React.createElement('option',{value:'previous'},'Année précédente disponible'),yearSelectOptions.map(y=>React.createElement('option',{key:'rb-'+y,value:y},y))))
                    )
                ),
                cmp ? React.createElement('div',{style:{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:14}},
                    React.createElement('div',{style:{border:'1px solid var(--border)',background:'var(--bg3)',borderRadius:16,padding:16,minWidth:0}},React.createElement('div',{style:{fontSize:11,color:'var(--text3)',fontWeight:900,textTransform:'uppercase',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},left?.comp||'A'),React.createElement('div',{style:{fontSize:12,color:'var(--text3)',fontWeight:800,marginTop:3}},leftStats.label),React.createElement('div',{style:{fontSize:24,fontWeight:950,marginTop:6}},compact(cmp.lViews)),React.createElement('div',{style:{fontSize:11,color:'var(--text3)'}},`${cmp.lCount} contenus · ${compact(Math.round(cmp.avgL))} vues moy.`)),
                    React.createElement('div',{style:{border:'1px solid var(--border)',background:'var(--bg3)',borderRadius:16,padding:16,minWidth:0}},React.createElement('div',{style:{fontSize:11,color:'var(--text3)',fontWeight:900,textTransform:'uppercase',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},right?.comp||'B'),React.createElement('div',{style:{fontSize:12,color:'var(--text3)',fontWeight:800,marginTop:3}},rightStats.label),React.createElement('div',{style:{fontSize:24,fontWeight:950,marginTop:6}},compact(cmp.rViews)),React.createElement('div',{style:{fontSize:11,color:'var(--text3)'}},`${cmp.rCount} contenus · ${compact(Math.round(cmp.avgR))} vues moy.`)),
                    React.createElement('div',{style:{gridColumn:'1 / -1',border:'1px solid var(--border)',borderRadius:16,padding:16,background:'var(--bg2)'}},React.createElement('div',{style:{fontSize:11,color:'var(--text3)',fontWeight:900,textTransform:'uppercase'}},'Écart A vs B'),React.createElement('div',{style:{fontSize:28,fontWeight:950,color:(cmp.delta||0)>=0?'#166534':'#991B1B',marginTop:4}},cmp.delta===null?'—':ftvCopilotFormatPct(cmp.delta)),React.createElement('div',{style:{fontSize:12,color:'var(--text3)',marginTop:4}},'Écart moyen par contenu : ',cmp.deltaAvg===null?'—':ftvCopilotFormatPct(cmp.deltaAvg)))
                ) : React.createElement('div',{style:{fontSize:13,color:'var(--text3)'}},'Pas assez de données pour comparer.' )
            )
        )
    );
}





// ─── MOBILE APP SHELL v71 — vrai rendu mobile séparé, pas un desktop compressé ──
function useFTVMobileViewport(){
    const get = () => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= 760 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 920);
    };
    const [isMobile,setIsMobile]=useState(get);
    useEffect(()=>{
        const on=()=>setIsMobile(get());
        window.addEventListener('resize',on,{passive:true});
        window.addEventListener('orientationchange',on,{passive:true});
        return ()=>{window.removeEventListener('resize',on);window.removeEventListener('orientationchange',on);};
    },[]);
    return isMobile;
}
function mobileTypeLabel(t){ return t==='short'?'Short':t==='live'?'Live':'Vidéo'; }
function MobileStat({label,value,sub,accent}){
    return React.createElement('div',{className:'ftv-m-stat',style:{'--accent':accent||'var(--blue)'}},
        React.createElement('div',{className:'ftv-m-stat-label'},label),
        React.createElement('div',{className:'ftv-m-stat-value'},typeof value==='number'?fmt(value):value),
        sub?React.createElement('div',{className:'ftv-m-stat-sub'},sub):null
    );
}
function MobileDrawer({open,onClose,channelKey,onChannelChange,activeChannel}){
    const [theme,setThemeState]=useState(()=>document.documentElement.getAttribute('data-ftv-theme')==='dark'?'dark':'light');
    const toggleTheme=()=>{ const next=theme==='dark'?'light':'dark'; setThemeState(next); window.ftvSetTheme?window.ftvSetTheme(next):document.documentElement.setAttribute('data-ftv-theme',next); };
    return React.createElement(React.Fragment,null,
        React.createElement('div',{className:'ftv-m-drawer-backdrop '+(open?'is-open':''),onClick:onClose}),
        React.createElement('aside',{className:'ftv-m-drawer '+(open?'is-open':''),role:'dialog','aria-modal':'true'},
            React.createElement('div',{className:'ftv-m-drawer-head'},
                React.createElement('div',null,
                    React.createElement('div',{className:'ftv-m-drawer-kicker'},'MENU'),
                    React.createElement('div',{className:'ftv-m-drawer-title'},'Compte')
                ),
                React.createElement('button',{className:'ftv-m-drawer-close',onClick:onClose,'aria-label':'Fermer'},'×')
            ),
            React.createElement('div',{className:'ftv-m-drawer-section'},
                React.createElement('label',{className:'ftv-m-drawer-label'},'Chaîne'),
                React.createElement('select',{className:'ftv-m-drawer-select',value:channelKey,onChange:e=>onChannelChange(e.target.value)},(window.FTV_ALLOWED_CHANNEL_CONFIGS||Object.values(CHANNEL_CONFIGS)).map(ch=>React.createElement('option',{key:ch.key,value:ch.key},ch.label)))
            ),
            window.ftvAuthCan?.('admin') && React.createElement('button',{className:'ftv-m-drawer-row',onClick:()=>{window.open('/admin.html','_blank');}},React.createElement('span',null,'⚙️'),React.createElement('span',null,'Console admin')),
            React.createElement('button',{className:'ftv-m-drawer-row',onClick:toggleTheme},React.createElement('span',null,theme==='dark'?'☀️':'🌙'),React.createElement('span',null,theme==='dark'?'Mode clair':'Dark mode')),
            React.createElement('button',{className:'ftv-m-drawer-row',onClick:()=>{ try{localStorage.removeItem(getCacheKey(channelKey)); location.reload();}catch(e){location.reload();} }},React.createElement('span',null,'♻️'),React.createElement('span',null,'Recharger les données')),
            React.createElement('div',{className:'ftv-m-drawer-note'},'Dashboard mobile séparé du desktop : navigation, sports, cartes et onglets sont adaptés au tactile.')
        )
    );
}
function MobileTopBar({searchInput,setSearchInput,onMenu,activeChannel}){
    const hasSearch = !!String(searchInput||'').trim();
    return React.createElement('header',{className:'ftv-m-topbar'},
        React.createElement('div',{className:'ftv-m-brand'},'france.tv'),
        React.createElement('div',{className:'ftv-m-search'},
            React.createElement('span',{className:'ftv-m-search-icon'},'⌕'),
            React.createElement('input',{value:searchInput,onChange:e=>setSearchInput(e.target.value),placeholder:'Rechercher…','aria-label':'Recherche'}),
            hasSearch ? React.createElement('button',{className:'ftv-m-search-clear',onClick:()=>setSearchInput(''),'aria-label':'Effacer la recherche'},'×') : null
        ),
        React.createElement('button',{className:'ftv-m-menu-btn',onClick:onMenu,'aria-label':'Ouvrir le menu'},React.createElement('span',null),React.createElement('span',null),React.createElement('span',null))
    );
}
function MobileSportsRail({sortedSports,activeKey,onSelect}){
    return React.createElement('div',{className:'ftv-m-sports-rail','aria-label':'Sports'},
        sortedSports.map(([sport,data])=>React.createElement('button',{key:sport,className:'ftv-m-sport-chip '+(activeKey===sport?'is-active':''),onClick:()=>onSelect(sport),style:{'--fg':(data.fg||'#0B3F7A'),'--bg':(data.bg||'#eef6ff')}},
            React.createElement('span',{className:'ftv-m-sport-ico'},data.i||'•'),
            React.createElement('span',{className:'ftv-m-sport-text'},sport),
            React.createElement('span',{className:'ftv-m-sport-views'},fmt(data._views||data.views||0))
        ))
    );
}
function MobileBottomNav({mainTab,setMainTab}){
    const items=[['chiffres','📊','Chiffres'],['graphiques','📈','Graph.'],['previsions','🔭','Prévisions'],['copilot','🧠','Copilot'],['analytics','📡','Analytics']];
    return React.createElement('nav',{className:'ftv-m-bottom-nav'},items.map(([id,ico,label])=>React.createElement('button',{key:id,className:mainTab===id?'is-active':'',onClick:()=>setMainTab(id)},React.createElement('span',{className:'ftv-m-nav-ico'},ico),React.createElement('span',{className:'ftv-m-nav-label'},label))));
}
function MobileFilters({tabs,typeFilter,setTypeFilter,dateLabel}){
    const mobileLabels = { all:'Tout', video:'Vidéos', short:'Shorts', live:'Lives' };
    const visibleTabs = tabs.filter(t => ['all','video','short','live'].includes(t.id));
    return React.createElement('section',{className:'ftv-m-filters'},
        React.createElement('div',{className:'ftv-m-filter-title'},'Type de contenu'),
        React.createElement('div',{className:'ftv-m-type-pills'},visibleTabs.map(t=>React.createElement('button',{key:t.id,className:typeFilter===t.id?'is-active':'',onClick:()=>setTypeFilter(t.id)},React.createElement('span',null,mobileLabels[t.id]||t.label),React.createElement('b',null,t.count)))),
        React.createElement('div',{className:'ftv-m-date-dot'},React.createElement('span',null),dateLabel)
    );
}

function ftvInputDate(d){
    if(!d) return '';
    const x = d instanceof Date ? d : new Date(d);
    if(Number.isNaN(x.getTime())) return '';
    const y=x.getFullYear(), m=String(x.getMonth()+1).padStart(2,'0'), day=String(x.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
}
function MobilePeriodControls({dateRange,setDateRange,periodLabel}){
    const [open,setOpen]=useState(false);
    return React.createElement(React.Fragment,null,
        React.createElement('div',{className:'ftv-m-period-row'},
            React.createElement('button',{className:'ftv-m-period-btn',onClick:()=>setOpen(true),'aria-label':'Changer la période'},React.createElement('span',null,'📅'),React.createElement('span',null,periodLabel||'Période')),
            window.ftvAuthCan?.('export') ? React.createElement('button',{className:'ftv-m-export-mini',onClick:()=>alert('Export disponible sur desktop pour cette version mobile.'),'aria-label':'Exporter'},'↓') : null
        ),
        open&&React.createElement(MobileCalendarSheet,{dateRange,setDateRange,onClose:()=>setOpen(false)})
    );
}
function MobileCalendarSheet({dateRange,setDateRange,onClose}){
    const [start,setStart]=useState(()=>ftvInputDate(dateRange?.start));
    const [end,setEnd]=useState(()=>ftvInputDate(dateRange?.end));
    const today=()=>new Date();
    const setAndApply=(a,b)=>{
        setStart(a); setEnd(b);
        const sd=new Date(a+'T00:00:00');
        const ed=new Date(b+'T23:59:59');
        if(!a||!b||sd>ed) return;
        setDateRange({start:sd,end:ed});
        onClose();
    };
    const apply=()=>setAndApply(start,end);
    const presetCurrentYear=()=>{ const now=today(); setAndApply(`${now.getFullYear()}-01-01`, ftvInputDate(now)); };
    const presetFullCurrentYear=()=>{ const now=today(); const y=now.getFullYear(); setAndApply(`${y}-01-01`, `${y}-12-31`); };
    const presetLastDays=(days)=>{ const now=today(); const past=new Date(now); past.setDate(now.getDate()-days); setAndApply(ftvInputDate(past), ftvInputDate(now)); };
    const presetPreviousYear=()=>{ const y=today().getFullYear()-1; setAndApply(`${y}-01-01`, `${y}-12-31`); };
    const presetThisMonth=()=>{ const now=today(); setAndApply(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, ftvInputDate(now)); };
    return React.createElement(React.Fragment,null,
        React.createElement('div',{className:'ftv-m-calendar-backdrop',onClick:onClose}),
        React.createElement('section',{className:'ftv-m-calendar-sheet',role:'dialog','aria-modal':'true','aria-label':'Choisir une période'},
            React.createElement('div',{className:'ftv-m-calendar-head'},
                React.createElement('div',null,
                    React.createElement('div',{className:'ftv-m-calendar-kicker'},'Filtre temporel'),
                    React.createElement('h2',null,'Période')
                ),
                React.createElement('button',{className:'ftv-m-calendar-close',onClick:onClose,'aria-label':'Fermer'},'×')
            ),
            React.createElement('div',{className:'ftv-m-calendar-fields'},
                React.createElement('div',{className:'ftv-m-calendar-field'},React.createElement('label',null,'Début'),React.createElement('input',{type:'date',value:start,onChange:e=>setStart(e.target.value)})),
                React.createElement('div',{className:'ftv-m-calendar-field'},React.createElement('label',null,'Fin'),React.createElement('input',{type:'date',value:end,onChange:e=>setEnd(e.target.value)}))
            ),
            React.createElement('div',{className:'ftv-m-calendar-presets'},
                React.createElement('button',{onClick:presetCurrentYear},'Année en cours'),
                React.createElement('button',{onClick:presetFullCurrentYear},'Année complète'),
                React.createElement('button',{onClick:()=>presetLastDays(30)},'30 derniers jours'),
                React.createElement('button',{onClick:()=>presetLastDays(90)},'90 derniers jours'),
                React.createElement('button',{onClick:presetThisMonth},'Mois en cours'),
                React.createElement('button',{onClick:presetPreviousYear},'Année précédente'),
                React.createElement('button',{onClick:()=>presetLastDays(365)},'12 derniers mois')
            ),
            React.createElement('div',{className:'ftv-m-calendar-actions'},
                React.createElement('button',{className:'ftv-m-calendar-secondary',onClick:onClose},'Annuler'),
                React.createElement('button',{className:'ftv-m-calendar-apply',onClick:apply},'Appliquer')
            )
        )
    );
}

function MobileVideoCard({v,onReclassify}){
    const url=getVideoUrl(v);
    const body=React.createElement(React.Fragment,null,
        React.createElement('div',{className:'ftv-m-video-title'},v.title||'Sans titre'),
        React.createElement('div',{className:'ftv-m-video-meta'},mobileTypeLabel(v.type),' · ',fmtDate(getVidDate(v)),' · ',fmtFull(v.views||0),' vues')
    );
    return React.createElement('div',{className:'ftv-m-video-card'},
        React.createElement(url?'a':'div',{href:url||undefined,target:url?'_blank':undefined,rel:url?'noopener noreferrer':undefined,className:'ftv-m-video-link'},body),
        onReclassify?React.createElement('button',{className:'ftv-m-video-fix',onClick:e=>{e.preventDefault();e.stopPropagation();onReclassify(v);}},'Classer'):null
    );
}
function MobileDetailPanel({sport,data,totalViews,typeFilter,onReclassify}){
    const filteredComps=useMemo(()=>Object.entries((data&&data.comps)||{}).map(([name,cd])=>{
        const vids=typeFilter==='all'?(cd.videos||[]):(cd.videos||[]).filter(v=>v.type===typeFilter);
        if(!vids.length) return null;
        return [name,{videos:vids,views:vids.reduce((s,v)=>s+(Number(v.views)||0),0)}];
    }).filter(Boolean).sort((a,b)=>b[1].views-a[1].views),[data,typeFilter]);
    const [open,setOpen]=useState(null);
    useEffect(()=>{ setOpen(null); },[sport,typeFilter]);
    const allVids=filteredComps.flatMap(([,cd])=>cd.videos);
    const totalV=allVids.reduce((s,v)=>s+(Number(v.views)||0),0);
    const nV=allVids.filter(v=>v.type==='video').length, nS=allVids.filter(v=>v.type==='short').length, nL=allVids.filter(v=>v.type==='live').length;
    return React.createElement('section',{className:'ftv-m-detail'},
        React.createElement('div',{className:'ftv-m-detail-head'},
            React.createElement('div',{className:'ftv-m-detail-ico',style:{background:data.bg,color:data.fg}},data.i),
            React.createElement('div',{className:'ftv-m-detail-titlebox'},React.createElement('h1',null,sport),React.createElement('p',null,filteredComps.length,' compétitions · ',allVids.length,' contenus'))
        ),
        React.createElement('div',{className:'ftv-m-detail-stats'},
            React.createElement(MobileStat,{label:'Vues',value:totalV,accent:data.fg}),
            React.createElement(MobileStat,{label:'Moy./vidéo',value:fmtFull(Math.round(totalV/Math.max(1,allVids.length))),accent:data.fg}),
            React.createElement(MobileStat,{label:'Part totale',value:((totalV/Math.max(1,totalViews))*100).toFixed(1)+'%',accent:data.fg})
        ),
        React.createElement('div',{className:'ftv-m-content-chips'},
            nV>0&&React.createElement('span',{className:'video'},nV,' vidéos'),
            nS>0&&React.createElement('span',{className:'short'},nS,' shorts'),
            nL>0&&React.createElement('span',{className:'live'},nL,' lives')
        ),
        React.createElement('div',{className:'ftv-m-comp-list'}, filteredComps.map(([name,cd])=>{
            const isOpen=open===name;
            const vidCount=cd.videos.length;
            const shortCount=cd.videos.filter(v=>v.type==='short').length;
            return React.createElement('article',{key:name,className:'ftv-m-comp-card '+(isOpen?'is-open':'')},
                React.createElement('button',{className:'ftv-m-comp-main',onClick:()=>setOpen(isOpen?null:name)},
                    React.createElement('div',{className:'ftv-m-comp-titlebox'},React.createElement('h2',null,name),React.createElement('p',null,vidCount,' contenu',vidCount>1?'s':'',shortCount?` · ${shortCount} shorts`:'')),
                    React.createElement('div',{className:'ftv-m-comp-right'},React.createElement('strong',null,fmtFull(cd.views)),React.createElement('span',null,'vues'),React.createElement('i',null,isOpen?'⌃':'⌄'))
                ),
                isOpen&&React.createElement('div',{className:'ftv-m-videos-list'},cd.videos.slice(0,60).map(v=>React.createElement(MobileVideoCard,{key:v.id||v.title,v,onReclassify})))
            );
        }))
    );
}

function MobileSportsAccordionScreen({sportsData,totalViews,typeFilter,onReclassify,initialSport}){
    const rows=useMemo(()=>Object.entries(sportsData||{}).map(([sport,data])=>{
        const comps=Object.entries((data&&data.comps)||{}).map(([name,cd])=>{
            const vidsRaw=cd.videos||[];
            const vids=typeFilter==='all'?vidsRaw:vidsRaw.filter(v=>v.type===typeFilter);
            if(!vids.length) return null;
            return [name,{videos:vids,views:vids.reduce((s,v)=>s+(Number(v.views)||0),0)}];
        }).filter(Boolean).sort((a,b)=>b[1].views-a[1].views);
        const allVids=comps.flatMap(([,cd])=>cd.videos);
        const views=allVids.reduce((sum,v)=>sum+(Number(v.views)||0),0);
        return {sport,data,comps,allVids,views};
    }).filter(r=>r.allVids.length).sort((a,b)=>b.views-a.views),[sportsData,typeFilter]);
    const [openSport,setOpenSport]=useState(null);
    const [openComp,setOpenComp]=useState(null);
    useEffect(()=>{ if(openSport && rows.length && !rows.some(r=>r.sport===openSport)) setOpenSport(null); },[rows,openSport]);
    return React.createElement('section',{className:'ftv-m-sports-accordion'}, rows.map(row=>{
        const {sport,data,comps,allVids,views}=row;
        const isOpen=openSport===sport;
        const nV=allVids.filter(v=>v.type==='video').length, nS=allVids.filter(v=>v.type==='short').length, nL=allVids.filter(v=>v.type==='live').length;
        return React.createElement('article',{key:sport,className:'ftv-m-sport-acc '+(isOpen?'is-open':'')},
            React.createElement('button',{className:'ftv-m-sport-acc-head',onClick:()=>{ setOpenSport(isOpen?null:sport); setOpenComp(null); },style:{'--fg':data.fg||'#0B3F7A','--bg':data.bg||'#eef6ff'}},
                React.createElement('span',{className:'ftv-m-sport-acc-ico',style:{background:data.bg||'var(--bg3)',color:data.fg||'var(--text)'}},data.i||'•'),
                React.createElement('div',{className:'ftv-m-sport-acc-title'},React.createElement('h2',null,sport),React.createElement('p',null,comps.length,' compétitions · ',allVids.length,' contenus')),
                React.createElement('div',{className:'ftv-m-sport-acc-views'},React.createElement('strong',null,fmt(views)),React.createElement('span',null,'vues')),
                React.createElement('span',{className:'ftv-m-sport-acc-chevron'},isOpen?'⌃':'⌄')
            ),
            isOpen&&React.createElement('div',{className:'ftv-m-sport-acc-body'},
                React.createElement('div',{className:'ftv-m-sport-acc-stats'},
                    React.createElement(MobileStat,{label:'Moy./vidéo',value:fmtFull(Math.round(views/Math.max(1,allVids.length))),accent:data.fg}),
                    React.createElement(MobileStat,{label:'Part',value:((views/Math.max(1,totalViews))*100).toFixed(1)+'%',accent:data.fg}),
                    React.createElement(MobileStat,{label:'Compét.',value:comps.length,accent:data.fg})
                ),
                React.createElement('div',{className:'ftv-m-sport-acc-tags'},
                    nV>0&&React.createElement('span',{className:'video'},nV,' vidéos'),
                    nS>0&&React.createElement('span',{className:'short'},nS,' shorts'),
                    nL>0&&React.createElement('span',{className:'live'},nL,' lives')
                ),
                React.createElement('div',{className:'ftv-m-comp-list'}, comps.map(([name,cd])=>{
                    const key=sport+'::'+name;
                    const isCompOpen=openComp===key;
                    const shortCount=cd.videos.filter(v=>v.type==='short').length;
                    return React.createElement('article',{key:name,className:'ftv-m-comp-card '+(isCompOpen?'is-open':'')},
                        React.createElement('button',{className:'ftv-m-comp-main',onClick:()=>setOpenComp(isCompOpen?null:key)},
                            React.createElement('div',{className:'ftv-m-comp-titlebox'},React.createElement('h2',null,name),React.createElement('p',null,cd.videos.length,' contenu',cd.videos.length>1?'s':'',shortCount?` · ${shortCount} shorts`:'')),
                            React.createElement('div',{className:'ftv-m-comp-right'},React.createElement('strong',null,fmtFull(cd.views)),React.createElement('span',null,'vues'),React.createElement('i',null,isCompOpen?'⌃':'⌄'))
                        ),
                        isCompOpen&&React.createElement('div',{className:'ftv-m-videos-list'},cd.videos.slice(0,60).map(v=>React.createElement(MobileVideoCard,{key:v.id||v.title,v,onReclassify})))
                    );
                }))
            )
        );
    }));
}

function MobileChartsScreen({sportsData,totalViews,typeFilter,onSelect}){
    const rows=useMemo(()=>Object.entries(sportsData||{}).map(([name,d])=>{
        const comps=Object.entries((d&&d.comps)||{}).map(([comp,cd])=>{
            const vidsRaw=cd.videos||[];
            const vids=typeFilter==='all'?vidsRaw:vidsRaw.filter(v=>v.type===typeFilter);
            if(!vids.length) return null;
            return {comp,videos:vids,views:vids.reduce((sum,v)=>sum+(Number(v.views)||0),0)};
        }).filter(Boolean).sort((a,b)=>b.views-a.views);
        const views=comps.reduce((sum,c)=>sum+c.views,0);
        return {name,...d,views,comps};
    }).filter(r=>r.views>0).sort((a,b)=>b.views-a.views).slice(0,30),[sportsData,typeFilter]);
    const [open,setOpen]=useState(null);
    useEffect(()=>{ if(open && !rows.some(r=>r.name===open)) setOpen(null); },[rows,open]);
    return React.createElement('section',{className:'ftv-m-screen ftv-m-charts-screen'},
        React.createElement('div',{className:'ftv-m-screen-head'},React.createElement('h1',null,'Graphiques'),React.createElement('p',null,'Parts par sport et par compétition')),
        React.createElement('div',{className:'ftv-m-chart-list'},rows.map(r=>{
            const isOpen=open===r.name;
            const sportPct=((r.views/Math.max(1,totalViews))*100);
            return React.createElement('article',{key:r.name,className:'ftv-m-chart-card ftv-m-chart-accordion '+(isOpen?'is-open':''),style:{'--fg':r.fg||'#0B3F7A','--bg':r.bg||'#eef6ff'}},
                React.createElement('button',{className:'ftv-m-chart-head',onClick:()=>setOpen(isOpen?null:r.name)},
                    React.createElement('div',{className:'ftv-m-chart-top'},
                        React.createElement('span',{className:'ftv-m-chart-ico'},r.i),
                        React.createElement('div',null,React.createElement('h2',null,r.name),React.createElement('p',null,r.comps.length,' compétitions · ',fmt(r.views),' vues')),
                        React.createElement('strong',null,sportPct.toFixed(1),'%')
                    ),
                    React.createElement('div',{className:'ftv-m-chart-bar'},React.createElement('span',{style:{width:Math.min(100,sportPct)+'%'}})),
                    React.createElement('span',{className:'ftv-m-chart-chevron'},isOpen?'⌃':'⌄')
                ),
                isOpen&&React.createElement('div',{className:'ftv-m-chart-comps'},
                    r.comps.slice(0,24).map(c=>React.createElement('button',{key:c.comp,className:'ftv-m-chart-comp-row',onClick:()=>onSelect&&onSelect(r.name)},
                        React.createElement('div',{className:'ftv-m-chart-comp-main'},
                            React.createElement('span',{className:'ftv-m-chart-comp-title'},c.comp),
                            React.createElement('span',{className:'ftv-m-chart-comp-sub'},c.videos.length,' contenus')
                        ),
                        React.createElement('div',{className:'ftv-m-chart-comp-metric'},
                            React.createElement('strong',null,fmtFull(c.views)),
                            React.createElement('span',null,((c.views/Math.max(1,r.views))*100).toFixed(1),'% du sport')
                        ),
                        React.createElement('div',{className:'ftv-m-chart-comp-bar'},React.createElement('i',{style:{width:Math.min(100,(c.views/Math.max(1,r.views))*100)+'%'}}))
                    ))
                )
            );
        }))
    );
}
function MobilePrevisionsScreen({sportsData,allVideos,anthropicKey,dateRange,channelKey,analyticsBundle}){
    const rows=useMemo(()=>buildPrevisionRows(sportsData).slice(0,24),[sportsData]);
    const [expanded,setExpanded]=useState(null);
    const [analyses,setAnalyses]=useState({});
    const runClaude=async(row)=>{
        const key=row.sport+'::'+row.comp;
        const hist=buildHistoricalStatsFor(row,allVideos||[]);
        const refYear=dateRange?.start?dateRange.start.getFullYear():new Date().getFullYear();
        const diag=quickDiagnostic(row,hist,refYear,refYear+1);
        setAnalyses(prev=>({...prev,[key]:{status:'loading'}}));
        try{
            let out;
            try{ out=await callAnthropicStrategic(buildStrategicPrompt(row,hist,diag,channelKey,dateRange,analyticsBundle),anthropicKey,{withWeb:true}); }
            catch(e){ out=await callAnthropicStrategic(buildStrategicPrompt(row,hist,diag,channelKey,dateRange,analyticsBundle),anthropicKey,{withWeb:false}); out.text='⚠️ Recherche web Claude non disponible ou désactivée. Analyse basée sur les données internes du dashboard.\n\n'+out.text; }
            const delta=parseDeltaEstimate(out.text)||buildFallbackDeltaEstimate(diag);
            setAnalyses(prev=>({...prev,[key]:{status:'done',text:stripDeltaLine(out.text),sources:out.sources||[],delta}}));
            setExpanded(key);
        }catch(err){
            setAnalyses(prev=>({...prev,[key]:{status:'error',text:err?.message||String(err)}}));
            setExpanded(key);
        }
    };
    return React.createElement('section',{className:'ftv-m-screen ftv-m-previsions-mobile'},
        React.createElement('div',{className:'ftv-m-screen-head'},React.createElement('h1',null,'Prévisions'),React.createElement('p',null,'Analyse Claude par compétition')),
        React.createElement('div',{className:'ftv-m-forecast-list'},rows.map(row=>{
            const key=row.sport+'::'+row.comp;
            const isOpen=expanded===key;
            const item=analyses[key];
            const hist=isOpen?buildHistoricalStatsFor(row,allVideos||[]):[];
            const diag=isOpen?quickDiagnostic(row,hist,dateRange?.start?dateRange.start.getFullYear():new Date().getFullYear(),(dateRange?.start?dateRange.start.getFullYear():new Date().getFullYear())+1):null;
            return React.createElement('article',{key:key,className:'ftv-m-forecast-card ftv-m-forecast-claude '+(isOpen?'is-open':'')},
                React.createElement('button',{className:'ftv-m-forecast-head',onClick:()=>setExpanded(isOpen?null:key)},
                    React.createElement('div',{className:'ftv-m-forecast-ico',style:{background:row.bg,color:row.fg}},row.i),
                    React.createElement('div',{className:'ftv-m-forecast-main'},React.createElement('h2',null,row.comp),React.createElement('p',null,row.sport,' · ',row.count,' contenus'),React.createElement('div',{className:'ftv-m-forecast-tags'},React.createElement('span',null,'Médiane ',fmtFull(row.median||0)),React.createElement('span',null,'Moy. ',fmtFull(row.mean||0)))) ,
                    React.createElement('div',{className:'ftv-m-forecast-total'},React.createElement('strong',null,fmtFull(row.views)),React.createElement('span',null,'vues'),React.createElement('i',null,isOpen?'⌃':'⌄'))
                ),
                isOpen&&React.createElement('div',{className:'ftv-m-forecast-body'},
                    React.createElement('div',{className:'ftv-m-forecast-mini-grid'},
                        React.createElement(StatPill,{label:'Base interne',value:`${row.count} contenus · ${fmtFull(row.views)} vues`}),
                        React.createElement(StatPill,{label:'Mix formats',value:`${row.nV} vidéos · ${row.nS} shorts · ${row.nL} lives`,color:'#7A3800',bg:'#FFF7ED'}),
                        React.createElement(StatPill,{label:'Diagnostic',value:diag?`${diag.label} · ${diag.confidence}`:'—',color:'#4A0E8F',bg:'#F0E8FF'})
                    ),
                    React.createElement('button',{className:'ftv-m-claude-btn',onClick:()=>runClaude(row),disabled:item?.status==='loading'},
                        item?.status==='loading'?'Analyse Claude en cours…':item?.status==='done'?'Relancer Claude':'Analyser avec Claude'
                    ),
                    item?.delta&&React.createElement('div',{className:'ftv-m-delta-wrap'},React.createElement(DeltaEstimateChip,{delta:item.delta})),
                    item?React.createElement('div',{className:'ftv-m-claude-result'},React.createElement(StrategicAnalysisBlock,{item})):React.createElement('p',{className:'ftv-m-claude-empty'},'Ouvre l’analyse Claude pour générer une note stratégique : scénarios bas / central / haut, risques, opportunités et recommandations éditoriales.')
                )
            );
        }))
    );
}
function MobileGenericWrappedScreen({title,subtitle,children}){
    return React.createElement('section',{className:'ftv-m-screen ftv-m-wrapped'},React.createElement('div',{className:'ftv-m-screen-head'},React.createElement('h1',null,title),React.createElement('p',null,subtitle)),React.createElement('div',{className:'ftv-m-wrap-content'},children));
}
function MobileDashboardApp(props){
    const [drawerOpen,setDrawerOpen]=useState(false);
    const {activeChannel,channelKey,handleChannelChange,searchInput,setSearchInput,sortedSports,activeKey,setActiveSport,setMainTab,mainTab,totalViews,filteredVideos,nV,nS,nL,tabs,typeFilter,setTypeFilter,periodLabel,activeData,analyticsBundle,analyticsStatus,connectYouTubeAnalytics,loadYouTubeAnalyticsData,analyticsClientId,setAnalyticsClientId,analyticsAccessToken,sportsData,anthropicKey,allVideos,dateRange,setDateRange,onReclassify}=props;
    const content = mainTab==='graphiques'
        ? React.createElement(MobileChartsScreen,{sportsData,totalViews,typeFilter,onSelect:s=>{setActiveSport(s);setMainTab('chiffres');}})
        : mainTab==='previsions'
        ? React.createElement(MobilePrevisionsScreen,{sportsData,allVideos,anthropicKey,dateRange,channelKey,analyticsBundle})
        : mainTab==='copilot'
        ? React.createElement(MobileGenericWrappedScreen,{title:'Copilot IA',subtitle:'Opportunités, risques et potentiel média'},React.createElement(PredictiveCopilotView,{allVideos:allVideos,currentVideos:filteredVideos,sportsData,totalViews,channelKey,dateRange,analyticsBundle}))
        : mainTab==='analytics'
        ? React.createElement(MobileGenericWrappedScreen,{title:'Analytics',subtitle:'Données YouTube Analytics et signaux avancés'},React.createElement(AnalyticsView,{allVideos:filteredVideos,analyticsBundle,analyticsStatus,onConnect:connectYouTubeAnalytics,onLoad:loadYouTubeAnalyticsData,analyticsClientId,setAnalyticsClientId,analyticsAccessToken,channelKey,managedAnalyticsChannels,analyticsChannelMap,onAnalyticsChannelMapChange,onRefreshAnalyticsChannels:refreshManagedAnalyticsChannels,analyticsHealth}))
        : React.createElement(MobileSportsAccordionScreen,{sportsData,totalViews,typeFilter,onReclassify,initialSport:activeKey});
    return React.createElement('div',{className:'ftv-mobile-app'},
        React.createElement(MobileTopBar,{searchInput,setSearchInput,onMenu:()=>setDrawerOpen(true),activeChannel}),
        React.createElement('main',{className:'ftv-m-body'},
            React.createElement('section',{className:'ftv-m-kpis'},
                React.createElement(MobileStat,{label:'Vues totales',value:totalViews,sub:`${filteredVideos.length} contenus`,accent:'var(--red)'}),
                React.createElement(MobileStat,{label:'Vidéos',value:nV,accent:'var(--blue)'}),
                React.createElement(MobileStat,{label:'Shorts',value:nS,accent:'#8A4600'}),
                React.createElement(MobileStat,{label:'Lives',value:nL,accent:'#166534'})
            ),
            React.createElement(MobilePeriodControls,{dateRange,setDateRange,periodLabel}),
            React.createElement(MobileFilters,{tabs,typeFilter,setTypeFilter,dateLabel:periodLabel}),
            content
        ),
        React.createElement(MobileBottomNav,{mainTab,setMainTab}),
        React.createElement(MobileDrawer,{open:drawerOpen,onClose:()=>setDrawerOpen(false),channelKey,onChannelChange:handleChannelChange,activeChannel})
    );
}


function ftvV98AllowedChannels(profile){
    const list = Array.isArray(profile?.allowed_channels) ? profile.allowed_channels.filter(Boolean) : [];
    return list.length ? list : Object.keys(CHANNEL_CONFIGS || {});
}
function ftvV98Log(event_type, channel, meta){
    try{ fetch('/api/activity-log',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({event_type,channel,meta:meta||{}})}).catch(()=>{}); }catch(e){}
}
function ftvV98BuildBrief({channelName, periodLabel, sportsData, totalViews, filteredCount}){
    const rows = Object.entries(sportsData||{}).sort((a,b)=>(b[1]?.views||0)-(a[1]?.views||0));
    const leader = rows[0]; const second = rows[1];
    const dep = leader && totalViews ? Math.round((leader[1].views/totalViews)*100) : 0;
    return [
        `Brief automatique — ${channelName}`,
        `Période : ${periodLabel}. ${window.fmtFull(totalViews||0)} vues sur ${filteredCount||0} contenus.`,
        leader ? `Moteur principal : ${leader[0]} (${dep}% des vues).` : 'Aucun moteur principal détecté.',
        second ? `Relais à surveiller : ${second[0]} avec ${window.fmtFull(second[1].views||0)} vues.` : '',
        dep > 55 ? 'Point d’attention : forte dépendance à un seul événement ou territoire éditorial.' : 'Lecture : répartition d’audience relativement équilibrée.',
        'Action recommandée : isoler les contenus qui tirent la moyenne et comparer avec la même période de l’année précédente.'
    ].filter(Boolean).join('\n');
}
function BriefAutoView({channelName, periodLabel, sportsData, totalViews, filteredCount}){
    const brief = React.useMemo(()=>ftvV98BuildBrief({channelName, periodLabel, sportsData, totalViews, filteredCount}),[channelName,periodLabel,sportsData,totalViews,filteredCount]);
    const [copied,setCopied]=React.useState(false);
    return React.createElement('div',{className:'ftv-v98-panel'},
        React.createElement('div',{style:{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start'}},
            React.createElement('div',null,React.createElement('h3',{className:'ftv-v98-title'},'Brief automatique'),React.createElement('div',{className:'ftv-v98-muted'},'Synthèse courte exploitable en mail, point interne ou slide.')),
            React.createElement('button',{className:'ftv-v98-btn primary',onClick:async()=>{try{await navigator.clipboard.writeText(brief);setCopied(true);setTimeout(()=>setCopied(false),1300);}catch(e){}}},copied?'Copié':'Copier')
        ),
        React.createElement('pre',{style:{whiteSpace:'pre-wrap',fontFamily:'var(--font)',fontSize:13,lineHeight:1.55,color:'var(--text2)',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:16,padding:14,margin:'14px 0 0'}},brief)
    );
}

function App() {
    const storedChannel = localStorage.getItem('ftv_active_channel');
    const initialChannelKey = CHANNEL_CONFIGS[storedChannel] ? storedChannel : DEFAULT_CHANNEL_KEY;
    const initialCache = loadCache(initialChannelKey);
    // Re-classifier les mocks avec les règles courantes (utile en dev, et garantit
    // que les données démo restent cohérentes si on fait évoluer classifyType).
    const reclassifiedMocks = useMemo(() => MOCK_VIDEOS.map(v => {
        if (v.type === 'live')
            return { ...v, channelKey: 'sport' };
        const dur = getDurationSecs(v.duration);
        return { ...v, channelKey: 'sport', type: window.classifyType(v.title, dur, false) };
    }), []);
    const initVideos = prepareVideosForDashboard(initialCache ? initialCache.videos : (initialChannelKey === 'sport' ? reclassifiedMocks : []));
    const initIsDemo = !initialCache && initialChannelKey === 'sport';
    const initCacheTs = initialCache?.ts || null;
    // Mémoire de session paresseuse : on charge uniquement le dashboard actif.
    // Important : ne pas parser le cache FRANCE TV au démarrage quand on est sur SPORT,
    // sinon les anciens gros caches peuvent ralentir ou faire planter l'affichage.
    const channelMemoryRef = useRef(null);
    if (!channelMemoryRef.current) {
        const memory = {};
        memory[initialChannelKey] = { videos: initVideos, isDemo: initIsDemo, cacheTs: initCacheTs };
        channelMemoryRef.current = memory;
    }
    const [channelKey, setChannelKey] = useState(initialChannelKey);
    const activeChannel = getChannelConfig(channelKey);
    const taxonomyMode = (window.isGeneralChannel && window.isGeneralChannel(channelKey)) ? 'general' : 'sport';
    const [allVideos, setAllVideos] = useState(initVideos);
    const [isDemo, setIsDemo] = useState(initIsDemo);
    const [cacheTs, setCacheTs] = useState(initCacheTs);
    const [apiKey, setApiKey] = useState(() => 'server-managed');
    const [anthropicKey, setAnthropicKey] = useState(() => 'server-managed');
    const [analyticsClientId, setAnalyticsClientId] = useState(() => 'server-managed');
    const [analyticsAccessToken, setAnalyticsAccessToken] = useState('server-managed');
    const [analyticsBundle, setAnalyticsBundle] = useState(null);
    const [analyticsStatus, setAnalyticsStatus] = useState({ type: 'ok', message: 'Analytics géré côté admin. Le client n’a aucune clé à renseigner.' });
    const [managedAnalyticsChannels, setManagedAnalyticsChannels] = useState([]);
    const [analyticsHealth, setAnalyticsHealth] = useState(null);
    const [analyticsChannelMap, setAnalyticsChannelMap] = useState(() => readAnalyticsChannelMap());
    const onAnalyticsChannelMapChange = useCallback((key, channel) => { setAnalyticsChannelMap(prev => { const next={...(prev||{})}; if(channel?.id) next[key]=channel; else delete next[key]; saveAnalyticsChannelMap(next); return next; }); setAnalyticsBundle(null); }, []);
    const refreshManagedAnalyticsChannels = useCallback(async () => { try { setAnalyticsStatus({ type:'warn', message:'Diagnostic Analytics et liste des chaînes Content Manager…' }); const [health, channels] = await Promise.all([fetchAnalyticsHealth().catch(e=>({ ok:false, tokenOk:false, tokenError:{error:e.message}, managedChannelsCount:0 })), fetchManagedAnalyticsChannels().catch(()=>[])]); setAnalyticsHealth(health); setManagedAnalyticsChannels(channels || health.managedChannels || []); setAnalyticsStatus({ type: health.tokenOk === false ? 'error' : 'ok', message: health.tokenOk === false ? `Token YouTube KO : ${health.tokenError?.error || health.tokenError?.message || 'erreur inconnue'}` : `Analytics prêt : ${channels.length || health.managedChannelsCount || 0} chaînes Content Manager détectées.` }); } catch(e) { setAnalyticsStatus({ type:'error', message:e.message || String(e) }); } }, []);
    useEffect(() => { refreshManagedAnalyticsChannels(); }, []);
    // IMPORTANT : dateRange doit être initialisé avant les callbacks Analytics.
    // Sinon React évalue la dependency array de useCallback alors que dateRange est encore en TDZ,
    // ce qui provoque une page blanche dès le rendu initial.
    const [dateRange, setDateRange] = useState(() => getCurrentYtdRange());
    const [showAnthropicInput, setShowAnthropicInput] = useState(false);
    const [showApiInput, setShowApiInput] = useState(false);
    useEffect(() => {
        saveSharedApiKey(apiKey);
    }, [apiKey]);
    useEffect(() => {
        const v = String(anthropicKey || '').trim();
        if (v)
            saveSharedAnthropicKey(v);
    }, [anthropicKey]);
    useEffect(() => {
        const v = String(analyticsClientId || '').trim();
        if (v) saveSharedAnalyticsClientId(v);
    }, [analyticsClientId]);
    // Source Analytics active : toujours alignée sur ce que l'utilisateur voit
    // dans le dashboard (période, mode présentation, recherche).
    // On utilise une ref pour éviter les erreurs de hooks/TDZ, car le callback
    // de chargement Analytics est déclaré avant filteredVideos.
    const analyticsSourceVideosRef = useRef([]);
    const connectYouTubeAnalytics = useCallback(() => {
        const clientId = String(analyticsClientId || '').trim();
        if (!clientId) { setAnalyticsStatus({ type: 'error', message: 'Ajoute ton OAuth Client ID YouTube Analytics.' }); setMainTab('analytics'); return; }
        if (!window.google?.accounts?.oauth2) { setAnalyticsStatus({ type: 'error', message: 'Google Identity Services pas encore chargé. Recharge la page puis réessaie.' }); return; }
        saveSharedAnalyticsClientId(clientId);
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: YT_ANALYTICS_SCOPE,
            callback: (response) => {
                if (response.error) { setAnalyticsStatus({ type: 'error', message: `OAuth Analytics: ${response.error}` }); return; }
                setAnalyticsAccessToken(response.access_token || '');
                setAnalyticsStatus({ type: 'ok', message: 'Connexion YouTube Analytics active. Tu peux charger les métriques.' });
            }
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }, [analyticsClientId]);
    const loadYouTubeAnalyticsData = useCallback(async () => {
        try {
            setAnalyticsStatus({ type: 'warn', message: 'Lecture Analytics depuis la console admin…' });
            const fetchStored = async (scope) => {
                const r = await fetch(`/api/analytics-store?channel=${encodeURIComponent(channelKey)}&scope=${encodeURIComponent(scope)}&_live=${Date.now()}`, { cache:'no-store', headers:{'Cache-Control':'no-store'} });
                const j = await r.json().catch(()=>({}));
                if (!r.ok || j.error) throw new Error(j.error || `Analytics ${scope} indisponible`);
                return j.payload || j;
            };
            const [daily, traffic, devices, countries] = await Promise.all([
                fetchStored('ytd'), fetchStored('traffic').catch(()=>null), fetchStored('devices').catch(()=>null), fetchStored('countries').catch(()=>null)
            ]);
            const rows = Array.isArray(daily.rows) ? daily.rows : [];
            const views = rows.reduce((s,r)=>s+Number(r[1]||0),0);
            const watch = rows.reduce((s,r)=>s+Number(r[2]||0),0);
            const avg = rows.length ? Math.round(rows.reduce((s,r)=>s+Number(r[3]||0),0)/rows.length) : 0;
            const bundle = {
                channelKey,
                startDate: daily.ftvMeta?.request?.startDate || '',
                endDate: daily.ftvMeta?.request?.endDate || '',
                loadedAt: Date.now(),
                videos: allVideos,
                byVideo: {},
                summary: { views, watch, averageViewDuration: avg, publicViews: allVideos.reduce((s,v)=>s+Number(v.views||0),0), sourceVideos: allVideos.length, matchedAnalyticsVideos: 0 },
                diagnostics: { scopeLabel:'données stockées admin', requestMeta: daily.ftvMeta || null, source:'admin-store-v112', errors:[] },
                daily, traffic, devices, countries,
                errors: []
            };
            setAnalyticsBundle(bundle);
            setAnalyticsStatus({ type: 'ok', message: `Analytics admin chargé : ${fmtFull(views)} vues Analytics · ${fmtFull(Math.round(watch))} min watch time.` });
        } catch(e) {
            setAnalyticsStatus({ type: 'error', message: e.message || String(e) });
        }
    }, [allVideos, channelKey]);
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [error, setError] = useState('');
    // Pré-chauffage non bloquant : on construit progressivement le cache de
    // classification/recherche pendant les temps morts du navigateur. Ainsi,
    // quand l'utilisateur clique ou tape une recherche, le gros calcul est déjà fait.
    useEffect(() => {
        let cancelled = false;
        let i = 0;
        let handle = null;
        const arr = allVideos || [];
        const schedule = (cb) => {
            if (window.requestIdleCallback)
                return window.requestIdleCallback(cb, { timeout: 700 });
            return window.setTimeout(() => cb({ timeRemaining: () => 5 }), 0);
        };
        const cancel = (h) => {
            if (h == null)
                return;
            if (window.cancelIdleCallback)
                window.cancelIdleCallback(h);
            else
                window.clearTimeout(h);
        };
        const work = (deadline) => {
            const start = performance.now();
            while (!cancelled && i < arr.length && ((deadline.timeRemaining && deadline.timeRemaining() > 2) || performance.now() - start < 8)) {
                hydrateVideoDerivedFields(arr[i++]);
            }
            if (!cancelled && i < arr.length)
                handle = schedule(work);
        };
        handle = schedule(work);
        return () => { cancelled = true; cancel(handle); };
    }, [allVideos]);
    // Period
    // Plages additionnelles pour sélections multiples discontinues
    // (Cmd/Ctrl-clic dans le calendrier en mode Année/Mois/Semaine ajoute ici).
    // Chaque entrée est {start, end} au même format que dateRange.
    const [extraRanges, setExtraRanges] = useState([]);
    const [showCal, setShowCal] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setSearchQuery(searchInput.trim()), 220);
        return () => clearTimeout(t);
    }, [searchInput]);
    const deferredSearchQuery = React.useDeferredValue ? React.useDeferredValue(searchQuery) : searchQuery;
    // Filtered videos by date — accepte la plage principale OU n'importe laquelle
    // des plages additionnelles. Une vidéo est gardée si elle tombe dans au moins une.
    const dateFilteredVideos = useMemo(() => {
        const allRanges = [dateRange, ...extraRanges].filter(r => r && r.start && r.end);
        if (!allRanges.length)
            return allVideos;
        // Précalcul des bornes pour éviter les recreations.
        const bounds = allRanges.map(r => {
            const s = r.start;
            const e = new Date(r.end.getFullYear(), r.end.getMonth(), r.end.getDate(), 23, 59, 59);
            return { s, e };
        });
        return allVideos.filter(v => {
            const d = getVidDate(v);
            return bounds.some(({ s, e }) => d >= s && d <= e);
        });
    }, [allVideos, dateRange, extraRanges]);
    // Mode présentation client — déclaré avant les filtres pour éviter toute erreur runtime après authentification.
    const [presentationMode, setPresentationMode] = useState(() => localStorage.getItem('ftv_presentation_mode') === '1');
    useEffect(() => { document.documentElement.classList.toggle('ftv-presentation-mode', presentationMode); localStorage.setItem('ftv_presentation_mode', presentationMode ? '1' : '0'); }, [presentationMode]);
    const [presentationScopeKeys, setPresentationScopeKeys] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem(`ftv_presentation_scope_${initialChannelKey}`) || '[]')); }
        catch(e) { return new Set(); }
    });
    useEffect(() => {
        try { setPresentationScopeKeys(new Set(JSON.parse(localStorage.getItem(`ftv_presentation_scope_${channelKey}`) || '[]'))); }
        catch(e) { setPresentationScopeKeys(new Set()); }
    }, [channelKey]);
    const presentationScopeArray = useMemo(() => Array.from(presentationScopeKeys), [presentationScopeKeys]);
    useEffect(() => {
        try { localStorage.setItem(`ftv_presentation_scope_${channelKey}`, JSON.stringify(presentationScopeArray)); } catch(e) {}
    }, [channelKey, presentationScopeArray.join('|')]);
    const presentationScopeActive = presentationMode && presentationScopeArray.length > 0;
    const presentationDateFilteredVideos = useMemo(() => {
        if (!presentationMode || !presentationScopeArray.length) return dateFilteredVideos;
        return dateFilteredVideos.filter(v => presentationScopeArray.includes(window.ftvPresentationEventKey(v)));
    }, [dateFilteredVideos, presentationMode, presentationScopeArray.join('|')]);
    const presentationSearchBaseVideos = useMemo(() => {
        if (!presentationMode || !presentationScopeArray.length) return allVideos;
        return allVideos.filter(v => presentationScopeArray.includes(window.ftvPresentationEventKey(v)));
    }, [allVideos, presentationMode, presentationScopeArray.join('|')]);
    // Recherche globale : elle ne doit pas être bloquée par l'année affichée.
    // Quand une requête est saisie, on cherche d'abord dans TOUT le cache vidéo.
    // Si le résultat n'est pas dans la période courante, on bascule automatiquement
    // la période sur l'année la plus récente contenant un résultat.
    const globalSearchVideos = useMemo(() => {
        const q = deferredSearchQuery.trim();
        if (!q)
            return [];
        return sortSearchResults(presentationSearchBaseVideos, q);
    }, [presentationSearchBaseVideos, deferredSearchQuery]);
    useEffect(() => {
        const q = deferredSearchQuery.trim();
        if (!q || !globalSearchVideos.length)
            return;
        // On choisit par défaut le résultat le plus récent, puis on ajuste la période
        // uniquement si ce résultat n'est pas déjà couvert par la période courante.
        const sorted = [...globalSearchVideos].sort((a, b) => getVidDate(b) - getVidDate(a));
        const target = sorted[0];
        if (!target)
            return;
        const d = getVidDate(target);
        if (!(d instanceof Date) || Number.isNaN(d.getTime()))
            return;
        const ranges = [dateRange, ...extraRanges].filter(r => r && r.start && r.end);
        const covered = ranges.some(r => {
            const end = new Date(r.end.getFullYear(), r.end.getMonth(), r.end.getDate(), 23, 59, 59);
            return d >= r.start && d <= end;
        });
        if (covered)
            return;
        const y = d.getFullYear();
        setDateRange({ start: new Date(y, 0, 1), end: new Date(y, 11, 31) });
        setExtraRanges([]);
    }, [deferredSearchQuery, globalSearchVideos, dateRange, extraRanges]);
    const filteredVideos = useMemo(() => {
        const q = deferredSearchQuery.trim();
        if (!q)
            return presentationDateFilteredVideos;
        // En mode recherche, on ignore volontairement le filtre année pour ne jamais
        // masquer une vidéo simplement parce que l'utilisateur n'est pas sur la bonne année.
        return globalSearchVideos;
    }, [presentationDateFilteredVideos, deferredSearchQuery, globalSearchVideos]);
    useEffect(() => {
        analyticsSourceVideosRef.current = filteredVideos || [];
    }, [filteredVideos]);
    const searchAutoYearActive = !!(deferredSearchQuery.trim() && globalSearchVideos.length);
    // Reclassification manuelle : la vidéo en cours de reclassement (ou null).
    const [reclassifyVideo, setReclassifyVideo] = useState(null);
    // Nonce qui change à chaque override → force le re-render des composants
    // qui dépendent de classify() (le cache WeakMap est aussi invalidé).
    const [overrideNonce, setOverrideNonce] = useState(0);
    const [presentationEventOptions, setPresentationEventOptions] = useState([]);
    useEffect(() => {
        let cancel = ftvBuildPresentationEventsAsync(dateFilteredVideos, opts => setPresentationEventOptions(opts));
        return () => { if (cancel) cancel(); };
    }, [dateFilteredVideos, overrideNonce]);
    // Le sportsData dépend aussi de overrideNonce : quand l'utilisateur applique
    // une reclassification manuelle, on force la reconstruction des groupes.
    // Construction asynchrone : même précision, mais plus de freeze/crash au changement d'année.
    const [sportsData, setSportsData] = useState({});
    const [classificationProgress, setClassificationProgress] = useState(null);
    useEffect(() => {
        const source = filteredVideos || [];
        setClassificationProgress(source.length ? { done: 0, total: source.length } : null);
        if (!source.length) { setSportsData({}); setClassificationProgress(null); return; }
        let cancelled = false;
        const cancel = ftvBuildSportsAsync(source, data => {
            if (cancelled) return;
            setSportsData(data || {});
            setClassificationProgress(null);
        }, progress => {
            if (!cancelled) setClassificationProgress(progress);
        });
        return () => { cancelled = true; if (cancel) cancel(); };
    }, [filteredVideos, overrideNonce]);
    const [typeFilter, setTypeFilter] = useState('all');
    const [activeSport, setActiveSport] = useState('');
    useEffect(() => {
        // Sport actif par défaut : le plus regardé HORS « Autres sports »,
        // qui ne doit jamais être pré-sélectionné (catégorie « non classés »).
        const ranked = Object.entries(sportsData)
            .filter(([s]) => s !== 'Autres sports')
            .sort((a, b) => b[1].views - a[1].views);
        const first = ranked[0]?.[0] || Object.keys(sportsData)[0] || '';
        setActiveSport(s => sportsData[s] ? s : first);
    }, [sportsData]);
    const [mainTab, setMainTab] = useState('chiffres'); // 'chiffres' | 'graphiques'
    const analyticsAutoLoadKey = useRef('');
    useEffect(() => {
        if (!['analytics','alertes','copilot'].includes(mainTab)) return;
        if (!filteredVideos || !filteredVideos.length) return;
        const start = dateRange?.start instanceof Date ? dateRange.start.toISOString().slice(0,10) : '';
        const end = dateRange?.end instanceof Date ? dateRange.end.toISOString().slice(0,10) : '';
        const key = `${channelKey}|${start}|${end}|${filteredVideos.length}|${analyticsChannelMap?.[channelKey]?.id||''}`;
        if (analyticsBundle?.channelKey === channelKey && analyticsBundle?.startDate === start && analyticsBundle?.endDate === end) return;
        if (analyticsAutoLoadKey.current === key) return;
        analyticsAutoLoadKey.current = key;
        loadYouTubeAnalyticsData();
    }, [mainTab, channelKey, filteredVideos.length, dateRange?.start, dateRange?.end, analyticsBundle?.loadedAt, analyticsChannelMap?.[channelKey]?.id]);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [authProfile, setAuthProfile] = useState(() => window.ftvAuthGetCurrentProfile?.() || null);
    useEffect(() => {
        const refresh = () => setAuthProfile(window.ftvAuthGetCurrentProfile?.() || null);
        refresh();
        window.addEventListener('ftv-auth-change', refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener('ftv-auth-change', refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);
    const profileFullName = useMemo(() => {
        const p = authProfile || {};
        return [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || p.email || 'Utilisateur';
    }, [authProfile]);
    const authRole = (authProfile?.role || 'viewer').toLowerCase();
    const isAdminRole = authRole === 'admin';
    const canEditRole = authRole === 'admin' || authRole === 'editor';
    const roleLabel = authRole === 'admin' ? 'Admin' : authRole === 'editor' ? 'Editor' : 'Viewer';
    const allowedChannelKeys = useMemo(() => ftvV98AllowedChannels(authProfile), [authProfile]);
    const allowedChannelConfigs = useMemo(() => Object.values(CHANNEL_CONFIGS).filter(ch => allowedChannelKeys.includes(ch.key)), [allowedChannelKeys]);
    useEffect(() => {
        if (allowedChannelConfigs.length && !allowedChannelKeys.includes(channelKey)) {
            setChannelKey(allowedChannelConfigs[0].key);
            localStorage.setItem('ftv_active_channel', allowedChannelConfigs[0].key);
        }
    }, [allowedChannelKeys.join('|'), channelKey]);
    useEffect(() => { ftvV98Log('tab_view', channelKey, { tab: mainTab }); }, [mainTab, channelKey]);
    useEffect(() => { window.FTV_ALLOWED_CHANNEL_CONFIGS = allowedChannelConfigs; }, [allowedChannelConfigs]);
    // Export mode + selection
    const [exportMode, setExportMode] = useState(false);
    const [selSports, setSelSports] = useState(new Set());
    const [selComps, setSelComps] = useState(new Set());
    const [selVideos, setSelVideos] = useState(new Set());
    const totalSel = selSports.size + selComps.size + selVideos.size;
    const toggle = (set, setter, key) => setter(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    const clearSelection = () => { setSelSports(new Set()); setSelComps(new Set()); setSelVideos(new Set()); };
    const handleChannelChange = useCallback((nextKey) => {
        if (!CHANNEL_CONFIGS[nextKey] || nextKey === channelKey)
            return;
        if (allowedChannelKeys && allowedChannelKeys.length && !allowedChannelKeys.includes(nextKey)) {
            setError('Accès non autorisé à cette chaîne.');
            return;
        }
        const run = () => {
            const cfg = getChannelConfig(nextKey);
            localStorage.setItem('ftv_active_channel', cfg.key);
            // Sauvegarde instantanée du dashboard courant en mémoire.
            channelMemoryRef.current[channelKey] = { videos: allVideos, isDemo, cacheTs };
            // Clé API partagée : ne disparaît plus quand on change de dashboard.
            const savedKey = readSharedApiKey();
            if (savedKey && savedKey !== apiKey)
                setApiKey(savedKey);
            // v112 : on ne réutilise aucune mémoire/cache d'une ancienne navigation.
            // Le dashboard affiche uniquement la dernière donnée validée par la console admin.
            delete channelMemoryRef.current[cfg.key];
            setChannelKey(cfg.key);
            setAllVideos([]);
            setIsDemo(false);
            setCacheTs(null);
            setError('');
            setShowApiInput(false);
            setSearchInput('');
            setSearchQuery('');
            setExtraRanges([]);
            setTypeFilter('all');
            setAnalyticsBundle(null);
            setAnalyticsStatus({ type: 'ok', message: 'Analytics géré côté admin. Le client n’a aucune clé à renseigner.' });
            clearSelection();
            setDateRange(getCurrentYtdRange());
        };
        if (React.startTransition)
            React.startTransition(run);
        else
            run();
    }, [channelKey, allVideos, isDemo, cacheTs, reclassifiedMocks, apiKey]);
    const filteredSports = useMemo(() => {
        return Object.fromEntries(Object.entries(sportsData).map(([s, d]) => {
            const vids = typeFilter === 'all' ? null : Object.values(d.comps).flatMap(c => c.videos).filter(v => v.type === typeFilter);
            if (vids && !vids.length)
                return null;
            const views = vids ? vids.reduce((sum, v) => sum + v.views, 0) : d.views;
            return [s, { ...d, _views: views }];
        }).filter(Boolean));
    }, [sportsData, typeFilter]);
    // Tri par vues décroissantes, en forçant la catégorie « Autres sports »
    // (= les non classés) en dernière position quel que soit son volume de vues
    // pour ne pas biaiser la lecture du dashboard.
    const sortedSports = Object.entries(filteredSports).sort((a, b) => {
        if (a[0] === 'Autres sports')
            return 1;
        if (b[0] === 'Autres sports')
            return -1;
        return b[1]._views - a[1]._views;
    });
    // maxViews et totalViews ne doivent PAS inclure les non classés pour la
    // On garde la liste sans "Autres sports" uniquement pour déterminer le sport
    // par défaut (le plus vu parmi les classifiés) et pour l'ordre de la sidebar.
    // Mais le donut et maxViews incluent maintenant TOUS les sports.
    const sortedSportsExclUnclassified = sortedSports.filter(([s]) => s !== 'Autres sports');
    const maxViews = sortedSports[0]?.[1]?._views || 1;
    const totalViews = Object.values(sportsData).reduce((s, d) => s + d.views, 0);
    const totalDuration = filteredVideos.reduce((s, v) => s + getVideoDurationSecs(v), 0);
    const nV = filteredVideos.filter(v => v.type === 'video').length;
    const nS = filteredVideos.filter(v => v.type === 'short').length;
    const nL = filteredVideos.filter(v => v.type === 'live').length;
    const activeKey = filteredSports[activeSport] ? activeSport : (sortedSportsExclUnclassified[0]?.[0] || sortedSports[0]?.[0] || '');
    const activeData = sportsData[activeKey];
    const handleLoad = useCallback(async () => {
        const key = apiKey.trim() || 'server-managed';
        saveSharedApiKey(key);
        setError('');
        setAnalyticsBundle(null);
        setLoading(true);
        try {
            let videos = [];
            let snapshotMeta = null;
            setLoadingMsg('Lecture des données validées dans la console admin…');
            const snapshot = await window.fetchChannelSnapshot(channelKey, { force: true });
            snapshotMeta = snapshot;
            videos = prepareVideosForDashboard((snapshot.videos || []).map(v => ({...v, channelKey})), 0);

            const now = snapshotMeta?.storedUpdatedAt ? new Date(snapshotMeta.storedUpdatedAt).getTime() : (snapshotMeta?.generatedAt ? new Date(snapshotMeta.generatedAt).getTime() : Date.now());
            channelMemoryRef.current[channelKey] = { videos, isDemo: false, cacheTs: now };
            setAllVideos(videos);
            setCacheTs(now);
            setIsDemo(false);
            setShowApiInput(false);
            setDateRange(getCurrentYtdRange());
            setExtraRanges([]);
            setLoading(false);
            setLoadingMsg('');

            // v112 : aucun cache local et aucun appel YouTube direct côté client.
            // Les chiffres affichés sont exactement ceux stockés/validés par l'admin.

        }
        catch (e) {
            setError(e.message || 'Erreur API.');
            setLoading(false);
            setLoadingMsg('');
        }
    }, [apiKey, channelKey]);
    // Auto-load serveur : le client ne renseigne plus les clés et ne clique plus sur "Charger".
    // Si aucune donnée réelle n'est disponible (ou si seules les données démo SPORT sont affichées),
    // on appelle automatiquement le proxy Vercel /api/youtube-v3 au démarrage et au changement de chaîne.
    const autoLoadRef = useRef({});
    useEffect(() => {
        const needsRealData = isDemo || !allVideos.length;
        if (!needsRealData || loading) return;
        if (autoLoadRef.current[channelKey]) return;
        autoLoadRef.current[channelKey] = true;
        const t = setTimeout(() => handleLoad(), 350);
        return () => clearTimeout(t);
    }, [channelKey, isDemo, allVideos.length, loading, handleLoad]);
    const tabs = [
        { id: 'all', label: 'Tout', count: filteredVideos.length },
        { id: 'video', label: 'Vidéos', count: nV }, { id: 'short', label: 'Shorts', count: nS }, { id: 'live', label: 'Lives', count: nL },
    ].filter(t => t.count > 0);
    const periodLabel = (() => {
        if (!dateRange.start || !dateRange.end)
            return 'Période';
        const main = `${fmtDateShort(dateRange.start)} → ${fmtDateShort(dateRange.end)}`;
        if (extraRanges.length === 0)
            return main;
        return `${main} +${extraRanges.length} période${extraRanges.length > 1 ? 's' : ''}`;
    })();
    const isMobileViewport = useFTVMobileViewport();
    if (isMobileViewport) {
        return React.createElement(MobileDashboardApp, {
            activeChannel, channelKey, handleChannelChange, searchInput, setSearchInput,
            sortedSports, activeKey, setActiveSport, setMainTab, mainTab, totalViews,
            filteredVideos, nV, nS, nL, tabs, typeFilter, setTypeFilter, periodLabel,
            activeData, analyticsBundle, analyticsStatus, connectYouTubeAnalytics, loadYouTubeAnalyticsData,
            analyticsClientId, setAnalyticsClientId, analyticsAccessToken, sportsData, anthropicKey,
            allVideos, dateRange, setDateRange, onReclassify: (v) => setReclassifyVideo(v)
        });
    }
    return (React.createElement("div", { className: "ftv-app-layout", style: { display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' } },
        loading && React.createElement(LoadingOverlay, { message: loadingMsg }),
        showCal && React.createElement("div", { style: { position: 'fixed', inset: 0, zIndex: 199 }, onClick: () => setShowCal(false) }),
        React.createElement("div", { className: "ftv-sidebar", style: { width: 244, flexShrink: 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
            React.createElement("div", { style: { padding: '14px 12px 10px', borderBottom: '1px solid var(--border)' } },
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 } },
                    React.createElement("div", { style: { background: 'var(--red)', color: '#fff', fontWeight: 700, fontSize: 11,
                            padding: '4px 8px', borderRadius: 6, letterSpacing: '0.5px', letterSpacing: '0.2px' } }, "france.tv"),
                    React.createElement("div", null,
                        React.createElement("select", { value: channelKey, onChange: e => handleChannelChange(e.target.value), title: "Changer de cha\u00EEne YouTube", style: {
                                fontWeight: 800, fontSize: 13, color: 'var(--text)', letterSpacing: '0.5px',
                                border: '1px solid transparent', background: 'transparent', outline: 'none',
                                padding: '1px 18px 1px 0', marginLeft: -2, cursor: 'pointer', fontFamily: 'var(--font)',
                                textTransform: 'uppercase', maxWidth: 128
                            } }, allowedChannelConfigs.map(ch => (React.createElement("option", { key: ch.key, value: ch.key }, ch.label)))),
                        React.createElement("div", { style: { fontSize: 9.5, color: 'var(--text3)' } }, "YouTube Analytics"))),
                React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 10 } },
                    React.createElement(DonutRing, { activeSport: activeKey, sportsData: sortedSports.map(([s, d]) => [s, { ...sportsData[s], views: sportsData[s].views }]), totalViews: totalViews, onSelectSport: s => { setActiveSport(s); setMainTab('chiffres'); } }),
                    React.createElement("div", { style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 } }, "Contenus"),
                        [[nV, 'vidéos', 'var(--blue)'], [nS, 'shorts', '#7A3800'], [nL, 'lives', '#1A5C1A']].map(([n, l, c]) => (React.createElement("div", { key: l, style: { display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 1 } },
                            React.createElement("span", { style: { fontWeight: 700, fontSize: 15, color: c } }, n),
                            React.createElement("span", { style: { fontSize: 10, color: 'var(--text3)' } }, l))))))),
            React.createElement("div", { style: { flex: 1, overflowY: 'auto', padding: '8px 6px' } }, sortedSports.map(([sport, data], i) => {
                const isUnclassified = sport === 'Autres sports';
                const prevSport = i > 0 ? sortedSports[i - 1][0] : null;
                const showDivider = isUnclassified && prevSport && prevSport !== 'Autres sports';
                return (React.createElement(React.Fragment, { key: sport },
                    showDivider && (React.createElement("div", { style: { margin: '10px 8px 6px', paddingTop: 8, borderTop: '1px dashed var(--border2)' } },
                        React.createElement("div", { style: { fontSize: 9, fontWeight: 600, color: 'var(--text3)',
                                textTransform: 'uppercase', letterSpacing: '1.2px', padding: '0 4px' } }, "Hors cat\u00E9gorie"))),
                    React.createElement(SportNavItem, { sport: sport, data: { ...data, views: data._views, i: sportsData[sport].i, bg: sportsData[sport].bg, fg: sportsData[sport].fg }, active: activeKey === sport, onClick: () => setActiveSport(sport), delay: Math.min(i * 8, 80), maxViews: maxViews, exportMode: exportMode, checked: selSports.has(sport), onCheck: k => toggle(selSports, setSelSports, k) })));
            })),
            React.createElement("div", { style: { display: 'none' } },
                !showApiInput ? (React.createElement("div", null,
                    React.createElement("button", { onClick: () => { if (!loading && (isDemo || !allVideos.length)) handleLoad(); }, style: {
                            width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 8,
                            padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7
                        } },
                        React.createElement("div", { style: { width: 7, height: 7, borderRadius: '50%', background: isDemo ? '#D4A000' : (allVideos.length ? '#16A34A' : '#9CA3AF'), flexShrink: 0 } }),
                        React.createElement("span", { style: { fontSize: 11, color: 'var(--text2)' } }, isDemo ? 'Données démo' : (allVideos.length ? 'Données admin' : 'Aucune donnée')),
                        React.createElement("span", { style: { fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' } }, loading ? 'Chargement…' : (isDemo || !allVideos.length ? 'Auto-load' : 'Admin'))),
                    !isDemo && allVideos.length > 0 && cacheTs && React.createElement("div", { style: { marginTop: 5, fontSize: 9, color: 'var(--text3)' } },
                        activeChannel.label,
                        " \u00B7 Charg\u00E9 le ",
                        fmtDate(cacheTs)),
                    !isDemo && allVideos.length > 0 && React.createElement("button", { onClick: () => {
                            if (confirm('Recharger les données visibles depuis la console admin ?')) {
                                (window.getCacheKeys ? window.getCacheKeys(channelKey) : [getCacheKey(channelKey)]).forEach(k => localStorage.removeItem(k));
                                location.reload();
                            }
                        }, style: { marginTop: 6, width: '100%', background: 'transparent', border: '1px dashed var(--border2)',
                            borderRadius: 7, padding: '5px', fontSize: 10, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font)' } }, "\u21BB Vider le cache de cette cha\u00EEne"))) : (React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 10, color: 'var(--text3)', marginBottom: 4 } },
                        "Cl\u00E9 YouTube Data API v3 \u00B7 ",
                        activeChannel.label),
                    React.createElement("input", { value: apiKey, onChange: e => setApiKey(e.target.value), onKeyDown: e => e.key === 'Enter' && handleLoad(), placeholder: "AIzaSy...", style: { width: '100%', background: 'var(--bg4)',
                            border: `1px solid ${error ? '#E2001A77' : 'var(--border2)'}`, borderRadius: 8,
                            padding: '6px 9px', fontSize: 11, color: 'var(--text)', outline: 'none', marginBottom: error ? 3 : 5 } }),
                    error && React.createElement("div", { style: { fontSize: 10, color: '#C0392B', marginBottom: 5 } }, error),
                    React.createElement("div", { style: { display: 'flex', gap: 5 } },
                        React.createElement("button", { onClick: () => { setShowApiInput(false); setError(''); }, style: { flex: 1, background: 'transparent',
                                border: '1px solid var(--border2)', borderRadius: 7, padding: '6px', fontSize: 11,
                                color: 'var(--text2)', cursor: 'pointer' } }, "Annuler"),
                        React.createElement("button", { onClick: handleLoad, style: { flex: 1, background: 'var(--red)', border: 'none',
                                borderRadius: 7, padding: '6px', fontSize: 11, color: '#fff', cursor: 'pointer', fontWeight: 600 } }, "Charger \u2197")))),
                React.createElement("div", { style: { marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 } }, !showAnthropicInput ? (React.createElement("button", { onClick: () => setMainTab('previsions'), style: {
                        width: '100%', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 8,
                        padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7
                    } },
                    React.createElement("div", { style: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: anthropicKey ? '#4A0E8F' : '#9CA3AF' } }),
                    React.createElement("span", { style: { fontSize: 10.5, color: 'var(--text2)' } },
                        "Claude AI ",
                        'géré côté serveur'),
                    React.createElement("span", { style: { fontSize: 9.5, color: 'var(--text3)', marginLeft: 'auto' } }, "Pr\u00E9visions \u2192"))) : (React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 10, color: 'var(--text3)', marginBottom: 4 } }, "Cl\u00E9 API Anthropic (console.anthropic.com)"),
                    React.createElement("input", { value: anthropicKey, onChange: e => { const next = e.target.value; setAnthropicKey(next); saveSharedAnthropicKey(next); }, onKeyDown: e => { if (e.key === 'Enter') {
                            saveSharedAnthropicKey(anthropicKey);
                            setShowAnthropicInput(false);
                        } }, placeholder: "sk-ant-...", style: { width: '100%', background: 'var(--bg4)',
                            border: '1px solid var(--border2)', borderRadius: 8,
                            padding: '6px 9px', fontSize: 11, color: 'var(--text)', outline: 'none', marginBottom: 5 } }),
                    React.createElement("div", { style: { display: 'flex', gap: 5 } },
                        React.createElement("button", { onClick: () => setShowAnthropicInput(false), style: { flex: 1, background: 'transparent',
                                border: '1px solid var(--border2)', borderRadius: 7, padding: '5px', fontSize: 11,
                                color: 'var(--text2)', cursor: 'pointer' } }, "Annuler"),
                        React.createElement("button", { onClick: () => { saveSharedAnthropicKey(anthropicKey); setShowAnthropicInput(false); }, style: { flex: 1, background: '#4A0E8F', border: 'none', borderRadius: 7, padding: '5px',
                                fontSize: 11, color: '#fff', cursor: 'pointer', fontWeight: 600 } }, "Sauvegarder")),
                    React.createElement("div", { style: { marginTop: 6, fontSize: 9, color: 'var(--text3)', lineHeight: 1.5 } }, "Gratuit sur console.anthropic.com \u00B7 ~$0.001 par analyse compl\u00E8te")))))),
        React.createElement("div", { className: "ftv-main-shell", style: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } },
            React.createElement("div", { className: "ftv-main-tabs", style: { padding: '0 18px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
                    display: 'flex', gap: 0, flexShrink: 0, alignItems: 'stretch' } },
                [['chiffres', '📊 Chiffres'], ['graphiques', '📈 Graphiques'], ['previsions', '🔭 Prévisions'], ['alertes', '🚨 Alertes'], ['copilot', '🧠 Copilot IA'], ['analytics', '📡 Analytics']].map(([id, label]) => (React.createElement("button", { key: id, onClick: () => setMainTab(id), style: {
                        padding: '10px 18px', fontSize: 12, fontWeight: mainTab === id ? 700 : 500,
                        color: mainTab === id ? 'var(--red)' : 'var(--text3)',
                        background: 'transparent', border: 'none', borderBottom: mainTab === id ? '2px solid var(--red)' : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s', letterSpacing: '0.2px',
                        marginBottom: '-1px'
                    } }, label))),
                React.createElement("div", { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center' } },
                    !userMenuOpen && React.createElement("button", { onClick: () => setUserMenuOpen(true), "aria-label": 'Ouvrir le menu profil', style: {
                            width: 34, height: 34, borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--bg4)',
                            color: 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                            cursor: 'pointer', transition: 'all .15s', boxShadow: 'none', position: 'relative', zIndex: 1
                        } }, [0, 1, 2].map(i => React.createElement("span", { key: i, style: { width: 15, height: 2, borderRadius: 999, background: 'currentColor', display: 'block' } })))),
                userMenuOpen && React.createElement("div", { className: "ftv-user-menu-layer", onClick: () => setUserMenuOpen(false), style: { position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', isolation: 'isolate' } },
                    React.createElement("aside", { className: "ftv-user-menu-panel", onClick: e => e.stopPropagation(), style: { position: 'relative', top: 'auto', right: 'auto', bottom: 'auto', height: '100dvh', width: 'min(390px,92vw)', zIndex: 1,
                            background: 'var(--bg2)', borderLeft: '1px solid var(--border)', boxShadow: '-32px 0 90px rgba(15,23,42,.26)', overflowY: 'auto',
                            padding: '22px 22px calc(72px + env(safe-area-inset-bottom,0px))', boxSizing: 'border-box', animation: 'ftvSlideMenuIn .22s ease-out', display: 'flex', flexDirection: 'column', gap: 18 } },
                        React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 10, color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.4px' } }, "Menu"),
                                React.createElement("div", { style: { fontSize: 22, fontWeight: 900, letterSpacing: '-.05em', color: 'var(--text)', marginTop: 2 } }, "Compte")),
                            React.createElement("button", { onClick: () => setUserMenuOpen(false), "aria-label": "Fermer le menu", style: { width: 34, height: 34, borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--bg4)', color: 'var(--text)', cursor: 'pointer', fontSize: 18, lineHeight: 1 } }, "\u00D7")),
                        React.createElement("section", { style: { border: '1px solid var(--border)', background: 'var(--bg3)', borderRadius: 20, padding: 16 } },
                            React.createElement("div", { style: { fontSize: 10, color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.1px', marginBottom: 12 } }, "Profil"),
                            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 } },
                                React.createElement("div", { style: { width: 42, height: 42, borderRadius: 14, background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, letterSpacing: '-.03em' } }, (profileFullName || 'U').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()),
                                React.createElement("div", { style: { minWidth: 0 } },
                                    React.createElement("div", { style: { fontSize: 15, fontWeight: 900, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, profileFullName),
                                    React.createElement("div", { style: { fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, authProfile?.email || 'email non renseigné'))),
                            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 } },
                                React.createElement("div", { style: { border: '1px solid var(--border2)', borderRadius: 14, padding: 10, background: 'var(--bg2)' } },
                                    React.createElement("div", { style: { fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.9px' } }, "Pr\u00E9nom"),
                                    React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: 'var(--text)', marginTop: 3 } }, authProfile?.firstName || '—')),
                                React.createElement("div", { style: { border: '1px solid var(--border2)', borderRadius: 14, padding: 10, background: 'var(--bg2)' } },
                                    React.createElement("div", { style: { fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.9px' } }, "Nom"),
                                    React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: 'var(--text)', marginTop: 3 } }, authProfile?.lastName || '—')),
                                React.createElement("div", { style: { gridColumn: '1 / -1', border: '1px solid var(--border2)', borderRadius: 14, padding: 10, background: 'var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 } },
                                    React.createElement("div", null,
                                        React.createElement("div", { style: { fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '.9px' } }, "Accès"),
                                        React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: 'var(--text)', marginTop: 3 } }, roleLabel)),
                                    React.createElement("span", { style: { borderRadius: 999, padding: '5px 9px', fontSize: 11, fontWeight: 900, background: authProfile?.licenseActive === false ? '#FEE2E2' : '#DCFCE7', color: authProfile?.licenseActive === false ? '#991B1B' : '#166534' } }, authProfile?.licenseActive === false ? 'Non' : 'Oui')))),
                        React.createElement("section", { style: { border: '1px solid var(--border)', background: 'var(--bg3)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 } },
                            React.createElement("div", { style: { fontSize: 10, color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.1px' } }, "Paramètres"),
                            isAdminRole && React.createElement("button", { onClick: () => { window.open('/admin.html','_blank','noopener,noreferrer'); }, style: { width: '100%', border: '1px solid var(--border2)', borderRadius: 14, padding: '12px 14px', background: 'var(--bg2)', color: 'var(--text)', fontWeight: 900, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left', display:'flex', justifyContent:'space-between', alignItems:'center' } },
                                React.createElement("span", null, "Console admin"),
                                React.createElement("span", { style:{color:'var(--text3)'} }, "↗")),
                            React.createElement("button", { onClick: () => { window.ftvToggleTheme && window.ftvToggleTheme(); }, style: { width: '100%', border: '1px solid var(--border2)', borderRadius: 14, padding: '12px 14px', background: 'var(--bg2)', color: 'var(--text)', fontWeight: 900, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left', display:'flex', justifyContent:'space-between', alignItems:'center' } },
                                React.createElement("span", null, "Dark mode"),
                                React.createElement("span", { style:{color:'var(--text3)', fontSize:11, fontWeight:800} }, "persistant")),
                            React.createElement("button", { onClick: () => setPresentationMode(m => !m), style: { width: '100%', border: '1px solid var(--border2)', borderRadius: 14, padding: '12px 14px', background: presentationMode ? 'var(--text)' : 'var(--bg2)', color: presentationMode ? '#fff' : 'var(--text)', fontWeight: 900, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left', display:'flex', justifyContent:'space-between', alignItems:'center' } },
                                React.createElement("span", null, "Mode présentation client"),
                                React.createElement("span", { style:{color:presentationMode?'rgba(255,255,255,.72)':'var(--text3)', fontSize:11, fontWeight:800} }, presentationMode ? "actif" : "désactivé")),
                            presentationMode && React.createElement("div", { style: { border:'1px solid var(--border2)', borderRadius: 16, background:'var(--bg2)', padding: 12, display:'grid', gap: 10 } },
                                React.createElement("div", { style:{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10} },
                                    React.createElement("div", null,
                                        React.createElement("div", { style:{fontSize:12, fontWeight:900, color:'var(--text)'} }, "Événements visibles"),
                                        React.createElement("div", { style:{fontSize:10.5, color:'var(--text3)', marginTop:2, lineHeight:1.35} }, presentationScopeArray.length ? `${presentationScopeArray.length} événement(s) sélectionné(s)` : "Aucun filtre : toute la chaîne reste visible")),
                                    presentationScopeArray.length > 0 && React.createElement("button", { onClick: () => setPresentationScopeKeys(new Set()), style:{border:'none', background:'transparent', color:'var(--red)', fontSize:11, fontWeight:900, cursor:'pointer'} }, "Réinitialiser")),
                                React.createElement("div", { style:{display:'grid', gap:7, maxHeight:260, overflowY:'auto', paddingRight:3} },
                                    presentationEventOptions.slice(0, 28).map(ev => {
                                        const selected = presentationScopeKeys.has(ev.key);
                                        return React.createElement("button", { key: ev.key, onClick: () => setPresentationScopeKeys(prev => { const n = new Set(prev); n.has(ev.key) ? n.delete(ev.key) : n.add(ev.key); return n; }), style:{ width:'100%', display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:8, textAlign:'left', border:`1px solid ${selected ? 'rgba(226,0,26,.40)' : 'var(--border2)'}`, background:selected ? 'rgba(226,0,26,.08)' : 'var(--bg3)', color:'var(--text)', borderRadius:12, padding:'9px 10px', cursor:'pointer', fontFamily:'var(--font)' } },
                                            React.createElement("span", { style:{minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11.5, fontWeight:850} }, ev.label),
                                            React.createElement("span", { style:{fontSize:10.5, color:selected ? 'var(--red)' : 'var(--text3)', fontWeight:900} }, selected ? 'visible' : fmt(ev.views)));
                                    }))
                            ),
                            React.createElement("button", { onClick: () => { window.ftvOpenPasswordModal && window.ftvOpenPasswordModal(); }, style: { width: '100%', border: '1px solid var(--border2)', borderRadius: 14, padding: '12px 14px', background: 'var(--bg2)', color: 'var(--text)', fontWeight: 900, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left', display:'flex', justifyContent:'space-between', alignItems:'center' } },
                                React.createElement("span", null, "Changer mon mot de passe"),
                                React.createElement("span", { style:{color:'var(--text3)', fontSize:11, fontWeight:800} }, "sécurisé"))),
                        React.createElement("div", { style: { marginTop: 4, display: 'grid', gap: 8, paddingBottom: 8 } },
                            React.createElement("button", { onClick: () => { setUserMenuOpen(false); window.ftvAuthLogout && window.ftvAuthLogout(); }, style: { width: '100%', border: 'none', borderRadius: 14, padding: '13px 14px', minHeight: 46, background: 'var(--red)', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' } }, "D\u00E9connexion"),
                            null)))),
            React.createElement("div", { className: "ftv-kpi-toolbar", style: { padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex',
                    alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--bg2)' } },
                React.createElement(KpiCard, { label: "Vues totales", value: totalViews, delay: 0, sub: `${filteredVideos.length} contenus` }),
                React.createElement(KpiCard, { label: "Durée totale", value: totalDuration, format: v => fmtDuration(v), accent: '#4A0E8F', delay: 35, sub: "contenus cumulés" }),
                React.createElement(KpiCard, { label: "Vid\u00E9os", value: nV, format: n => n.toLocaleString('fr-FR'), accent: TYPE_COLORS.video, delay: 70 }),
                React.createElement(KpiCard, { label: "Shorts", value: nS, format: n => n.toLocaleString('fr-FR'), accent: TYPE_COLORS.short, delay: 100 }),
                React.createElement(KpiCard, { label: "Lives", value: nL, format: n => n.toLocaleString('fr-FR'), accent: TYPE_COLORS.live, delay: 150 }),
                React.createElement("div", { style: { display: 'flex', gap: 7, flexShrink: 0, marginLeft: 'auto', alignItems: 'center', position: 'relative' } },
                    React.createElement("button", { onClick: () => setShowCal(c => !c), style: {
                            display: 'flex', alignItems: 'center', gap: 7, background: showCal ? 'var(--red)' : 'var(--bg4)',
                            color: showCal ? '#fff' : 'var(--text)', border: `1px solid ${showCal ? 'var(--red)' : 'var(--border2)'}`,
                            borderRadius: 9, padding: '7px 13px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                            transition: 'all .15s', whiteSpace: 'nowrap'
                        } },
                        React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 13 13", fill: "none" },
                            React.createElement("rect", { x: "1", y: "2", width: "11", height: "10", rx: "2", stroke: "currentColor", strokeWidth: "1.2" }),
                            React.createElement("line", { x1: "1", y1: "5", x2: "12", y2: "5", stroke: "currentColor", strokeWidth: "1.2" }),
                            React.createElement("line", { x1: "4", y1: "1", x2: "4", y2: "3.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }),
                            React.createElement("line", { x1: "9", y1: "1", x2: "9", y2: "3.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })),
                        periodLabel),
                    canEditRole && React.createElement("button", { onClick: () => { setExportMode(m => { if (m)
                            clearSelection(); return !m; }); }, style: {
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: exportMode ? 'var(--text)' : 'var(--bg4)',
                            color: exportMode ? '#fff' : 'var(--text)',
                            border: `1px solid ${exportMode ? 'var(--text)' : 'var(--border2)'}`,
                            borderRadius: 9, padding: '7px 13px', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .15s'
                        } },
                        React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none" },
                            React.createElement("path", { d: "M6 1v7M3 5l3 3 3-3M1 9h10v2H1z", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round", strokeLinejoin: "round" })),
                        exportMode ? 'Annuler' : 'Exporter'),
                    showCal && (React.createElement("div", { style: { position: 'absolute', top: '100%', right: 0, marginTop: 8, background: '#fff',
                            borderRadius: 20, boxShadow: '0 18px 55px rgba(15,23,42,0.20)', padding: 20, width: 520, maxWidth: 'min(520px, calc(100vw - 340px))', maxHeight: 'calc(100vh - 150px)', overflowY: 'auto', overflowX: 'hidden', zIndex: 600 }, onClick: e => e.stopPropagation() },
                        React.createElement(CalendarPickerInline, { range: dateRange, onChange: setDateRange, extraRanges: extraRanges, onExtraChange: setExtraRanges, onClose: () => setShowCal(false) }))))),
            React.createElement("div", { className: "ftv-filter-toolbar", style: { padding: '10px 18px', display: 'flex', gap: 7, flexShrink: 0,
                    background: 'var(--bg2)', borderBottom: '1px solid var(--border)', alignItems: 'center' } },
                tabs.map(t => React.createElement(TypeTab, { key: t.id, id: t.id, label: t.label, count: t.count, active: typeFilter === t.id, onClick: () => setTypeFilter(t.id) })),
                React.createElement("div", { style: { marginLeft: 8, flex: '1 1 360px', maxWidth: 520, minWidth: 220, position: 'relative', display: 'flex', alignItems: 'center' } },
                    React.createElement("svg", { width: "13", height: "13", viewBox: "0 0 13 13", fill: "none", style: { position: 'absolute', left: 10, color: 'var(--text3)', pointerEvents: 'none' } },
                        React.createElement("circle", { cx: "5.5", cy: "5.5", r: "4", stroke: "currentColor", strokeWidth: "1.3" }),
                        React.createElement("path", { d: "M8.6 8.6L12 12", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round" })),
                    React.createElement("input", { value: searchInput, onChange: e => setSearchInput(e.target.value), placeholder: taxonomyMode === 'general' ? "Rechercher une vidéo, émission, thématique…" : "Rechercher une vidéo, compétition, sportif…", style: { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20,
                            padding: '6px 34px 6px 30px', fontSize: 12, color: 'var(--text)', outline: 'none', height: 30 } }),
                    searchInput && React.createElement("button", { onClick: () => { setSearchInput(''); setSearchQuery(''); }, title: "Effacer la recherche", style: { position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
                            width: 19, height: 19, borderRadius: '50%', border: 'none', background: 'var(--bg4)', color: 'var(--text3)', fontSize: 13,
                            cursor: 'pointer', lineHeight: '19px', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, "\u00D7")),
                searchInput && (React.createElement("div", { style: { fontSize: 10.5, color: 'var(--text3)', whiteSpace: 'nowrap' } }, searchQuery ? React.createElement(React.Fragment, null,
                    filteredVideos.length,
                    " r\u00E9sultat",
                    filteredVideos.length > 1 ? 's' : '',
                    searchAutoYearActive && globalSearchVideos.length > 0 ? ' · recherche toutes années' : '') : 'Recherche…')),
                dateRange.start && dateRange.end && (React.createElement("div", { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 11, color: 'var(--text3)', padding: '0 4px', whiteSpace: 'nowrap' } },
                    React.createElement("span", { style: { width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', flexShrink: 0 } }),
                    fmtDateShort(dateRange.start),
                    " \u2013 ",
                    fmtDateShort(dateRange.end)))),
            React.createElement("div", { className: "ftv-main-content", style: { flex: 1, overflow: 'hidden', background: 'var(--bg)' } }, mainTab === 'analytics' ? (React.createElement(AnalyticsView, { allVideos: filteredVideos, analyticsBundle: analyticsBundle, analyticsStatus: analyticsStatus, onConnect: connectYouTubeAnalytics, onLoad: loadYouTubeAnalyticsData, analyticsClientId: analyticsClientId, setAnalyticsClientId: setAnalyticsClientId, analyticsAccessToken: analyticsAccessToken, channelKey: channelKey, managedAnalyticsChannels: managedAnalyticsChannels, analyticsChannelMap: analyticsChannelMap, onAnalyticsChannelMapChange: onAnalyticsChannelMapChange, onRefreshAnalyticsChannels: refreshManagedAnalyticsChannels, analyticsHealth: analyticsHealth })) : mainTab === 'alertes' ? (React.createElement(OperationalIntelligenceView, { allVideos: allVideos, currentVideos: filteredVideos, sportsData: sportsData, totalViews: totalViews, channelKey: channelKey, dateRange: dateRange, analyticsBundle: analyticsBundle })) : mainTab === 'copilot' ? (React.createElement(PredictiveCopilotView, { allVideos: allVideos, currentVideos: filteredVideos, sportsData: sportsData, totalViews: totalViews, channelKey: channelKey, dateRange: dateRange, analyticsBundle: analyticsBundle })) : mainTab === 'previsions' ? (React.createElement(PrevisionsView, { sportsData: sportsData, totalViews: totalViews, anthropicKey: anthropicKey, allVideos: allVideos, dateRange: dateRange, channelKey: channelKey, analyticsBundle: analyticsBundle })) : mainTab === 'graphiques' ? (React.createElement(ChartsView, { sportsData: sportsData, totalViews: totalViews, typeFilter: typeFilter, onSelectSport: s => { setActiveSport(s); setMainTab('chiffres'); } })) : activeData ? React.createElement(DetailPanel, { sport: activeKey, data: activeData, totalViews: totalViews, typeFilter: typeFilter, exportMode: exportMode, selectedComps: selComps, onCheckComp: k => toggle(selComps, setSelComps, k), selectedVideos: selVideos, onCheckVideo: k => toggle(selVideos, setSelVideos, k), taxonomyMode: taxonomyMode, onReclassify: (v) => setReclassifyVideo(v) }) : (React.createElement("div", { style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text3)' } },
                React.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: 'var(--text2)' } }, "Aucun contenu trouv\u00E9"),
                React.createElement("div", { style: { fontSize: 12 } }, "Essaie une autre recherche ou \u00E9largis la p\u00E9riode s\u00E9lectionn\u00E9e."))))),
        exportMode && totalSel > 0 && (React.createElement(ExportBar, { selectedSports: selSports, selectedComps: selComps, selectedVideos: selVideos, sportsData: sportsData, allVideos: filteredVideos, dateRange: dateRange, channelKey: channelKey, onClear: clearSelection })),
        reclassifyVideo && React.createElement(ReclassifyModal, { video: reclassifyVideo, onClose: () => setReclassifyVideo(null), onApplied: () => {
                // Vide le cache et force un re-render des données pour que la
                // nouvelle classification soit visible immédiatement.
                window.invalidateClassifyCache && window.invalidateClassifyCache();
                setOverrideNonce(n => n + 1);
                setReclassifyVideo(null);
            } })));
}
// ─── EXPORT BAR ───────────────────────────────────────────────────────────────
function ExportBar({ selectedSports, selectedComps, selectedVideos, sportsData, allVideos, dateRange, channelKey = 'francetv', onClear }) {
    const rows = useMemo(() => getExportRowsFromSelection({ selectedSports, selectedComps, selectedVideos, sportsData, allVideos }), [selectedSports, selectedComps, selectedVideos, sportsData, allVideos]);
    const primarySport = useMemo(() => {
        if (selectedSports && selectedSports.size)
            return Array.from(selectedSports)[0];
        if (rows.length)
            return rows[0].sport;
        return '';
    }, [selectedSports, rows]);
    const primaryData = primarySport && sportsData ? sportsData[primarySport] : null;
    const accent = primaryData?.fg || '#E30613';
    const totalViews = rows.reduce((s, r) => s + Number(r.views || 0), 0);
    const countVideos = rows.filter(r => r.type === 'Vidéo').length;
    const countShorts = rows.filter(r => r.type === 'Short').length;
    const countLives = rows.filter(r => r.type === 'Live').length;
    const exportName = () => {
        const label = (primarySport || 'export').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        const now = new Date().toISOString().slice(0, 10);
        const channelLabel = (typeof getChannelConfig === 'function' ? getChannelConfig(channelKey)?.key : channelKey) || 'francetv';
        return `${channelLabel}_youtube_${label}_${now}.xls`;
    };
    const handleExcel = () => {
        exportStyledExcel({ rows, filename: exportName(), dateRange, accent, title: `Export YouTube Analytics — ${primarySport || 'Sélection'}`, subtitle: `${rows.length} contenu${rows.length > 1 ? 's' : ''} · ${fmtFull(totalViews)} vues · ${countVideos} vidéo${countVideos > 1 ? 's' : ''}, ${countShorts} short${countShorts > 1 ? 's' : ''}, ${countLives} live${countLives > 1 ? 's' : ''}` });
    };
    const handleCsv = () => {
        exportCSV(rows.map(r => ({ 'Sport / Thématique': r.sport, 'Compétition / Sous-catégorie': r.competition, 'Type': r.type, 'Titre': r.title, 'Date': r.publishedAt, 'Durée (s)': r.duration, 'Vues publiques': r.views, 'Vues Analytics': r.analyticsViews || 0, 'Watch time min.': Math.round(r.watchTimeMinutes || 0), 'Durée moy. sec.': Math.round(r.averageViewDuration || 0), 'Impressions': r.impressions || 0, 'CTR': r.impressionClickThroughRate ? (r.impressionClickThroughRate * 100).toFixed(2) + '%' : '', 'Abonnés +': r.subscribersGained || 0, 'Abonnés -': r.subscribersLost || 0, 'Shares': r.shares || 0, 'URL': r.url, 'ID vidéo': r.videoId })), exportName().replace(/\.xls$/i, '.csv'));
    };
    return (React.createElement("div", { style: { position: 'fixed', left: 264, right: 18, bottom: 18, zIndex: 420, background: '#fff', border: '1px solid var(--border)', boxShadow: '0 18px 55px rgba(17,24,39,.18)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14 } },
        React.createElement("div", { style: { width: 10, height: 46, borderRadius: 10, background: accent, flexShrink: 0 } }),
        React.createElement("div", { style: { minWidth: 0, flex: 1 } },
            React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 3 } }, "Export pr\u00EAt"),
            React.createElement("div", { style: { fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' } },
                React.createElement("span", null,
                    rows.length,
                    " contenu",
                    rows.length > 1 ? 's' : ''),
                React.createElement("span", null,
                    fmtFull(totalViews),
                    " vues"),
                React.createElement("span", null,
                    countVideos,
                    " vid\u00E9o",
                    countVideos > 1 ? 's' : ''),
                React.createElement("span", null,
                    countShorts,
                    " short",
                    countShorts > 1 ? 's' : ''),
                countLives > 0 && React.createElement("span", null,
                    countLives,
                    " live",
                    countLives > 1 ? 's' : ''))),
        React.createElement("button", { onClick: handleExcel, disabled: !rows.length, style: { background: accent, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 800, cursor: rows.length ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)', boxShadow: '0 6px 18px rgba(17,24,39,.12)' } }, "Exporter Excel"),
        React.createElement("button", { onClick: handleCsv, disabled: !rows.length, style: { background: 'var(--bg4)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 700, cursor: rows.length ? 'pointer' : 'not-allowed', fontFamily: 'var(--font)' } }, "CSV simple"),
        React.createElement("button", { onClick: onClear, style: { background: 'transparent', color: 'var(--text3)', border: 'none', padding: '9px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' } }, "Vider")));
}
// ─── MODAL DE RECLASSIFICATION ───────────────────────────────────────────────
// Permet à l'utilisateur de corriger manuellement le sport et la compétition
// d'une vidéo mal classée. La correction est persistée par ID YouTube.
function ReclassifyModal({ video, onClose, onApplied }) {
    const cls = window.classify(video);
    const isOverridden = cls._debug?.confidence === 'manual_override';
    // Liste des sports disponibles, triée alphabétiquement, avec leurs icônes.
    const sportsList = useMemo(() => {
        const list = (window.SR_SCORED || []).map(sp => ({ s: sp.s, i: sp.i, bg: sp.bg, fg: sp.fg, comps: sp.comps.map(c => c.n) }));
        return list.sort((a, b) => a.s.localeCompare(b.s));
    }, []);
    const [selectedSport, setSelectedSport] = useState(cls.s);
    const [selectedComp, setSelectedComp] = useState(cls.c);
    // Quand on change de sport, on reset la compétition pour ne pas garder
    // une compétition d'un autre sport.
    const handlePickSport = (s) => { setSelectedSport(s); setSelectedComp(''); };
    const currentSp = sportsList.find(sp => sp.s === selectedSport);
    const availableComps = currentSp?.comps || [];
    const apply = () => {
        if (!selectedSport || !video.id)
            return;
        window.FTVLearning.setOverride(video.id, selectedSport, selectedComp || null);
        onApplied && onApplied();
    };
    const removeOverride = () => {
        if (!video.id)
            return;
        window.FTVLearning.clearOverride(video.id);
        onApplied && onApplied();
    };
    return (React.createElement("div", { onClick: onClose, style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 } },
        React.createElement("div", { onClick: e => e.stopPropagation(), style: { background: '#fff', borderRadius: 14, padding: '22px 24px', width: 'min(540px, 100%)',
                maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', fontFamily: 'var(--font)' } },
            React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 } }, "Reclasser cette vid\u00E9o"),
                    React.createElement("div", { style: { fontSize: 11, color: 'var(--text3)' } }, "La correction est sauvegard\u00E9e localement pour cette vid\u00E9o.")),
                React.createElement("button", { onClick: onClose, style: { background: 'transparent', border: 'none', cursor: 'pointer',
                        fontSize: 22, color: 'var(--text3)', padding: 0, lineHeight: 1 } }, "\u00D7")),
            React.createElement("div", { style: { padding: '10px 12px', background: 'var(--bg4)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 } }, video.title),
            React.createElement("div", { style: { fontSize: 10.5, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 } }, "Classement actuel"),
            React.createElement("div", { style: { padding: '8px 12px', background: isOverridden ? '#FEF3E2' : 'var(--bg4)',
                    border: '1px solid ' + (isOverridden ? '#FDE3B8' : 'var(--border)'),
                    borderRadius: 8, marginBottom: 18, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 } },
                React.createElement("span", { style: { fontSize: 14 } }, cls.i),
                React.createElement("span", { style: { fontWeight: 600, color: 'var(--text)' } }, cls.s),
                React.createElement("span", { style: { color: 'var(--text3)' } },
                    "\u00B7 ",
                    cls.c),
                isOverridden && React.createElement("span", { style: { marginLeft: 'auto', fontSize: 10, color: '#7A3800', fontWeight: 600 } }, "\u270B correction manuelle")),
            React.createElement("div", { style: { fontSize: 10.5, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 } }, "Sport"),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, marginBottom: 18, maxHeight: 240, overflowY: 'auto' } }, sportsList.map(sp => (React.createElement("button", { key: sp.s, onClick: () => handlePickSport(sp.s), style: { padding: '8px 10px', fontSize: 11.5, fontFamily: 'var(--font)', cursor: 'pointer',
                    background: selectedSport === sp.s ? sp.bg : '#fff',
                    border: '1.5px solid ' + (selectedSport === sp.s ? sp.fg : 'var(--border)'),
                    color: selectedSport === sp.s ? sp.fg : 'var(--text)',
                    borderRadius: 8, fontWeight: selectedSport === sp.s ? 700 : 500,
                    display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left' } },
                React.createElement("span", { style: { fontSize: 13 } }, sp.i),
                React.createElement("span", { style: { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, sp.s))))),
            availableComps.length > 0 && (React.createElement(React.Fragment, null,
                React.createElement("div", { style: { fontSize: 10.5, color: 'var(--text3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600 } }, "Comp\u00E9tition (facultatif)"),
                React.createElement("select", { value: selectedComp, onChange: e => setSelectedComp(e.target.value), style: { width: '100%', padding: '9px 10px', fontSize: 12, fontFamily: 'var(--font)',
                        border: '1px solid var(--border)', borderRadius: 8, marginBottom: 18, background: '#fff', color: 'var(--text)' } },
                    React.createElement("option", { value: "" }, "\u2014 laisser le syst\u00E8me choisir \u2014"),
                    availableComps.map(c => (React.createElement("option", { key: c, value: c }, c)))))),
            React.createElement("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
                isOverridden && (React.createElement("button", { onClick: removeOverride, style: { padding: '9px 14px', fontSize: 12, fontWeight: 600,
                        fontFamily: 'var(--font)', background: 'transparent', border: '1px solid var(--border)',
                        color: 'var(--text3)', borderRadius: 8, cursor: 'pointer' } }, "Retirer la correction")),
                React.createElement("button", { onClick: onClose, style: { padding: '9px 14px', fontSize: 12, fontWeight: 600,
                        fontFamily: 'var(--font)', background: 'transparent', border: '1px solid var(--border)',
                        color: 'var(--text2)', borderRadius: 8, cursor: 'pointer' } }, "Annuler"),
                React.createElement("button", { onClick: apply, disabled: !selectedSport, style: { padding: '9px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
                        background: selectedSport ? 'var(--red)' : 'var(--border2)',
                        color: '#fff', border: 'none', borderRadius: 8, cursor: selectedSport ? 'pointer' : 'not-allowed',
                        opacity: selectedSport ? 1 : 0.6 } }, "Appliquer la correction")))));
}
// ─── CALENDAR INLINE ──────────────────────────────────────────────────────────
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
function CalendarPickerInline({ range, onChange, extraRanges = [], onExtraChange, onClose }) {
    const [vDate, setVDate] = useState(() => range.start || new Date(2025, 0, 1));
    const [phase, setPhase] = useState('start');
    // Mode survol : 'day' (par défaut), 'week' (sélection de semaine entière au survol/clic),
    // 'month' (sélection de mois entier), 'year' (sélection d'année entière).
    const [mode, setMode] = useState('day');
    const y = vDate.getFullYear(), mo = vDate.getMonth();
    const firstDow = (new Date(y, mo, 1).getDay() + 6) % 7;
    const dim = new Date(y, mo + 1, 0).getDate();
    const cells = [...Array(firstDow).fill(null), ...Array(dim).fill(0).map((_, i) => new Date(y, mo, i + 1))];
    const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
    // Une date est en surbrillance si elle est dans la plage principale OU dans une plage additionnelle.
    const inAnyRange = d => {
        if (!d)
            return null;
        if (range.start && range.end && d >= range.start && d <= range.end)
            return 'main';
        for (const r of extraRanges) {
            if (r && r.start && r.end && d >= r.start && d <= r.end)
                return 'extra';
        }
        return null;
    };
    const inRange = d => d && range.start && range.end && d > range.start && d < range.end;
    const pad = m => String(m).padStart(2, '0');
    const lastDay = (yr, m) => new Date(yr, m, 0).getDate();
    // Helper : ajouter une plage (Cmd/Ctrl-clic) ou la définir comme principale (clic normal).
    // Si la plage existe déjà (chevauche complètement une plage extra), on la retire au lieu d'ajouter.
    const applyRange = (start, end, additive) => {
        if (additive && range.start && range.end) {
            // Vérifier si la plage existe déjà dans extraRanges → toggle (on la retire).
            const exists = extraRanges.findIndex(r => r.start && r.end && sameDay(r.start, start) && sameDay(r.end, end));
            if (exists >= 0) {
                const next = [...extraRanges];
                next.splice(exists, 1);
                onExtraChange && onExtraChange(next);
                return;
            }
            // Vérifier si c'est la plage principale → on la remplace par un extra et on garde rien comme principal serait gênant
            if (sameDay(range.start, start) && sameDay(range.end, end))
                return;
            onExtraChange && onExtraChange([...extraRanges, { start, end }]);
        }
        else {
            onChange({ start, end });
            // Reset des extras quand on définit une nouvelle plage principale via raccourci/preset.
            onExtraChange && onExtraChange([]);
        }
        setPhase('start');
    };
    // Helper : début/fin de semaine ISO (lundi → dimanche) contenant la date d.
    const weekBounds = (d) => {
        const dow = (d.getDay() + 6) % 7;
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 6);
        return { start, end };
    };
    const handleDay = (d, ev) => {
        if (!d)
            return;
        const additive = ev && (ev.metaKey || ev.ctrlKey);
        if (mode === 'week') {
            const { start, end } = weekBounds(d);
            applyRange(start, end, additive);
            return;
        }
        // Mode jour : conserver le comportement existant (start puis end), MAIS
        // si Cmd/Ctrl est pressé et qu'on n'est pas en train de finir une plage,
        // on ajoute un jour seul comme nouvelle mini-plage extra.
        if (additive && phase === 'start') {
            applyRange(d, d, true);
            return;
        }
        if (phase === 'start' || !range.start || d < range.start) {
            onChange({ start: d, end: null });
            setPhase('end');
        }
        else {
            onChange({ start: range.start, end: d });
            setPhase('start');
        }
    };
    // Raccourcis dynamiques calculés depuis la date du jour.
    const today = new Date();
    const todayY = today.getFullYear();
    const startOfToday = new Date(todayY, today.getMonth(), today.getDate());
    const daysAgo = (n) => new Date(todayY, today.getMonth(), today.getDate() - n);
    const startOfMonth = new Date(todayY, today.getMonth(), 1);
    const startOfYear = new Date(todayY, 0, 1);
    const endOfYear = new Date(todayY, 11, 31);
    const quickPresets = [
        { l: '7 derniers jours', s: daysAgo(6), e: startOfToday },
        { l: '30 derniers jours', s: daysAgo(29), e: startOfToday },
        { l: 'Ce mois', s: startOfMonth, e: startOfToday },
        { l: 'Cette année', s: startOfYear, e: endOfYear },
    ];
    // Raccourcis liés à l'année visible.
    const yearPresets = [
        { l: `${y} complet`, s: `${y}-01-01`, e: `${y}-12-31`, full: true },
        { l: 'T1', s: `${y}-01-01`, e: `${y}-03-31` },
        { l: 'T2', s: `${y}-04-01`, e: `${y}-06-30` },
        { l: 'T3', s: `${y}-07-01`, e: `${y}-09-30` },
        { l: 'T4', s: `${y}-10-01`, e: `${y}-12-31` },
    ];
    const monthPresets = Array.from({ length: 12 }, (_, i) => ({
        l: MONTHS_FR[i].slice(0, 3),
        s: `${y}-${pad(i + 1)}-01`,
        e: `${y}-${pad(i + 1)}-${lastDay(y, i + 1)}`,
        isCurrent: i === mo
    }));
    // Sélection d'année entière en un clic depuis le sélecteur d'année.
    const setFullYear = (yr, additive) => {
        applyRange(new Date(yr, 0, 1), new Date(yr, 11, 31), additive);
        setVDate(new Date(yr, 0, 1));
    };
    // Sélection de mois entier en un clic depuis le sélecteur de mois.
    const setFullMonth = (m, additive) => {
        applyRange(new Date(y, m, 1), new Date(y, m, lastDay(y, m + 1)), additive);
        setVDate(new Date(y, m, 1));
    };
    return (React.createElement("div", null,
        React.createElement("div", { style: { display: 'flex', gap: 4, marginBottom: 12, padding: 4, background: 'var(--bg4)', borderRadius: 12 } }, [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année']].map(([k, lbl]) => (React.createElement("button", { key: k, onClick: () => setMode(k), style: {
                flex: 1, fontSize: 12, padding: '8px 0', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                borderRadius: 9, fontWeight: mode === k ? 700 : 600,
                background: mode === k ? '#fff' : 'transparent',
                color: mode === k ? 'var(--text)' : 'var(--text3)',
                boxShadow: mode === k ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all .12s'
            } }, lbl)))),
        mode === 'year' && (React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 10.5, color: 'var(--text3)', marginBottom: 8, textAlign: 'center' } }, "Clic = s\u00E9lectionner \u00B7 Cmd/Ctrl-clic = ajouter une p\u00E9riode suppl\u00E9mentaire"),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 } }, Array.from({ length: 20 }, (_, i) => todayY - 15 + i).map(yr => {
                // Une année est « principale » si la plage principale est exactement cette année.
                const isMain = range.start && range.end && range.start.getFullYear() === yr && range.end.getFullYear() === yr && range.start.getMonth() === 0 && range.end.getMonth() === 11 && range.start.getDate() === 1 && range.end.getDate() === 31;
                // « Extra » si une des plages additionnelles est exactement cette année.
                const isExtra = extraRanges.some(r => r.start && r.end && r.start.getFullYear() === yr && r.end.getFullYear() === yr && r.start.getMonth() === 0 && r.end.getMonth() === 11 && r.start.getDate() === 1 && r.end.getDate() === 31);
                const bg = isMain ? 'var(--red)' : isExtra ? 'var(--red-light)' : 'var(--bg4)';
                const fg = isMain ? '#fff' : isExtra ? 'var(--red)' : 'var(--text)';
                return (React.createElement("button", { key: yr, onClick: (ev) => setFullYear(yr, ev.metaKey || ev.ctrlKey), style: {
                        padding: '10px 0', fontSize: 13, fontWeight: isMain || isExtra ? 700 : 600,
                        background: bg, color: fg,
                        border: '1px solid ' + (isExtra ? 'var(--red)' : 'var(--border2)'), borderRadius: 8,
                        cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .1s'
                    } }, yr));
            })))),
        mode === 'month' && (React.createElement("div", null,
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 } },
                React.createElement("button", { onClick: () => setVDate(new Date(y - 1, 0, 1)), style: { background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 17, color: 'var(--text2)', padding: '2px 6px', lineHeight: 1 } }, "\u2039"),
                React.createElement("div", { style: { fontSize: 13, fontWeight: 600 } }, y),
                React.createElement("button", { onClick: () => setVDate(new Date(y + 1, 0, 1)), style: { background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 17, color: 'var(--text2)', padding: '2px 6px', lineHeight: 1 } }, "\u203A")),
            React.createElement("div", { style: { fontSize: 10.5, color: 'var(--text3)', marginBottom: 8, textAlign: 'center' } }, "Cmd/Ctrl-clic pour ajouter un mois suppl\u00E9mentaire en discontinu"),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 } }, MONTHS_FR.map((m, i) => {
                const isMonthRange = (r) => r && r.start && r.end && r.start.getFullYear() === y && r.start.getMonth() === i && r.start.getDate() === 1 && r.end.getFullYear() === y && r.end.getMonth() === i && r.end.getDate() === lastDay(y, i + 1);
                const isMain = isMonthRange(range);
                const isExtra = extraRanges.some(isMonthRange);
                const bg = isMain ? 'var(--red)' : isExtra ? 'var(--red-light)' : 'var(--bg4)';
                const fg = isMain ? '#fff' : isExtra ? 'var(--red)' : 'var(--text)';
                return (React.createElement("button", { key: i, onClick: (ev) => setFullMonth(i, ev.metaKey || ev.ctrlKey), style: {
                        padding: '10px 0', fontSize: 12, fontWeight: isMain || isExtra ? 700 : 600,
                        background: bg, color: fg,
                        border: '1px solid ' + (isExtra ? 'var(--red)' : 'var(--border2)'), borderRadius: 8,
                        cursor: 'pointer', fontFamily: 'var(--font)'
                    } }, m.slice(0, 3)));
            })))),
        (mode === 'day' || mode === 'week') && (React.createElement(React.Fragment, null,
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 } },
                React.createElement("button", { onClick: () => setVDate(new Date(y, mo - 1, 1)), style: { background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 17, color: 'var(--text2)', padding: '2px 6px', lineHeight: 1 } }, "\u2039"),
                React.createElement("div", { style: { display: 'flex', gap: 7, alignItems: 'center' } },
                    React.createElement("select", { value: mo, onChange: e => setVDate(new Date(y, +e.target.value, 1)), style: { fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, color: 'var(--text)',
                            background: 'var(--bg4)', border: 'none', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' } }, MONTHS_FR.map((m, i) => React.createElement("option", { key: i, value: i }, m))),
                    React.createElement("select", { value: y, onChange: e => setVDate(new Date(+e.target.value, mo, 1)), style: { fontFamily: 'var(--font)', fontSize: 13, fontWeight: 600, color: 'var(--text)',
                            background: 'var(--bg4)', border: 'none', borderRadius: 6, padding: '3px 7px', cursor: 'pointer' } }, Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 15 + i).map(yr => React.createElement("option", { key: yr, value: yr }, yr)))),
                React.createElement("button", { onClick: () => setVDate(new Date(y, mo + 1, 1)), style: { background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 17, color: 'var(--text2)', padding: '2px 6px', lineHeight: 1 } }, "\u203A")),
            React.createElement("div", { style: { fontSize: 11, color: 'var(--text2)', marginBottom: 8, textAlign: 'center', minHeight: 16 } },
                mode === 'week' ? 'Cliquer un jour pour sélectionner sa semaine' : (phase === 'start' ? 'Sélectionnez la date de début' : 'Sélectionnez la date de fin'),
                range.start && React.createElement("span", { style: { color: 'var(--red)', fontWeight: 600 } },
                    " \u00B7 ",
                    fmtDateShort(range.start)),
                range.end && React.createElement("span", { style: { color: 'var(--blue)', fontWeight: 600 } },
                    " \u2192 ",
                    fmtDateShort(range.end))),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 6, marginBottom: 6 } }, DAYS_FR.map((d, i) => React.createElement("div", { key: i, style: { textAlign: 'center', fontSize: 10.5, fontWeight: 700,
                    color: 'var(--text3)', padding: '2px 0' } }, d))),
            React.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 6 } }, cells.map((d, i) => {
                if (!d)
                    return React.createElement("div", { key: i });
                const isS = sameDay(d, range.start), isE = sameDay(d, range.end), mid = inRange(d);
                // Plages additionnelles : on teinte différemment pour distinguer.
                const inExtra = extraRanges.some(r => r.start && r.end && d >= r.start && d <= r.end);
                const isExtraEdge = extraRanges.some(r => r.start && r.end && (sameDay(d, r.start) || sameDay(d, r.end)));
                let bg = 'transparent', col = 'var(--text)', fw = 400;
                if (isS || isE) {
                    bg = 'var(--red)';
                    col = '#fff';
                    fw = 700;
                }
                else if (mid) {
                    bg = 'var(--red-light)';
                    col = 'var(--red)';
                }
                else if (isExtraEdge) {
                    bg = '#FECACA';
                    col = 'var(--red)';
                    fw = 700;
                }
                else if (inExtra) {
                    bg = '#FEE2E2';
                    col = 'var(--red)';
                }
                return (React.createElement("button", { key: i, onClick: (ev) => handleDay(d, ev), style: {
                        background: bg, color: col,
                        border: 'none', borderRadius: 999, padding: 0, height: 36, minWidth: 0, width: '100%', fontSize: 12.5,
                        fontWeight: fw, cursor: 'pointer', transition: 'background .1s', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box'
                    } }, d.getDate()));
            })))),
        extraRanges.length > 0 && (React.createElement("div", { style: { marginTop: 11, padding: '8px 10px', background: 'var(--red-light)', borderRadius: 8,
                border: '1px solid #FECACA' } },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 } },
                React.createElement("div", { style: { fontSize: 10, fontWeight: 600, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.8px' } },
                    extraRanges.length,
                    " p\u00E9riode",
                    extraRanges.length > 1 ? 's' : '',
                    " additionnelle",
                    extraRanges.length > 1 ? 's' : ''),
                React.createElement("button", { onClick: () => onExtraChange && onExtraChange([]), style: { background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 10, color: 'var(--red)', textDecoration: 'underline', fontFamily: 'var(--font)' } }, "tout effacer")),
            React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } }, extraRanges.map((r, idx) => (React.createElement("div", { key: idx, style: { fontSize: 10.5, padding: '3px 8px', borderRadius: 14, background: '#fff',
                    border: '1px solid #FECACA', color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 5 } },
                fmtDateShort(r.start),
                !sameDay(r.start, r.end) && ` → ${fmtDateShort(r.end)}`,
                React.createElement("button", { onClick: () => { const next = [...extraRanges]; next.splice(idx, 1); onExtraChange(next); }, style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 0,
                        fontSize: 13, lineHeight: 1, marginLeft: 2, fontFamily: 'var(--font)' } }, "\u00D7"))))))),
        React.createElement("div", { style: { marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 } },
            React.createElement("div", { style: { fontSize: 9.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase',
                    letterSpacing: '1px', marginBottom: 6 } }, "Raccourcis rapides"),
            React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 } }, quickPresets.map(({ l, s, e }) => (React.createElement("button", { key: l, onClick: () => { onChange({ start: s, end: e }); setPhase('start'); onClose(); }, style: { fontSize: 10.5, padding: '4px 9px', borderRadius: 20, background: 'var(--red-light)',
                    border: '1px solid transparent', color: 'var(--red)', cursor: 'pointer', fontFamily: 'var(--font)',
                    fontWeight: 600, transition: 'background .1s' } }, l)))),
            (mode === 'day' || mode === 'week') && (React.createElement(React.Fragment, null,
                React.createElement("div", { style: { fontSize: 9.5, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase',
                        letterSpacing: '1px', marginBottom: 6 } },
                    "Ann\u00E9e ",
                    y),
                React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 } }, yearPresets.map(({ l, s, e, full }) => (React.createElement("button", { key: l, onClick: () => { onChange({ start: new Date(s), end: new Date(e) }); setPhase('start'); onClose(); }, style: { fontSize: 10.5, padding: '3px 8px', borderRadius: 20,
                        background: full ? 'var(--bg)' : 'var(--bg4)',
                        border: '1px solid var(--border2)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)',
                        fontWeight: full ? 600 : 400, transition: 'background .1s' } }, l)))),
                React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } }, monthPresets.map(({ l, s, e, isCurrent }) => (React.createElement("button", { key: l, onClick: () => { onChange({ start: new Date(s), end: new Date(e) }); setPhase('start'); onClose(); }, style: { fontSize: 10.5, padding: '3px 8px', borderRadius: 20, background: 'var(--bg4)',
                        border: '1px solid ' + (isCurrent ? 'var(--red)' : 'var(--border2)'), color: 'var(--text2)',
                        cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .1s' } }, l))))))),
        range.start && range.end && (React.createElement("button", { onClick: onClose, style: { marginTop: 12, width: '100%', background: 'var(--red)', color: '#fff',
                border: 'none', borderRadius: 9, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' } },
            "Appliquer \u00B7 ",
            fmtDateShort(range.start),
            " \u2192 ",
            fmtDateShort(range.end)))));
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App, null));
