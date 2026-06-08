(function(){
  const pct=n=>`${n>0?'+':''}${Math.round(n)}%`;
  function scenario(label, gainLow, gainHigh, risk, probability, rationale){return{label,gainRange:[gainLow,gainHigh],risk,probability,rationale,display:`${pct(gainLow)} à ${pct(gainHigh)}`};}
  function generateScenarios(video,ctx={}){
    const title=String(video.title||''); const isShort=ctx.type==='short'; const views=Number(ctx.views||0); const big=views>Number(ctx.p75||0);
    const out=[];
    out.push(scenario('Publication à 18h–21h', 8, 22, 'low', 64, 'Fenêtre de consommation forte pour contenus sport/média en soirée.'));
    out.push(scenario('Titre plus événementiel', /finale|record|direct|exploit|historique/i.test(title)?2:10, /finale|record|direct|exploit|historique/i.test(title)?8:28, 'medium', 58, 'Renforce l’urgence éditoriale et la promesse de clic sans changer le contenu.'));
    out.push(scenario('Miniature plus émotionnelle', 12, 35, 'medium', 61, 'Hypothèse basée sur une amélioration de CTR : visage, action, contraste, enjeu clair.'));
    out.push(scenario(isShort?'Version longue complémentaire':'Déclinaison Shorts', isShort?5:18, isShort?16:48, isShort?'low':'medium', isShort?52:70, isShort?'La traction Shorts peut nourrir un format résumé/compilation.':'Le format vertical augmente la surface de distribution et de recommandation.'));
    out.push(scenario('Publication pendant événement majeur', big?6:20, big?18:65, 'high', 46, 'Effet contexte : forte demande autour du sport/événement, mais dépend de la concurrence éditoriale.'));
    return out;
  }
  window.SyntheticMediaData={generateScenarios};
})();
