const fs=require('fs'),path=require('path');
const { classifyVideoForSnapshot }=require('../api/classification-runtime');
function load(){return JSON.parse(fs.readFileSync(path.join(__dirname,'../api/classification-taxonomy.json'),'utf8'));}
function video(title,channel='sport'){return {channelKey:channel,title,description:'',tags:[],durationSeconds:185,views:1,publishedAt:'2026-01-01T00:00:00Z'}}
const tax=load();let rows=[];let total=0;
for(const [channel,catalog] of Object.entries(tax)) for(const theme of catalog) for(const comp of (theme.comps||[])){const terms=[comp.n,...(comp.strong||[]).slice(0,2),...(comp.medium||[]).slice(0,1)].filter(Boolean);for(const term of terms){total++;const title=`${term} résumé officiel`;const out=classifyVideoForSnapshot(video(title,channel));if(out.sport!==theme.s||out.competition!==comp.n)rows.push({channel,theme:theme.s,comp:comp.n,term,gotSport:out.sport,gotComp:out.competition,source:out.classification.source,kw:out.classification.keywords});}}
console.log(JSON.stringify({total,mismatchCount:rows.length,mismatches:rows.slice(0,200)},null,2));
