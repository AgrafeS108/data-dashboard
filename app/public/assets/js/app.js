(() => {
  'use strict';

  const CHANNELS = [
    { key: 'sport', label: 'SPORT', icon: '📺' },
    { key: 'francetv', label: 'france.tv', icon: '📺' },
    { key: 'franceinfo', label: 'franceinfo', icon: '🗞️' },
    { key: 'francetvculture', label: 'Culture', icon: '🎭' },
    { key: 'slash', label: 'Slash', icon: '⚡' }
  ];

  const state = {
    user: null,
    channel: 'sport',
    tab: 'figures',
    type: 'all',
    year: '',
    query: '',
    sport: '',
    competition: '',
    snapshot: null,
    videos: [],
    analytics: {},
    loading: false
  };

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n || 0));
  const fmtCompact = (n) => {
    const v = Number(n || 0);
    if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}Md`;
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return fmt(v);
  };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9#@]+/g, ' ').replace(/\s+/g, ' ').trim();
  const safe = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dateOf = (v) => v?.publishedAt ? new Date(v.publishedAt) : new Date(0);
  const yearOf = (v) => dateOf(v).getFullYear();
  const videoUrl = (v) => v?.url || (v?.id ? `https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}` : '#');
  const durationSeconds = (v) => Number(v?.durationSeconds || 0) || parseIsoDuration(v?.duration || '');
  const contentType = (v) => String(v?.contentType || v?.type || 'video').toLowerCase();
  const classif = (v) => ({
    sport: v?.sport || v?.classification?.sport || 'À vérifier',
    competition: v?.competition || v?.classification?.competition || 'Non classé',
    icon: v?.classification?.icon || '•',
    confidence: v?.classification?.confidence || 'low',
    score: Number(v?.classification?.score || 0),
    source: v?.classification?.source || 'stored'
  });

  function parseIsoDuration(value) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(String(value || ''));
    return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
  }
  function fmtDuration(seconds) {
    const s = Math.max(0, Math.round(Number(seconds || 0)));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h) return `${h}h${String(m).padStart(2, '0')}`;
    if (m) return `${m}:${String(sec).padStart(2, '0')}`;
    return `${sec}s`;
  }
  function showLoader(message) { $('loader').hidden = false; $('loader').querySelector('p').textContent = message || 'Chargement…'; }
  function hideLoader() { $('loader').hidden = true; }
  function banner(message, type = 'warn') {
    const el = $('statusBanner');
    if (!message) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = message;
    el.style.background = type === 'error' ? '#ffe8ea' : '#fff7ed';
    el.style.color = type === 'error' ? '#b00020' : '#7c2d12';
  }
  async function api(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 90000);
    try {
      const res = await fetch(path, { cache: 'no-store', credentials: 'same-origin', ...options, signal: controller.signal, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || data.message || `Erreur ${res.status}`);
      return data;
    } finally { clearTimeout(timer); }
  }

  async function init() {
    bindEvents();
    showLoader('Vérification de la session…');
    try {
      const me = await api('/api/auth-me', { timeout: 20000 });
      state.user = me.user;
      $('loginScreen').hidden = true;
      $('app').hidden = false;
      await loadChannel(state.channel);
    } catch (e) {
      hideLoader();
      $('app').hidden = true;
      $('loginScreen').hidden = false;
      $('loginMessage').textContent = 'Connecte-toi pour accéder au dashboard.';
    }
  }

  function bindEvents() {
    $('loginForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      $('loginMessage').textContent = 'Connexion…';
      $('loginMessage').className = 'form-message';
      try {
        await api('/api/auth-login', { method: 'POST', body: JSON.stringify({ email: $('loginEmail').value.trim(), password: $('loginPassword').value }) });
        $('loginScreen').hidden = true;
        $('app').hidden = false;
        await loadChannel(state.channel);
      } catch (e) {
        $('loginMessage').textContent = e.message;
        $('loginMessage').className = 'form-message err';
      }
    });
    $('logoutBtn').addEventListener('click', async () => { try { await api('/api/auth-logout', { method: 'POST' }); } catch(e) {} location.reload(); });
    $('menuBtn').addEventListener('click', () => document.querySelector('.sidebar').classList.toggle('open'));
    $('tabs').addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-tab]'); if (!btn) return;
      state.tab = btn.dataset.tab;
      document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${state.tab}`));
      renderCurrentTab();
    });
    $('typeFilter').addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-type]'); if (!btn) return;
      state.type = btn.dataset.type;
      [...$('typeFilter').querySelectorAll('button')].forEach(b => b.classList.toggle('active', b === btn));
      renderAll();
    });
    $('searchInput').addEventListener('input', debounce(() => { state.query = $('searchInput').value; renderAll(); }, 120));
    $('yearSelect').addEventListener('change', () => { state.year = $('yearSelect').value; state.sport = ''; state.competition = ''; renderAll(); });
    $('exportBtn').addEventListener('click', exportCsv);
    $('forecastBtn').addEventListener('click', generateForecast);
    $('copilotBtn').addEventListener('click', generateCopilot);
    $('compareA').addEventListener('change', renderComparison);
    $('compareB').addEventListener('change', renderComparison);
  }
  function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

  async function loadChannel(channel) {
    state.channel = channel;
    state.sport = '';
    state.competition = '';
    banner('');
    showLoader(`Lecture des données admin ${channel}…`);
    renderChannels();
    try {
      const data = await api(`/api/dashboard-data?channel=${encodeURIComponent(channel)}&_=${Date.now()}`, { timeout: 120000 });
      state.snapshot = data;
      state.videos = normalizeVideos(data.videos || []);
      setupYears();
      await loadAnalytics(channel);
      renderAll();
      hideLoader();
    } catch (e) {
      hideLoader();
      banner(`${e.message}. Lance un refresh dans la console admin si aucune donnée n'est stockée.`, 'error');
      state.snapshot = null; state.videos = [];
      renderAll();
    }
  }
  function normalizeVideos(videos) {
    return (videos || []).map(v => ({ ...v, contentType: contentType(v), type: contentType(v), durationSeconds: durationSeconds(v) }));
  }
  async function loadAnalytics(channel) {
    state.analytics = {};
    const scopes = ['ytd', 'traffic', 'devices', 'countries'];
    await Promise.all(scopes.map(async scope => {
      try { state.analytics[scope] = await api(`/api/analytics-store?channel=${encodeURIComponent(channel)}&scope=${scope}&_=${Date.now()}`, { timeout: 45000 }); }
      catch (e) { state.analytics[scope] = { ok: false, error: e.message }; }
    }));
  }
  function setupYears() {
    const years = [...new Set(state.videos.map(yearOf).filter(y => y > 2005 && y < 2100))].sort((a,b) => b - a);
    const latest = years[0] || new Date().getFullYear();
    if (!years.includes(Number(state.year))) state.year = String(latest);
    $('yearSelect').innerHTML = years.map(y => `<option value="${y}" ${String(y) === state.year ? 'selected' : ''}>${y}</option>`).join('') || `<option>${latest}</option>`;
  }
  function renderChannels() {
    $('channelList').innerHTML = CHANNELS.map(ch => `<button class="channel-item ${ch.key === state.channel ? 'active' : ''}" data-channel="${ch.key}"><span class="channel-icon">${ch.icon}</span><b>${safe(ch.label)}</b><span>ouvrir</span></button>`).join('');
    $('channelList').querySelectorAll('button').forEach(btn => btn.onclick = () => loadChannel(btn.dataset.channel));
    const ch = CHANNELS.find(c => c.key === state.channel) || CHANNELS[0];
    $('channelTitle').textContent = ch.label;
  }
  function filteredVideos({ ignoreSelection = false } = {}) {
    const y = Number(state.year);
    const tokens = norm(state.query).split(' ').filter(Boolean);
    return state.videos.filter(v => {
      if (Number.isFinite(y) && yearOf(v) !== y) return false;
      const t = contentType(v);
      if (state.type !== 'all' && t !== state.type) return false;
      const c = classif(v);
      if (!ignoreSelection && state.sport && c.sport !== state.sport) return false;
      if (!ignoreSelection && state.competition && c.competition !== state.competition) return false;
      if (tokens.length) {
        const index = norm([v.title, v.id, c.sport, c.competition, t, Array.isArray(v.tags) ? v.tags.join(' ') : ''].join(' '));
        if (!tokens.every(tok => index.includes(tok))) return false;
      }
      return true;
    }).sort((a,b) => Number(b.views || 0) - Number(a.views || 0));
  }
  function buildGroups(videos) {
    const groups = new Map();
    for (const v of videos) {
      const c = classif(v);
      const sport = c.sport || 'À vérifier';
      const comp = c.competition || 'Non classé';
      if (!groups.has(sport)) groups.set(sport, { name: sport, icon: c.icon, views: 0, duration: 0, videos: 0, shorts: 0, lives: 0, competitions: new Map() });
      const g = groups.get(sport);
      if (!g.competitions.has(comp)) g.competitions.set(comp, { name: comp, views: 0, duration: 0, videos: 0, shorts: 0, lives: 0, items: [] });
      const cp = g.competitions.get(comp);
      const views = Number(v.views || 0), dur = durationSeconds(v), type = contentType(v);
      g.views += views; g.duration += dur; g[type === 'short' ? 'shorts' : type === 'live' ? 'lives' : 'videos'] += 1;
      cp.views += views; cp.duration += dur; cp[type === 'short' ? 'shorts' : type === 'live' ? 'lives' : 'videos'] += 1; cp.items.push(v);
    }
    groups.forEach(g => { g.total = g.videos + g.shorts + g.lives; g.competitions = [...g.competitions.values()].sort((a,b) => b.views - a.views); });
    return [...groups.values()].sort((a,b) => b.views - a.views);
  }
  function totals(videos) {
    return videos.reduce((a,v) => { const type = contentType(v); a.views += Number(v.views || 0); a.duration += durationSeconds(v); a.count++; a[type === 'short' ? 'shorts' : type === 'live' ? 'lives' : 'videos']++; return a; }, { count: 0, views: 0, duration: 0, videos: 0, shorts: 0, lives: 0 });
  }
  function renderAll() {
    const allYear = filteredVideos({ ignoreSelection: true });
    const selected = filteredVideos();
    renderKpis(allYear, selected);
    renderSidebar(allYear);
    renderTaxonomy(allYear);
    renderFigures(selected, allYear);
    renderCurrentTab();
  }
  function renderCurrentTab() {
    if (state.tab === 'graphs') renderGraphs();
    if (state.tab === 'forecast') renderForecastSaved();
    if (state.tab === 'copilot') renderCopilot();
    if (state.tab === 'analytics') renderAnalytics();
  }
  function renderKpis(allYear) {
    const t = totals(allYear);
    $('countAll').textContent = fmt(t.count); $('countVideo').textContent = fmt(t.videos); $('countShort').textContent = fmt(t.shorts); $('countLive').textContent = fmt(t.lives);
    $('kpiGrid').innerHTML = [
      ['Vues totales', fmtCompact(t.views), `${fmt(t.count)} contenus`, '#dde3eb'],
      ['Durée totale', fmtDuration(t.duration), 'contenus cumulés', '#7438c2'],
      ['Vidéos', fmt(t.videos), 'formats longs', '#0b3f7a'],
      ['Shorts', fmt(t.shorts), 'formats courts', '#8a3d00'],
      ['Lives', fmt(t.lives), 'directs', '#126b34']
    ].map(([a,b,c,color]) => `<div class="kpi" style="--accent:${color}"><label>${a}</label><b>${b}</b><span>${c}</span></div>`).join('');
  }
  function renderSidebar(videos) {
    const t = totals(videos);
    $('sidebarViews').textContent = fmtCompact(t.views); $('sidebarVideos').textContent = fmt(t.videos); $('sidebarShorts').textContent = fmt(t.shorts); $('sidebarLives').textContent = fmt(t.lives);
  }
  function renderTaxonomy(videos) {
    const groups = buildGroups(videos);
    const totalViews = Math.max(1, groups.reduce((s,g) => s + g.views, 0));
    $('taxonomyList').innerHTML = groups.map(g => {
      const active = g.name === state.sport;
      const comps = active ? `<div class="comp-list">${g.competitions.map(c => `<button class="comp-button ${state.competition === c.name ? 'active' : ''}" data-sport="${safe(g.name)}" data-comp="${safe(c.name)}"><span>${safe(c.name)}</span><b>${fmtCompact(c.views)}</b></button>`).join('')}</div>` : '';
      return `<button class="taxonomy-card ${active ? 'active' : ''}" data-sport="${safe(g.name)}"><div class="taxonomy-card-head"><h3>${safe(g.icon || '•')} ${safe(g.name)}</h3><b>${fmtCompact(g.views)}</b></div><small>${fmt(g.total)} contenus · ${fmt(g.videos)} vidéos · ${fmt(g.shorts)} shorts</small><div class="bar"><i style="width:${Math.round(g.views / totalViews * 100)}%"></i></div></button>${comps}`;
    }).join('') || '<div class="muted">Aucune donnée sur cette période.</div>';
    $('taxonomyList').querySelectorAll('.taxonomy-card').forEach(btn => btn.onclick = () => { state.sport = state.sport === btn.dataset.sport ? '' : btn.dataset.sport; state.competition = ''; renderAll(); });
    $('taxonomyList').querySelectorAll('.comp-button').forEach(btn => btn.onclick = (ev) => { ev.stopPropagation(); state.sport = btn.dataset.sport; state.competition = state.competition === btn.dataset.comp ? '' : btn.dataset.comp; renderAll(); });
  }
  function renderFigures(videos) {
    const title = state.competition || state.sport || 'Tous les contenus';
    const t = totals(videos);
    $('selectionHeader').innerHTML = `<div><h1>${safe(title)}</h1><p>${fmt(t.count)} contenus affichés · ${fmt(t.videos)} vidéos · ${fmt(t.shorts)} shorts · ${fmtCompact(t.views)} vues</p></div><div class="selection-stats"><span>${fmtCompact(t.views)}<small>vues</small></span><span>${fmtDuration(t.duration)}<small>durée</small></span><span>${t.count ? fmt(Math.round(t.views / t.count)) : '0'}<small>moy./vidéo</small></span></div>`;
    $('videoRows').innerHTML = videos.slice(0, 1200).map(v => {
      const c = classif(v); const type = contentType(v); const conf = String(c.confidence || 'low').toLowerCase();
      return `<tr title="source: ${safe(c.source)} · score: ${safe(c.score)}"><td><span class="type-pill ${type}">${type === 'short' ? 'SHORT' : type === 'live' ? 'LIVE' : 'VID'}</span></td><td><a class="video-title" href="${videoUrl(v)}" target="_blank" rel="noreferrer">${safe(v.title)}</a></td><td>${safe(c.sport)}</td><td>${safe(c.competition)}</td><td>${dateOf(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</td><td>${fmtDuration(durationSeconds(v))}</td><td><b>${fmt(v.views)}</b></td><td><span class="confidence ${conf}">${safe(conf)}</span></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="muted">Aucune vidéo ne correspond aux filtres.</td></tr>';
  }
  function renderGraphs() {
    const videos = filteredVideos({ ignoreSelection: true });
    const groups = buildGroups(videos);
    renderBars('sportChart', groups.map(g => ({ label: g.name, value: g.views })), 'vues');
    const comps = groups.flatMap(g => g.competitions.map(c => ({ label: `${g.name} · ${c.name}`, value: c.views }))).sort((a,b) => b.value - a.value).slice(0, 25);
    renderBars('competitionChart', comps, 'vues');
    const t = totals(videos);
    renderBars('typeChart', [{ label: 'Vidéos', value: t.videos }, { label: 'Shorts', value: t.shorts }, { label: 'Lives', value: t.lives }], 'contenus');
  }
  function renderBars(id, rows, suffix) {
    const max = Math.max(1, ...rows.map(r => r.value));
    $(id).innerHTML = rows.slice(0, 30).map(r => `<div class="bar-row"><div class="bar-label">${safe(r.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, r.value / max * 100)}%"></div></div><div class="bar-value">${fmtCompact(r.value)} ${suffix || ''}</div></div>`).join('') || '<div class="muted">Aucune donnée.</div>';
  }
  function forecastKey() { return `ftv_forecast_${state.channel}_${state.year}_${state.type}_${norm(state.query)}`; }
  function renderForecastSaved() { $('forecastOutput').textContent = localStorage.getItem(forecastKey()) || 'Aucune prévision générée pour cette sélection.'; }
  async function generateForecast() {
    const videos = filteredVideos(); const groups = buildGroups(videos).slice(0, 20); const t = totals(videos);
    const prompt = `Tu es consultant senior YouTube et média. Fais une prévision n+1 pour la chaîne ${state.channel}, période ${state.year}. Données: ${t.count} contenus, ${t.videos} vidéos, ${t.shorts} shorts, ${t.views} vues. Détail par catégorie: ${JSON.stringify(groups.map(g => ({ categorie:g.name, vues:g.views, contenus:g.total, competitions:g.competitions.slice(0,8).map(c=>({nom:c.name,vues:c.views,contenus:c.items.length})) }))).slice(0,12000)}. Réponds en français, structuré, sans inventer de chiffres.`;
    $('forecastOutput').textContent = 'Claude analyse les données…';
    try { const data = await api('/api/claude', { method: 'POST', timeout: 120000, body: JSON.stringify({ prompt, withWeb: false }) }); const text = extractClaudeText(data); localStorage.setItem(forecastKey(), text); $('forecastOutput').textContent = text; }
    catch (e) { $('forecastOutput').textContent = e.message; }
  }
  function renderCopilot() {
    const videos = filteredVideos({ ignoreSelection: true }); const groups = buildGroups(videos); const comps = groups.flatMap(g => g.competitions.map(c => ({ key: `${g.name}|||${c.name}`, label: `${g.name} · ${c.name}`, ...c, sport: g.name }))).sort((a,b) => b.views - a.views).slice(0, 80);
    $('compareA').innerHTML = comps.map(c => `<option value="${safe(c.key)}">${safe(c.label)}</option>`).join('');
    $('compareB').innerHTML = comps.map((c,i) => `<option value="${safe(c.key)}" ${i===1?'selected':''}>${safe(c.label)}</option>`).join('');
    const alerts = buildAlerts(groups, videos);
    $('alertList').innerHTML = alerts.map(a => `<div class="insight"><b>${safe(a.title)}</b><span>${safe(a.text)}</span></div>`).join('') || '<div class="muted">Aucune alerte forte.</div>';
    renderComparison();
  }
  function buildAlerts(groups, videos) {
    const alerts = [];
    const t = totals(videos);
    if (t.shorts > t.videos * 2) alerts.push({ title: 'Mix très orienté Shorts', text: `${fmt(t.shorts)} shorts contre ${fmt(t.videos)} vidéos. Vérifier si les formats longs sont assez représentés dans les compétitions clés.` });
    groups.slice(0, 10).forEach(g => { const avg = g.total ? g.views / g.total : 0; if (g.shorts > 20 && avg < (t.views / Math.max(1,t.count)) * 0.55) alerts.push({ title: `Rendement faible : ${g.name}`, text: `Beaucoup de contenus, mais moyenne par vidéo sous la moyenne globale.` }); });
    const uncertain = videos.filter(v => /low|fallback|review/i.test(String(v.classification?.confidence || v.classification?.source || ''))).length;
    if (uncertain) alerts.push({ title: 'Classification à vérifier', text: `${fmt(uncertain)} contenus ont une confiance faible. Ils doivent être revus côté admin avant analyse définitive.` });
    return alerts.slice(0, 8);
  }
  function renderComparison() {
    const videos = filteredVideos({ ignoreSelection: true }); const comps = buildGroups(videos).flatMap(g => g.competitions.map(c => ({ key: `${g.name}|||${c.name}`, label: `${g.name} · ${c.name}`, ...c, sport: g.name })));
    const a = comps.find(c => c.key === $('compareA').value); const b = comps.find(c => c.key === $('compareB').value);
    if (!a || !b) { $('compareOutput').innerHTML = '<div class="muted">Sélectionne deux évènements.</div>'; return; }
    const avgA = a.items.length ? a.views / a.items.length : 0, avgB = b.items.length ? b.views / b.items.length : 0;
    $('compareOutput').innerHTML = [a,b].map(c => `<div class="insight"><b>${safe(c.label)}</b><span>${fmtCompact(c.views)} vues · ${fmt(c.items.length)} contenus · ${fmt(Math.round(c.views / Math.max(1,c.items.length)))} vues/contenu</span></div>`).join('') + `<div class="insight"><b>Lecture rapide</b><span>${avgA >= avgB ? safe(a.label) : safe(b.label)} obtient la meilleure moyenne par contenu.</span></div>`;
  }
  async function generateCopilot() {
    const videos = filteredVideos({ ignoreSelection: true }); const groups = buildGroups(videos).slice(0, 15); const alerts = buildAlerts(groups, videos);
    const prompt = `Analyse opérationnelle YouTube pour ${state.channel}, année ${state.year}. Donne des conseils concrets de programmation, éditorial et publication. Données: ${JSON.stringify({ totals: totals(videos), groupes: groups.map(g => ({ nom:g.name, vues:g.views, contenus:g.total, videos:g.videos, shorts:g.shorts, competitions:g.competitions.slice(0,8).map(c=>({nom:c.name,vues:c.views,contenus:c.items.length,shorts:c.shorts,videos:c.videos})) })), alertes: alerts }).slice(0,14000)}. Réponds sans inventer de chiffres.`;
    $('copilotOutput').textContent = 'Claude prépare les recommandations…';
    try { const data = await api('/api/claude', { method: 'POST', timeout: 120000, body: JSON.stringify({ prompt, withWeb: false }) }); $('copilotOutput').textContent = extractClaudeText(data); }
    catch (e) { $('copilotOutput').textContent = e.message; }
  }
  function extractClaudeText(data) {
    if (typeof data?.content === 'string') return data.content;
    if (Array.isArray(data?.content)) return data.content.map(p => p.text || '').filter(Boolean).join('\n\n') || JSON.stringify(data, null, 2);
    return JSON.stringify(data, null, 2);
  }
  function renderAnalytics() {
    const cards = [];
    cards.push(analyticsCard('Évolution quotidienne', state.analytics.ytd));
    cards.push(analyticsCard('Sources de trafic', state.analytics.traffic));
    cards.push(analyticsCard('Appareils', state.analytics.devices));
    cards.push(analyticsCard('Pays', state.analytics.countries));
    $('analyticsGrid').innerHTML = cards.join('');
  }
  function analyticsCard(title, wrapper) {
    const payload = wrapper?.payload || wrapper;
    if (!payload || payload.error || !Array.isArray(payload.rows)) return `<article class="card"><h2>${safe(title)}</h2><div class="muted">${safe(wrapper?.error || 'Aucune donnée Analytics stockée.')}</div></article>`;
    const cols = (payload.columnHeaders || []).map(c => c.name);
    const rows = payload.rows.slice(0, 40).map(row => Object.fromEntries(cols.map((c,i) => [c, row[i]])));
    const firstDim = cols[0] || 'dimension';
    const metric = cols.includes('views') ? 'views' : cols[1];
    const bars = rows.map(r => ({ label: String(r[firstDim]), value: Number(r[metric] || 0) })).sort((a,b) => b.value - a.value).slice(0, 15);
    const max = Math.max(1, ...bars.map(b => b.value));
    return `<article class="card"><h2>${safe(title)}</h2><div class="bar-chart">${bars.map(b => `<div class="bar-row"><div class="bar-label">${safe(b.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(2,b.value/max*100)}%"></div></div><div class="bar-value">${fmtCompact(b.value)}</div></div>`).join('')}</div></article>`;
  }
  function exportCsv() {
    const rows = filteredVideos().map(v => { const c = classif(v); return { type: contentType(v), titre: v.title, sport: c.sport, competition: c.competition, date: v.publishedAt, duree_secondes: durationSeconds(v), vues: v.views, url: videoUrl(v), confiance: c.confidence, source: c.source }; });
    const cols = Object.keys(rows[0] || { type:'', titre:'', sport:'', competition:'', date:'', duree_secondes:'', vues:'', url:'', confiance:'' });
    const csv = '\uFEFF' + [cols.join(';'), ...rows.map(r => cols.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ftv-${state.channel}-${state.year}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  init();
})();
