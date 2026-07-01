(function(){
  const set = () => {
    document.documentElement.dataset.ftvDevice = window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop';
  };
  set(); window.addEventListener('resize', set, {passive:true}); window.addEventListener('orientationchange', set, {passive:true});
})();
