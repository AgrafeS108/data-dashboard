(function(){
  function role(){ return (window.ftvAuthGetCurrentProfile?.()?.role || 'viewer').toLowerCase(); }
  function can(action){ return window.ftvAuthCan ? window.ftvAuthCan(action) : false; }
  function guard(){
    const r=role();
    document.body && document.body.setAttribute('data-ftv-role', r);
    document.querySelectorAll('button,a').forEach(el=>{
      const txt=(el.textContent||'').trim().toLowerCase();
      if(!can('admin') && txt.includes('console admin')) el.style.display='none';
      if(!can('export') && (txt==='exporter' || txt.includes('exporter excel'))) { el.disabled=true; el.style.opacity='.45'; el.style.cursor='not-allowed'; el.title='Rôle editor ou admin requis'; }
      if(!can('claude') && txt.includes('claude')) { el.disabled=true; el.style.opacity='.45'; el.style.cursor='not-allowed'; el.title='Rôle editor ou admin requis'; }
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{ guard(); new MutationObserver(()=>guard()).observe(document.body,{childList:true,subtree:true}); });
  window.addEventListener('ftv-auth-change', guard);
})();
