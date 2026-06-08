const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { classifyVideoForSnapshot, classifySnapshot, CLASSIFICATION_PROFILE } = require('../api/classification-runtime');

function loadTaxonomies(){
  return JSON.parse(fs.readFileSync(path.join(__dirname,'../api/classification-taxonomy.json'),'utf8'));
}
function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/#[a-z0-9_]+/g,m=>m).replace(/[^a-z0-9#]+/g,' ').trim(); }
function key(s){ return norm(s).replace(/\s+/g,''); }
function video(title, channel='sport', seconds=90, extras={}){ return { id:Buffer.from(channel+title).toString('base64url').slice(0,20), channelKey:channel, title, description:'', tags:[], views:100, duration:`PT${Math.floor(seconds/60)}M${seconds%60}S`, durationSeconds:seconds, publishedAt:'2026-06-01T10:00:00Z', ...extras }; }
function check(title, channel, expectedSport, expectedComp, seconds=90, expectedType){
  const out = classifyVideoForSnapshot(video(title, channel, seconds));
  assert.strictEqual(out.sport, expectedSport, `${title} => sport ${out.sport}, expected ${expectedSport}`);
  if (expectedComp) assert.strictEqual(out.competition, expectedComp, `${title} => comp ${out.competition}, expected ${expectedComp}`);
  if (expectedType) assert.strictEqual(out.contentType, expectedType, `${title} => type ${out.contentType}, expected ${expectedType}`);
  assert.strictEqual(out.classification.profile, CLASSIFICATION_PROFILE, `${title} classification profile`);
  return out;
}

const curated = [
  ['🏉 #InvestecChampionsCup | La qualif de Toulon sur un fil !','sport','Rugby','Champions Cup',78,'short'],
  ['🎾 #RolandGarros | Sinner donne rendez-vous au 2ème tour','sport','Tennis','Roland-Garros',65,'short'],
  ['Roland-Garros 2026 : Diane Parry en huitième de finale','sport','Tennis','Roland-Garros',410,'video'],
  ['⛷️ Mikaela Shiffrin remporte la Coupe du Monde de ski alpin','sport','Ski & Hiver','Ski Alpin — Coupe du Monde',58,'short'],
  ['⚽ Ligue des champions : le résumé du match','sport','Football','Ligue des Champions',310,'video'],
  ['Tour de France : Pogacar attaque dans le dernier col','sport','Cyclisme','Tour de France',180,'video'],
  ['Léon Marchand bat un record aux Mondiaux de natation','sport','Natation','Championnats du Monde',92,'short'],
  ['NBA : Victor Wembanyama affole les compteurs','sport','Basket-ball','NBA',72,'short'],
  ['Volley-ball Ligue des Nations : les Bleus s’imposent','sport','Volley-ball','Ligue des Nations',220,'video'],
  ['Gymnastique artistique : finale femmes aux championnats du monde','sport','Gymnastique','Gymnastique artistique',190,'video'],
  ['Emmanuel Macron reçoit les ministres à l’Élysée','franceinfo','Actualité politique','Gouvernement / Élysée',120,'short'],
  ['Festival de Cannes : montée des marches','francetvculture','Cinéma & audiovisuel','Cannes / festivals',120,'short'],
  ['Skam France : les coulisses de la série','slash','Séries & fictions Slash','SKAM France',120,'short']
];
for (const c of curated) check(...c);

const polluted = classifyVideoForSnapshot(video('🎿 #milanocortina2026 | descente femmes en folie #shorts', 'sport', 52, { description:'tennis roland garros atp wta', tags:['tennis','roland garros'] }));
assert.strictEqual(polluted.sport, 'Ski & Hiver');
assert.strictEqual(polluted.contentType, 'short');
const rugbyPolluted = classifyVideoForSnapshot(video('🏉 #InvestecChampionsCup | Toulon sur un fil', 'sport', 78, { description:'Roland Garros tennis atp wta', tags:['tennis'] }));
assert.strictEqual(rugbyPolluted.sport, 'Rugby');
assert.strictEqual(rugbyPolluted.competition, 'Champions Cup');
const tennisPolluted = classifyVideoForSnapshot(video('🎾 #RolandGarros | échange fou sur le Lenglen', 'sport', 62, { description:'rugby top 14 champions cup', tags:['rugby','top 14'] }));
assert.strictEqual(tennisPolluted.sport, 'Tennis');
assert.strictEqual(tennisPolluted.competition, 'Roland-Garros');
assert.strictEqual(tennisPolluted.contentType, 'short');

const taxonomies = loadTaxonomies();
let themeTests = 0, uniqueTermTests = 0, auditedTerms = 0, ambiguousTerms = 0;
const termOwners = new Map();
for (const [channel, catalog] of Object.entries(taxonomies)) {
  for (const theme of catalog) {
    const add = (term, comp, kind) => {
      const k = key(term); if (!k || k.length < 4 || /^\d+$/.test(k)) return;
      const arr = termOwners.get(`${channel}:${k}`) || [];
      arr.push({ channel, theme:theme.s, comp:comp?.n || theme.s, term, kind });
      termOwners.set(`${channel}:${k}`, arr); auditedTerms++;
    };
    add(theme.s, null, 'theme');
    for (const t of [...(theme.strong||[]), ...(theme.medium||[])]) add(t, null, 'theme-term');
    for (const comp of (theme.comps||[])) {
      add(comp.n, comp, 'comp-name');
      for (const t of [...(comp.strong||[]), ...(comp.medium||[])]) add(t, comp, 'comp-term');
    }
  }
}
for (const [channel, catalog] of Object.entries(taxonomies)) {
  for (const theme of catalog) {
    const out = classifyVideoForSnapshot(video(`${theme.s} actualité analyse`, channel, 185));
    assert.strictEqual(out.sport, theme.s, `${channel}/${theme.s} exact theme failed: ${out.sport}`);
    themeTests++;
  }
}
for (const owners of termOwners.values()) {
  if (owners.length !== 1) { ambiguousTerms++; continue; }
  const owner = owners[0];
  if (owner.kind === 'theme') continue;
  if (owner.term.length < 5) continue;
  const out = classifyVideoForSnapshot(video(`${owner.term} résumé officiel`, owner.channel, 185));
  if (owner.theme !== 'Tennis') assert.notStrictEqual(out.sport, 'Tennis', `${owner.channel}/${owner.theme}/${owner.comp}/${owner.term} unexpectedly went to Tennis`);
  if (owner.kind.startsWith('comp') && out.sport === owner.theme) assert.strictEqual(out.competition, owner.comp, `${owner.channel}/${owner.theme}/${owner.comp}/${owner.term}: comp ${out.competition}`);
  uniqueTermTests++;
}

const snapshot = classifySnapshot({ channel:'sport', videos:[video('🎾 #RolandGarros | Sinner', 'sport', 60), video('🏉 #InvestecChampionsCup | Toulon', 'sport', 70)] });
assert.strictEqual(snapshot.classificationReady, true);
assert.strictEqual(snapshot.videos[0].sport, 'Tennis');
assert.strictEqual(snapshot.videos[1].sport, 'Rugby');

console.log(JSON.stringify({ ok:true, profile:CLASSIFICATION_PROFILE, curatedTests:curated.length + 3, themeTests, uniqueTermTests, auditedTerms, ambiguousTermGroups:ambiguousTerms }, null, 2));
