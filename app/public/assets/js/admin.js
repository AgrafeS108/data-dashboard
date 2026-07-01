(() => {
  'use strict';
  const CHANNELS = [
    ['sport', 'SPORT'], ['francetv', 'france.tv'], ['franceinfo', 'franceinfo'], ['francetvculture', 'Culture'], ['slash', 'Slash']
  ];
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat('fr-FR').format(Number(n || 0));
  const safe = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function showLoader(msg) { $('loader').hidden = false; $('loader').querySelector('p').textContent = msg || 'Chargement…'; }
  function hideLoader() { $('loader').hidden = true; }
  function log(data) { $('adminLogs').textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); }
  async function api(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 120000);
    try {
      const res = await fetch(path, { cache:'no-store', credentials:'same-origin', ...options, signal:controller.signal, headers:{ 'content-type':'application/json', ...(options.headers || {}) } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || data.message || `Erreur ${res.status}`);
      return data;
    } finally { clearTimeout(timer); }
  }
  async function init() {
    bind();
    showLoader('Vérification admin…');
    try { await loadStatus(); $('adminLogin').hidden = true; $('adminApp').hidden = false; }
    catch(e) { $('adminApp').hidden = true; $('adminLogin').hidden = false; $('adminLoginMessage').textContent = 'Connexion admin requise.'; }
    hideLoader();
  }
  function bind() {
    $('adminLoginForm').addEventListener('submit', async ev => {
      ev.preventDefault();
      $('adminLoginMessage').textContent = 'Connexion…'; $('adminLoginMessage').className = 'form-message';
      try { await api('/api/admin-login', { method:'POST', body:JSON.stringify({ password:$('adminPassword').value }) }); $('adminLogin').hidden = true; $('adminApp').hidden = false; await loadStatus(); }
      catch(e) { $('adminLoginMessage').textContent = e.message; $('adminLoginMessage').className = 'form-message err'; }
    });
    $('adminLogout').addEventListener('click', async () => { try { await api('/api/admin-logout', { method:'POST' }); } catch(e) {} location.reload(); });
    $('adminRefreshStatus').addEventListener('click', loadStatus);
    $('refreshAll').addEventListener('click', () => refreshChannel('all'));
  }
  async function loadStatus() {
    showLoader('Lecture du centre de contrôle…');
    const status = await api('/api/admin-status', { timeout:30000 });
    $('adminStatus').innerHTML = renderEnv(status);
    await loadSnapshots();
    hideLoader();
    log(status);
  }
  function renderEnv(status) {
    const env = status.env || {};
    const ok = Object.values(env).filter(Boolean).length;
    const total = Object.values(env).length || 1;
    return `<b>Admin opérationnel</b> · variables OK ${ok}/${total} · ${new Date().toLocaleString('fr-FR')}`;
  }
  async function loadSnapshots() {
    const rows = await Promise.all(CHANNELS.map(async ([key,label]) => {
      try { const data = await api(`/api/admin-snapshot?channel=${encodeURIComponent(key)}&_=${Date.now()}`, { timeout:90000 }); return { key, label, ok:true, data }; }
      catch(e) { return { key, label, ok:false, error:e.message }; }
    }));
    $('snapshotCards').innerHTML = rows.map(r => {
      const vids = r.data?.videos || [];
      const bad = vids.filter(v => /low|fallback|review|verifier|vérifier/i.test(String(v.classification?.confidence || v.classification?.source || v.sport || ''))).length;
      return `<div class="snapshot-card"><b>${r.ok ? fmt(vids.length) : '—'}</b><span>${safe(r.label)}</span><span>${r.ok ? `MAJ ${safe((r.data.storedUpdatedAt || r.data.generatedAt || '').slice(0,16).replace('T',' '))}` : safe(r.error)}</span><span>${bad ? `${fmt(bad)} à vérifier` : 'classification OK'}</span></div>`;
    }).join('');
    $('channelActions').innerHTML = CHANNELS.map(([key,label]) => `<button data-channel="${key}">Actualiser ${safe(label)}</button>`).join('');
    $('channelActions').querySelectorAll('button').forEach(b => b.onclick = () => refreshChannel(b.dataset.channel));
    renderQuality(rows);
    renderReviewQueue(rows);
  }
  function renderQuality(rows) {
    const insights = [];
    rows.forEach(r => {
      if (!r.ok) { insights.push({ title:`${r.label} indisponible`, text:r.error }); return; }
      const videos = r.data?.videos || [];
      const missing = videos.filter(v => !v.sport || !v.competition || !v.contentType).length;
      const low = videos.filter(v => /low|fallback|review|verifier|vérifier/i.test(String(v.classification?.confidence || v.classification?.source || ''))).length;
      const shorts = videos.filter(v => String(v.contentType || v.type) === 'short').length;
      insights.push({ title:r.label, text:`${fmt(videos.length)} contenus · ${fmt(shorts)} shorts · ${fmt(low)} confiance faible · ${fmt(missing)} champs manquants` });
    });
    $('qualityPanel').innerHTML = insights.map(i => `<div class="insight"><b>${safe(i.title)}</b><span>${safe(i.text)}</span></div>`).join('');
  }

  function reviewReason(video) {
    const reasons = [];
    const cls = video.classification || {};
    if (!video.sport || !video.competition || !video.contentType) reasons.push('champ manquant');
    if (/low|fallback|review|verifier|vérifier/i.test(String(cls.confidence || cls.source || video.sport || ''))) reasons.push('confiance faible');
    if (video.sport && cls.sport && video.sport !== cls.sport) reasons.push('sport contradictoire');
    if (video.competition && cls.competition && video.competition !== cls.competition) reasons.push('compétition contradictoire');
    if (video.contentType && video.type && video.contentType !== video.type) reasons.push('type contradictoire');
    return reasons;
  }
  function renderReviewQueue(rows) {
    const items = [];
    rows.forEach(r => {
      if (!r.ok) return;
      (r.data?.videos || []).forEach(v => {
        const reasons = reviewReason(v);
        if (reasons.length) items.push({ channel:r.label, title:v.title || v.id || 'Sans titre', type:v.contentType || v.type || '—', sport:v.sport || v.classification?.sport || '—', comp:v.competition || v.classification?.competition || '—', confidence:v.classification?.confidence || '—', source:v.classification?.source || '—', reasons:reasons.join(', '), url:v.url || (v.id ? `https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}` : '#') });
      });
    });
    $('reviewQueue').innerHTML = items.slice(0, 80).map(v => `<div class="review-item"><div><b><a href="${safe(v.url)}" target="_blank" rel="noopener">${safe(v.title)}</a></b><span>${safe(v.channel)} · ${safe(v.type)} · ${safe(v.sport)} / ${safe(v.comp)}</span></div><div><strong>${safe(v.reasons)}</strong><span>${safe(v.confidence)} · ${safe(v.source)}</span></div></div>`).join('') || '<div class="insight"><b>Aucune vidéo à vérifier</b><span>Toutes les vidéos ont les champs minimum attendus et aucune contradiction stockée.</span></div>';
  }

  async function refreshChannel(channel) {
    showLoader(channel === 'all' ? 'Actualisation de toutes les chaînes…' : `Actualisation ${channel}…`);
    try {
      const data = await api('/api/admin-refresh-data', { method:'POST', timeout:260000, body:JSON.stringify({ channel }) });
      log(data);
      await loadSnapshots();
    } catch(e) { log(e.stack || e.message); }
    hideLoader();
  }
  init();
})();
