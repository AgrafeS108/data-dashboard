(function(){
  function formatCompact(n){try{return new Intl.NumberFormat('fr-FR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);}catch(e){return String(Math.round(Number(n)||0));}}
  function buildBrief(summary){
    const opp=(summary.opportunities||[]).slice(0,3).map(x=>`• ${x.video.title} — potentiel ${x.prediction.potentialScore}/100, projection J+7 ${formatCompact(x.prediction.projected7d[0])}-${formatCompact(x.prediction.projected7d[1])}`).join('\n');
    const risk=(summary.risks||[]).slice(0,2).map(x=>`• ${x.video.title} — sous-performance estimée ${x.prediction.overPerformance}% vs similaires`).join('\n');
    return `Lecture copilot\nScore moyen : ${summary.averagePotential}/100\nOpportunités prioritaires :\n${opp||'• Aucune opportunité majeure détectée.'}\nRisques :\n${risk||'• Aucun risque majeur détecté.'}`;
  }
  window.AIMediaCopilot={buildBrief,formatCompact};
})();
