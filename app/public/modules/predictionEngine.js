(function(){
  const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:0));
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const median=(arr)=>{const a=arr.map(num).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
  const quantile=(arr,q)=>{const a=arr.map(num).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const pos=(a.length-1)*q;const b=Math.floor(pos);const r=pos-b;return a[b+1]!==undefined?a[b]+r*(a[b+1]-a[b]):a[b];};
  const ageHours=(v)=>{const d=new Date(v.publishedAt||v.date||0).getTime();return d?Math.max(1,(Date.now()-d)/36e5):720;};
  const engagement=(v)=>{const views=Math.max(1,num(v.views));return ((num(v.likes)*2.2)+(num(v.comments)*7))/views;};
  const isShort=v=>String(v.type||'').toLowerCase()==='short'||/shorts/i.test(v.title||'');
  const clean=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function findSimilar(video,videos,limit=30){
    const s=video.sport||video.category||video.s||''; const c=video.comp||video.competition||video.subcategory||''; const t=isShort(video);
    const same=(videos||[]).filter(v=>v.id!==video.id).map(v=>{
      let score=0;if((v.sport||v.category||v.s)===s)score+=4;if((v.comp||v.competition||v.subcategory)===c)score+=3;if(isShort(v)===t)score+=2;
      const tt=clean(video.title), vt=clean(v.title); if(tt&&vt){tt.split(/\W+/).filter(w=>w.length>4).slice(0,8).forEach(w=>{if(vt.includes(w))score+=0.5;});}
      return {v,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||num(b.v.views)-num(a.v.views)).slice(0,limit).map(x=>x.v);
    return same.length?same:(videos||[]).filter(v=>v.id!==video.id).sort((a,b)=>num(b.views)-num(a.views)).slice(0,limit);
  }
  function predictVideo(video,videos=[]){
    const views=num(video.views), likes=num(video.likes), comments=num(video.comments), age=ageHours(video), vel=views/age;
    const similar=findSimilar(video,videos,36); const simViews=similar.map(v=>num(v.views));
    const med=Math.max(1,median(simViews)); const p75=Math.max(med,quantile(simViews,.75)); const p90=Math.max(p75,quantile(simViews,.9));
    const e=engagement(video); const simEng=median(similar.map(engagement))||0.015;
    const rel=views/med; const vrel=vel/(median(similar.map(v=>num(v.views)/ageHours(v)))||1);
    const titleBoost=/finale|direct|incroyable|resume|résumé|exploit|record|victoire|crash|choc|historique|exceptionnel|dernier|exclusive|exclusif/i.test(video.title||'')?8:0;
    const potentialScore=clamp(42+Math.log10(Math.max(1,views))*9+(e/(simEng||.01))*8+Math.min(vrel,4)*7+titleBoost-(age>24*30?12:0));
    const viralityProbability=clamp(18+Math.min(vrel,5)*13+Math.min(e/(simEng||.01),5)*9+(isShort(video)?8:0)+titleBoost+(rel>1?10:0));
    const growthFactor=clamp((vrel*.55)+(e/(simEng||.01)*.28)+(isShort(video)?.18:.08),.25,3.8);
    const base24=views + vel*24*Math.min(growthFactor,2.2);
    const base7=views + vel*24*7*Math.min(growthFactor*.72,2.1);
    const base30=Math.max(base7, views + vel*24*30*Math.min(growthFactor*.38,1.55));
    const confidence=similar.length>20?'high':similar.length>8?'medium':'low';
    const overPerformance=clamp(((views-med)/med)*100,-100,400);
    const scenarios=window.SyntheticMediaData?window.SyntheticMediaData.generateScenarios(video,{views,med,p75,p90,engagement:e,simEng,velocity:vel,type:isShort(video)?'short':'video'}):[];
    return { potentialScore:Math.round(potentialScore), viralityProbability:Math.round(viralityProbability), projected24h:[Math.round(base24*.88),Math.round(base24*1.16)], projected7d:[Math.round(base7*.78),Math.round(base7*1.24)], projected30d:[Math.round(base30*.70),Math.round(base30*1.35)], confidence, overPerformance:Math.round(overPerformance), benchmarks:{median:Math.round(med),p75:Math.round(p75),p90:Math.round(p90),similarCount:similar.length}, scenarios };
  }
  function summarize(videos=[]){
    const preds=videos.slice(0,250).map(v=>({video:v,prediction:predictVideo(v,videos)}));
    const opportunities=preds.filter(x=>x.prediction.potentialScore>=70).sort((a,b)=>b.prediction.potentialScore-a.prediction.potentialScore).slice(0,8);
    const risks=preds.filter(x=>x.prediction.overPerformance< -35).sort((a,b)=>a.prediction.overPerformance-b.prediction.overPerformance).slice(0,6);
    const avg=preds.length?Math.round(preds.reduce((s,x)=>s+x.prediction.potentialScore,0)/preds.length):0;
    return {generatedAt:new Date().toISOString(),averagePotential:avg,opportunities,risks,count:preds.length};
  }
  window.PredictionEngine={predictVideo,summarize,findSimilar,median,quantile};
})();
