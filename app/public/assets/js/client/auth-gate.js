(function(){
  const html=document.documentElement;
  const $=id=>document.getElementById(id);
  let currentProfile=null;
  function splitName(full){ const parts=String(full||'').trim().split(/\s+/).filter(Boolean); return {firstName:parts[0]||'', lastName:parts.slice(1).join(' ')||''}; }
  function normalizeProfile(payload){
    const user=payload?.user||{}; const p=payload?.profile||{}; const n=splitName(p.full_name||user.email||'');
    return { email:user.email||p.email||'', firstName:n.firstName, lastName:n.lastName, fullName:p.full_name||user.email||'', role:p.role||'viewer', status:p.status||'active', licenseActive:p.status!=='disabled', allowed_channels:Array.isArray(p.allowed_channels)?p.allowed_channels:[] };
  }
  function emit(){ try{ window.dispatchEvent(new CustomEvent('ftv-auth-change',{detail:currentProfile})); }catch(e){} }
  function setProfile(payload){ currentProfile=normalizeProfile(payload||{}); window.FTV_AUTH_USER=payload; window.FTV_AUTH_ROLE=currentProfile.role||'viewer'; document.body && document.body.setAttribute('data-ftv-role', window.FTV_AUTH_ROLE); emit(); }
  window.ftvAuthGetCurrentProfile=function(){ return currentProfile; };
  window.ftvAuthCan=function(action){ const r=(currentProfile&&currentProfile.role)||'viewer'; if(action==='admin') return r==='admin'; if(action==='edit'||action==='export'||action==='claude') return r==='admin'||r==='editor'; return !!currentProfile; };
  function message(msg,type){ const el=$('ftvAuthMessage'); if(el){ el.textContent=msg||''; el.className='ftv-auth-message '+(type==='error'?'is-error':type==='success'?'is-success':''); } }
  function lock(msg,type){ html.classList.remove('ftv-auth-checking','ftv-auth-unlocked'); html.classList.add('ftv-auth-locked'); message(msg||'Connexion requise.',type); }
  function unlock(payload){ setProfile(payload); html.classList.remove('ftv-auth-checking','ftv-auth-locked'); html.classList.add('ftv-auth-unlocked'); }
  async function me(){
    try{ const r=await fetch('/api/auth-me',{cache:'no-store'}); const j=await r.json().catch(()=>({})); if(r.ok&&j.ok){ unlock(j); return; } lock(j.error||'Connexion requise.', j.configured===false?'error':''); }
    catch(e){ lock('Impossible de vérifier la session : '+e.message,'error'); }
  }

  function isRecoveryHash(){
    try{ const h=new URLSearchParams((location.hash||'').replace(/^#/,'')); return h.get('type')==='recovery' && !!h.get('access_token'); }catch(e){ return false; }
  }
  function showRecoveryPanel(){
    const form=$('ftvAuthForm'), panel=$('ftvRecoveryPanel'), title=$('ftvAuthTitle'), subtitle=$('ftvAuthSubtitle');
    if(form) form.hidden=true; if(panel) panel.hidden=false;
    if(title) title.textContent='Nouveau mot de passe';
    if(subtitle) subtitle.textContent='Ton lien de réinitialisation est valide. Choisis un nouveau mot de passe.';
  }
  async function adoptRecoverySession(){
    if(!isRecoveryHash()) return false;
    const h=new URLSearchParams((location.hash||'').replace(/^#/,''));
    message('Validation du lien de récupération…');
    try{
      const payload={ access_token:h.get('access_token'), refresh_token:h.get('refresh_token'), expires_at:h.get('expires_at'), expires_in:h.get('expires_in') };
      const r=await fetch('/api/auth-adopt-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||'Lien de récupération invalide.');
      history.replaceState(null,'',location.pathname+location.search);
      html.classList.remove('ftv-auth-checking','ftv-auth-unlocked'); html.classList.add('ftv-auth-locked');
      showRecoveryPanel(); message('Lien validé. Choisis ton nouveau mot de passe.','success'); return true;
    }catch(e){ message(e.message,'error'); return true; }
  }
  async function sendForgotPassword(){
    const email=($('ftvAuthEmail')?.value||'').trim();
    if(!email) return message('Entre ton email, puis clique sur “Mot de passe oublié”.','error');
    message('Envoi de l’email de réinitialisation…');
    try{ const r=await fetch('/api/auth-reset-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})}); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||'Impossible d’envoyer l’email.'); message(j.message||'Si ce compte existe, un email vient d’être envoyé.','success'); }
    catch(e){ message(e.message,'error'); }
  }
  async function submitRecoveryPassword(){
    const p1=($('ftvRecoveryPassword')?.value||'').trim(); const p2=($('ftvRecoveryPassword2')?.value||'').trim();
    if(p1.length<8) return message('Le mot de passe doit contenir au moins 8 caractères.','error');
    if(p1!==p2) return message('Les deux mots de passe ne correspondent pas.','error');
    message('Mise à jour du mot de passe…');
    try{ const r=await fetch('/api/auth-change-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:p1})}); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||'Impossible de changer le mot de passe.'); message('Mot de passe modifié. Ouverture du dashboard…','success'); setTimeout(()=>location.href='/',700); }
    catch(e){ message(e.message,'error'); }
  }

  async function login(e){
    if(e) e.preventDefault();
    const email=($('ftvAuthEmail')?.value||'').trim(); const password=($('ftvAuthPassword')?.value||'').trim();
    if(!email||!password) return message('Email et mot de passe requis.','error');
    const btn=$('ftvAuthSubmit'); if(btn) btn.disabled=true; message('Connexion en cours…');
    try{ const r=await fetch('/api/auth-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})}); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||'Connexion refusée.'); message('Connexion réussie. Ouverture du dashboard…','success'); setTimeout(()=>location.reload(),180); }
    catch(e){ message(e.message,'error'); }
    finally{ if(btn) btn.disabled=false; }
  }
  window.ftvAuthLogout=window.ftvLogout=async function(){ try{ await fetch('/api/auth-logout',{method:'POST'}); }catch(e){} location.reload(); };
  document.addEventListener('click', function(e){ const t=e.target; if(t && String(t.textContent||'').trim().toLowerCase()==='déconnexion'){ e.preventDefault(); window.ftvAuthLogout(); } }, true);
  document.addEventListener('DOMContentLoaded', async function(){ $('ftvAuthForm')?.addEventListener('submit',login); $('ftvAuthSubmit')?.addEventListener('click',login); $('ftvForgotPasswordBtn')?.addEventListener('click',sendForgotPassword); $('ftvRecoverySubmit')?.addEventListener('click',submitRecoveryPassword); const recovery=await adoptRecoverySession(); if(!recovery) me(); });
})();
