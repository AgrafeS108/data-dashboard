(function(){
  try {
    var saved = localStorage.getItem('ftv_theme_preference_v64') || 'light';
    document.documentElement.setAttribute('data-ftv-theme', saved === 'dark' ? 'dark' : 'light');
    window.ftvSetTheme = function(theme){
      var next = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-ftv-theme', next);
      localStorage.setItem('ftv_theme_preference_v64', next);
      try { window.dispatchEvent(new CustomEvent('ftv-theme-change', { detail:{ theme: next }})); } catch(e) {}
      return next;
    };
    window.ftvToggleTheme = function(){
      var current = document.documentElement.getAttribute('data-ftv-theme') === 'dark' ? 'dark' : 'light';
      return window.ftvSetTheme(current === 'dark' ? 'light' : 'dark');
    };
  } catch(e) { document.documentElement.setAttribute('data-ftv-theme', 'light'); }
})();
