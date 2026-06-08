    const $ = id => document.getElementById(id);
    function showLogin(message, cls='warn') { $('loginView').style.display='grid'; $('adminApp').classList.remove('is-open'); $('logoutTop').style.display='none'; $('loginStatus').className='status '+cls; $('loginStatus').textContent=message; }
    function showApp() { $('loginView').style.display='none'; $('adminApp').classList.add('is-open'); $('logoutTop').style.display='inline-flex'; }
    function openTab(name){ document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===name)); document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active', p.id==='tab-'+name)); }
    async function loginAdmin(){
      const password = $('adminPassword').value.trim();
      if(!password) return showLogin('Entre le mot de passe ADMIN_PASSWORD.', 'warn');
      try{
        const r = await fetch('/api/admin-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});
        const j = await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.error || 'Mot de passe incorrect.');
        $('adminPassword').value=''; showApp(); await loadStatus();
      }catch(e){ showLogin(e.message, 'err'); }
    }
    async function logoutAdmin(){ try{ await fetch('/api/admin-logout',{method:'POST'}); }catch(e){} showLogin('Admin déconnecté.', 'warn'); }
    function envSecret(name, ok){ return `<div class="secret"><b>${name}</b><span>${ok?'OK':'manquant'}</span></div>`; }
    function heroPill(label, ok){ return `<span class="pill"><span class="dot ${ok?'ok':'warn'}"></span>${label}</span>`; }
    async function loadStatus(){
      try{
        const r=await fetch('/api/admin-status',{cache:'no-store'}); const j=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.error||'Admin non autorisé.');
        showApp();
        const env=j.env||{}; const entries=Object.entries(env); const okCount=entries.filter(([,v])=>!!v).length;
        $('envOkCount').textContent=okCount+'/'+entries.length;
        $('statusCards').innerHTML=entries.map(([k,v])=>envSecret(k,v)).join('');
        $('heroPills').innerHTML=[heroPill('Admin connecté',true),heroPill('Backend opérationnel',true),heroPill('Secrets '+okCount+'/'+entries.length, okCount===entries.length)].join('');
        $('logs').textContent=JSON.stringify(j,null,2);
      }catch(e){ showLogin(e.message || 'Connexion admin requise.', 'err'); }
    }
    async function runTests(){ try{ $('logs').textContent='Tests en cours...'; const r=await fetch('/api/admin-test',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}); const j=await r.json(); $('logs').textContent=JSON.stringify(j,null,2); openTab('tests'); }catch(e){ $('logs').textContent=e.stack||String(e); openTab('tests'); } }
    async function testContentOwner(){ try{ $('logs').textContent='Test Content Owner en cours...'; const r=await fetch('/api/youtube-content-owner-test',{cache:'no-store'}); const j=await r.json().catch(()=>({})); $('logs').textContent=JSON.stringify(j,null,2); openTab('tests'); }catch(e){ $('logs').textContent=e.stack||String(e); openTab('tests'); } }
    function startOAuth(){ window.location.href='/api/oauth-start'; }
    async function testSnapshot(){ try{ $('logs').textContent='Lecture donnée admin SPORT...'; const r=await fetch('/api/dashboard-data?channel=sport&_live='+Date.now(),{cache:'no-store'}); const j=await r.json(); $('logs').textContent=JSON.stringify({ok:r.ok,status:r.status,count:j.count,generatedAt:j.generatedAt,storedUpdatedAt:j.storedUpdatedAt,lastVideo:(j.videos||[])[0]?.publishedAt,error:j.error||null},null,2); openTab('tests'); }catch(e){ $('logs').textContent=e.stack||String(e); openTab('tests'); } }
    async function preloadAll(){ return refreshAdminData('all'); }
    async function refreshAdminData(channel='all'){ try{ $('logs').textContent='Actualisation live admin en cours ('+channel+')...'; const r=await fetch('/api/admin-refresh-data',{method:'POST',headers:{'content-type':'application/json','Cache-Control':'no-store'},cache:'no-store',body:JSON.stringify({channel})}); const j=await r.json().catch(()=>({})); $('logs').textContent=JSON.stringify(j,null,2); openTab('tests'); }catch(e){ $('logs').textContent=e.stack||String(e); openTab('tests'); } }
    async function testCache(){ try{ $('logs').textContent='Statut architecture...'; const r=await fetch('/api/cache-status?_live='+Date.now(),{cache:'no-store'}); const j=await r.json(); $('logs').textContent=JSON.stringify(j,null,2); openTab('tests'); }catch(e){ $('logs').textContent=e.stack||String(e); openTab('tests'); } }
    function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

    const CHANNELS = [
      ['sport','SPORT'],['francetv','france.tv'],['franceinfo','franceinfo'],['francetvculture','Culture'],['slash','Slash']
    ];
    function channelLabels(arr){ return (!arr || !arr.length) ? 'Toutes' : arr.map(k => (CHANNELS.find(c=>c[0]===k)||[k,k])[1]).join(', '); }
    function renderAccess(users){
      const box=$('accessList'); if(!box) return;
      if(!users.length){ box.innerHTML='<div class="status warn">Aucun utilisateur.</div>'; return; }
      box.innerHTML = users.map(u=>`<div class="card" style="padding:16px"><div class="row" style="justify-content:space-between"><div><div class="title" style="margin-bottom:2px">${u.full_name||u.email}</div><div class="muted">${u.email} · rôle ${u.role}</div></div><button class="primary" onclick="saveChannelAccess('${u.id}')">Enregistrer</button></div><div class="access-grid" style="margin-top:14px">${CHANNELS.map(([k,l])=>`<label class="channel-chip"><input type="checkbox" data-user="${u.id}" value="${k}" ${(u.allowed_channels||[]).includes(k)?'checked':''}><span class="check-ui"></span><span>${l}</span></label>`).join('')}<span class="small-pill">aucune case = toutes chaînes</span></div></div>`).join('');
    }
    async function saveChannelAccess(userId){
      const channels = Array.from(document.querySelectorAll(`input[data-user="${userId}"]:checked`)).map(x=>x.value);
      try{ const r=await fetch('/api/admin-channel-access',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({user_id:userId,channels})}); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||'Erreur permissions'); $('accessStatus').className='status ok'; $('accessStatus').textContent='Permissions enregistrées.'; await loadUsers(); }
      catch(e){ $('accessStatus').className='status err'; $('accessStatus').textContent=e.message; }
    }
    async function loadUsage(){
      try{ $('usageStatus').className='status warn'; $('usageStatus').textContent='Chargement…'; const r=await fetch('/api/admin-activity?limit=120',{cache:'no-store'}); const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||'Erreur usage'); const ev=j.events||[]; $('usageStatus').className='status '+(ev.length?'ok':'warn'); $('usageStatus').textContent=ev.length?`${ev.length} évènement(s) récent(s).`:'Aucun usage enregistré.'; $('usageList').innerHTML=ev.map(e=>`<div class="usage-item"><div><b>${e.event_type||'event'}</b><br><span>${e.profiles?.email||'utilisateur'} · ${e.channel||'—'} · ${new Date(e.created_at).toLocaleString('fr-FR')}</span></div><span class="small-pill">${e.profiles?.role||''}</span></div>`).join(''); }
      catch(e){ $('usageStatus').className='status err'; $('usageStatus').textContent=e.message; }
    }
    function showUsersStatus(msg, cls='warn'){ $('usersStatus').className='status '+cls; $('usersStatus').textContent=msg; }
    async function loadUsers(){
      try{
        $('usersTable').innerHTML='<tr><td colspan="6">Chargement...</td></tr>';
        const r=await fetch('/api/admin-users',{cache:'no-store'}); const j=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.error||'Impossible de charger les utilisateurs.');
        const users=j.users||[];
        showUsersStatus(users.length ? `${users.length} utilisateur(s) autorisé(s).` : 'Aucun utilisateur pour le moment.', users.length?'ok':'warn');
        $('accessStatus') && (($('accessStatus').className='status ok'), ($('accessStatus').textContent='Permissions chargées.'));
        renderAccess(users);
        $('usersTable').innerHTML = users.length ? users.map(u=>`<tr>
          <td>${escapeHtml(u.email)}</td>
          <td><input class="inline-input" id="name-${u.id}" value="${escapeHtml(u.full_name||'')}" /></td>
          <td><select class="role-select" id="role-${u.id}"><option value="viewer" ${u.role==='viewer'?'selected':''}>viewer</option><option value="editor" ${u.role==='editor'?'selected':''}>editor</option><option value="admin" ${u.role==='admin'?'selected':''}>admin</option></select></td>
          <td><select class="status-select" id="status-${u.id}"><option value="active" ${u.status==='active'?'selected':''}>active</option><option value="disabled" ${u.status==='disabled'?'selected':''}>disabled</option></select></td>
          <td>${u.last_seen_at ? new Date(u.last_seen_at).toLocaleString('fr-FR') : '—'}</td>
          <td><button class="mini ghost" onclick="saveUser('${u.id}')">Sauver</button> <button class="mini secondary" onclick="resetPassword('${u.id}')">MDP</button> <button class="mini danger" onclick="deleteUser('${u.id}')">Suppr.</button></td>
        </tr>`).join('') : '<tr><td colspan="6">Aucun utilisateur.</td></tr>';
      }catch(e){ showUsersStatus(e.message,'err'); $('usersTable').innerHTML='<tr><td colspan="7">Erreur de chargement.</td></tr>'; }
    }
    async function createUser(){
      try{
        const body={action:'create',email:$('newUserEmail').value.trim(),full_name:$('newUserName').value.trim(),password:$('newUserPassword').value.trim(),role:$('newUserRole').value};
        if(!body.email||!body.password) return showUsersStatus('Email et mot de passe temporaire requis.','warn');
        const r=await fetch('/api/admin-users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); const j=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.error||'Création impossible.');
        $('newUserEmail').value=''; $('newUserName').value=''; $('newUserPassword').value=''; showUsersStatus('Utilisateur créé.','ok'); await loadUsers();
      }catch(e){ showUsersStatus(e.message,'err'); }
    }
    async function saveUser(id){
      try{
        const body={action:'update',id,full_name:$('name-'+id).value,role:$('role-'+id).value,status:$('status-'+id).value};
        const r=await fetch('/api/admin-users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}); const j=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.error||'Sauvegarde impossible.');
        showUsersStatus('Utilisateur mis à jour.','ok'); await loadUsers();
      }catch(e){ showUsersStatus(e.message,'err'); }
    }
    async function resetPassword(id){
      const password=prompt('Nouveau mot de passe temporaire pour cet utilisateur :');
      if(!password) return;
      try{
        const r=await fetch('/api/admin-users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'reset-password',id,password})}); const j=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.error||'Réinitialisation impossible.');
        showUsersStatus('Mot de passe réinitialisé.','ok');
      }catch(e){ showUsersStatus(e.message,'err'); }
    }
    async function deleteUser(id){
      if(!confirm('Supprimer définitivement cet accès ?')) return;
      try{
        const r=await fetch('/api/admin-users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'delete',id})}); const j=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(j.error||'Suppression impossible.');
        showUsersStatus('Utilisateur supprimé.','ok'); await loadUsers();
      }catch(e){ showUsersStatus(e.message,'err'); }
    }
    function clearLogs(){ $('logs').textContent='Logs vidés.'; }
    $('callbackUrl').textContent=location.origin+'/api/oauth-callback';
    $('adminPassword').addEventListener('keydown', e => { if(e.key==='Enter') loginAdmin(); });
    loadStatus();
  
