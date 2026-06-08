(function(){
  const $=id=>document.getElementById(id);
  function msg(t,type){const el=$('ftvPasswordModalMsg'); if(el){el.textContent=t||''; el.className='ftv-password-msg '+(type==='error'?'is-error':type==='success'?'is-success':'');}}
  function open(){const b=$('ftvPasswordModalBackdrop'); if(b){b.classList.add('is-open'); b.setAttribute('aria-hidden','false'); setTimeout(()=>$('ftvPasswordNew')?.focus(),30);} msg('');}
  function close(){const b=$('ftvPasswordModalBackdrop'); if(b){b.classList.remove('is-open'); b.setAttribute('aria-hidden','true');} ['ftvPasswordNew','ftvPasswordNew2'].forEach(id=>{const el=$(id); if(el) el.value='';}); msg('');}
  async function save(){
    const p1=($('ftvPasswordNew')?.value||'').trim(); const p2=($('ftvPasswordNew2')?.value||'').trim();
    if(p1.length<8) return msg('Le mot de passe doit contenir au moins 8 caractères.','error');
    if(p1!==p2) return msg('Les deux mots de passe ne correspondent pas.','error');
    msg('Mise à jour…');
    try{ const r=await fetch('/api/auth-change-password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:p1})}); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||'Impossible de changer le mot de passe.'); msg('Mot de passe modifié.','success'); setTimeout(close,650); }
    catch(e){ msg(e.message,'error'); }
  }
  window.ftvOpenPasswordModal=open;
  document.addEventListener('DOMContentLoaded',()=>{ $('ftvPasswordModalClose')?.addEventListener('click',close); $('ftvPasswordCancel')?.addEventListener('click',close); $('ftvPasswordSave')?.addEventListener('click',save); $('ftvPasswordModalBackdrop')?.addEventListener('click',e=>{ if(e.target===$('ftvPasswordModalBackdrop')) close(); }); });
})();
