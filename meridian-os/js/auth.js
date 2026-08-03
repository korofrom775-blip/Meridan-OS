/* =================================================================
   MERIDIAN OS — Authentication: accounts, sessions, lock screen
   Passwords are never stored in plain text: each account gets a random
   salt and only a SHA-256 digest of salt+password is persisted. This is
   a client-only demo (there is no server to verify against), so it is
   not a substitute for real authentication — just a reasonable way to
   avoid keeping plain-text passwords in localStorage.
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var Storage = OS.Storage;
  var svg = OS.Icons.svg, mark = OS.Icons.mark, esc = OS.Util.escapeHtml;

  var AVATAR_COLORS = ['#ff8a5b','#4fd2c4','#ffc857','#ff8cc6','#9b8cff','#9fb4ff','#5bd98a','#ff7d7d'];
  var session = null; /* { id, username, displayName, avatarColor } */

  function pickAvatarColor(){ return AVATAR_COLORS[Math.floor(Math.random()*AVATAR_COLORS.length)]; }

  function bufToHex(buf){
    var bytes = new Uint8Array(buf), hex = '';
    for(var i=0;i<bytes.length;i++) hex += bytes[i].toString(16).padStart(2,'0');
    return hex;
  }
  function randomSalt(){
    var arr = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return bufToHex(arr);
  }
  function digest(salt, password){
    if(window.crypto && window.crypto.subtle){
      var enc = new TextEncoder().encode(salt + ':' + password);
      return window.crypto.subtle.digest('SHA-256', enc).then(bufToHex);
    }
    /* extremely defensive fallback if SubtleCrypto is unavailable */
    var h = 0, s = salt + ':' + password;
    for(var i=0;i<s.length;i++){ h = ((h<<5)-h+s.charCodeAt(i))|0; }
    return Promise.resolve('fb'+Math.abs(h).toString(16));
  }

  function sanitize(acc){
    if(!acc) return null;
    return { id:acc.id, username:acc.username, displayName:acc.displayName, avatarColor:acc.avatarColor, createdAt:acc.createdAt };
  }
  function currentUser(){ return session ? sanitize(session) : null; }
  function findAccount(username){
    var list = Storage.getAccounts();
    var lower = (username||'').trim().toLowerCase();
    for(var i=0;i<list.length;i++){ if(list[i].username.toLowerCase() === lower) return list[i]; }
    return null;
  }
  function findAccountById(id){
    var list = Storage.getAccounts();
    for(var i=0;i<list.length;i++){ if(list[i].id === id) return list[i]; }
    return null;
  }
  function listAccountsPublic(){ return Storage.getAccounts().map(sanitize); }

  function emit(name, detail){ document.dispatchEvent(new CustomEvent('meridian:'+name, { detail: detail||{} })); }

  /* ---------------- registration / login / logout ---------------- */
  function validateUsername(name){
    if(!name || name.trim().length < 2) return 'Username must be at least 2 characters.';
    if(!/^[a-zA-Z0-9_\-. ]{2,24}$/.test(name.trim())) return 'Use letters, numbers, spaces, _ . or -.';
    if(findAccount(name)) return 'That username is already taken.';
    return null;
  }
  function validatePassword(pass){
    if(!pass || pass.length < 4) return 'Password must be at least 4 characters.';
    return null;
  }

  function register(fields){
    var uErr = validateUsername(fields.username);
    if(uErr) return Promise.resolve({ ok:false, error:uErr });
    var pErr = validatePassword(fields.password);
    if(pErr) return Promise.resolve({ ok:false, error:pErr });
    if(fields.password !== fields.confirm) return Promise.resolve({ ok:false, error:'Passwords do not match.' });

    var salt = randomSalt();
    return digest(salt, fields.password).then(function(hash){
      var account = {
        id: Storage.uid('user'),
        username: fields.username.trim(),
        displayName: (fields.displayName||fields.username).trim(),
        avatarColor: fields.avatarColor || pickAvatarColor(),
        salt: salt, hash: hash,
        createdAt: Date.now()
      };
      var list = Storage.getAccounts();
      list.push(account);
      Storage.setAccounts(list);
      Storage.seedUserData(account.id);
      return { ok:true, account: sanitize(account) };
    });
  }

  function login(username, password){
    var account = findAccount(username);
    if(!account) return Promise.resolve({ ok:false, error:'No account with that username.' });
    return digest(account.salt, password).then(function(hash){
      if(hash !== account.hash) return { ok:false, error:'Incorrect password.' };
      session = account;
      Storage.setSession({ id: account.id });
      Storage.setLastUser(account.username);
      emit('login', { userId: account.id });
      return { ok:true, account: sanitize(account) };
    });
  }

  function resumeSession(){
    var s = Storage.getSession();
    if(!s) return false;
    var account = findAccountById(s.id);
    if(!account) { Storage.clearSession(); return false; }
    session = account;
    emit('login', { userId: account.id, resumed:true });
    return true;
  }

  function logout(){
    if(session) Storage.setLastUser(session.username);
    var uid = session ? session.id : null;
    session = null;
    Storage.clearSession();
    OS.UI.clearNotifRuntime();
    emit('logout', { userId: uid });
    showLoginScreen();
  }

  function lock(){
    if(!session) return;
    emit('lock', { userId: session.id });
    showLockScreen();
  }

  function unlock(password){
    if(!session) return Promise.resolve(false);
    return digest(session.salt, password).then(function(hash){
      if(hash !== session.hash) return false;
      emit('unlock', { userId: session.id });
      hideAuthScreens();
      return true;
    });
  }

  function changePassword(userId, oldPass, newPass){
    var account = findAccountById(userId);
    if(!account) return Promise.resolve({ ok:false, error:'Account not found.' });
    return digest(account.salt, oldPass).then(function(oldHash){
      if(oldHash !== account.hash) return { ok:false, error:'Current password is incorrect.' };
      var err = validatePassword(newPass);
      if(err) return { ok:false, error: err };
      var salt = randomSalt();
      return digest(salt, newPass).then(function(hash){
        account.salt = salt; account.hash = hash;
        var list = Storage.getAccounts().map(function(a){ return a.id===userId? account : a; });
        Storage.setAccounts(list);
        return { ok:true };
      });
    });
  }

  function updateProfile(userId, fields){
    var list = Storage.getAccounts();
    var changed = null;
    list = list.map(function(a){
      if(a.id !== userId) return a;
      if(fields.displayName) a.displayName = fields.displayName.trim();
      if(fields.avatarColor) a.avatarColor = fields.avatarColor;
      changed = a;
      return a;
    });
    Storage.setAccounts(list);
    if(session && session.id === userId) session = changed;
    emit('profile-updated', { userId:userId });
    return sanitize(changed);
  }

  function deleteAccount(userId){
    if(session && session.id === userId) return { ok:false, error:'Sign out before deleting the account you are using.' };
    var list = Storage.getAccounts().filter(function(a){ return a.id !== userId; });
    Storage.setAccounts(list);
    Storage.wipeUserData(userId);
    return { ok:true };
  }

  /* ---------------- rendering: login / register screen ---------------- */
  function avatarHtml(color, letter, size){
    return '<div class="avatar" style="width:'+(size||36)+'px;height:'+(size||36)+'px;background:'+color+';font-size:'+Math.round((size||36)*0.42)+'px;">'+esc(letter)+'</div>';
  }

  function showLoginScreen(){
    hideAuthScreens();
    var accounts = Storage.getAccounts();
    var lastUser = Storage.getLastUser();
    accounts.sort(function(a,b){
      if(a.username === lastUser) return -1;
      if(b.username === lastUser) return 1;
      return a.createdAt - b.createdAt;
    });
    var root = document.createElement('div');
    root.id = 'auth-screen';
    root.innerHTML = renderTilesView(accounts);
    document.getElementById('app').appendChild(root);
    wireTilesView(root, accounts);
  }

  function renderTilesView(accounts){
    var tiles = accounts.map(function(a){
      return '<button class="auth-tile" data-id="'+a.id+'" style="width:100%; border:none; text-align:left;">'+
        avatarHtml(a.avatarColor, (a.displayName||a.username).charAt(0).toUpperCase())+
        '<div class="who"><div class="name">'+esc(a.displayName)+'</div><div class="sub">@'+esc(a.username)+'</div></div>'+
        svg('chevronRight') + '</button>';
    }).join('');
    return '<div class="auth-card">'+
      '<div class="auth-head">'+mark()+'<h1>Meridian OS</h1><p>Sign in to continue</p></div>'+
      (accounts.length ? '<div class="auth-tiles">'+tiles+'</div>' : '<p class="sm-empty" style="margin-bottom:8px;">No accounts yet — create the first one below.</p>')+
      '<div class="auth-foot">'+(accounts.length? 'New here? ' : '')+'<button id="go-register">Create an account</button></div>'+
      '</div>';
  }

  function renderPasswordStep(account){
    return '<div class="auth-card">'+
      '<div class="auth-head">'+avatarHtml(account.avatarColor,(account.displayName||account.username).charAt(0).toUpperCase(),48)+
      '<h1>'+esc(account.displayName)+'</h1><p>@'+esc(account.username)+'</p></div>'+
      '<form class="auth-form" id="login-form">'+
        '<div class="field"><label>Password</label><input type="password" id="login-pass" autofocus/><div class="field-error" id="login-err"></div></div>'+
        '<button class="btn btn-primary btn-block" type="submit">Sign in</button>'+
      '</form>'+
      '<div class="auth-foot"><button id="back-to-tiles">&larr; Back to accounts</button></div>'+
      '</div>';
  }

  function renderRegisterView(hasAccounts){
    var colorSwatches = AVATAR_COLORS.map(function(c,i){
      return '<div class="auth-avatar-opt'+(i===0?' selected':'')+'" data-color="'+c+'" style="background:'+c+';">'+String.fromCharCode(65+ (i%4))+'</div>';
    }).join('');
    return '<div class="auth-card">'+
      '<div class="auth-head">'+mark()+'<h1>Create your account</h1><p>Stored on this device only</p></div>'+
      '<form class="auth-form" id="register-form">'+
        '<div class="field"><label>Display name</label><input type="text" id="reg-display" placeholder="e.g. Alex"/></div>'+
        '<div class="field"><label>Username</label><input type="text" id="reg-username" placeholder="lowercase, no spaces ok too"/><div class="field-error" id="reg-uerr"></div></div>'+
        '<div class="field"><label>Avatar color</label><div class="auth-avatars" id="reg-avatars">'+colorSwatches+'</div></div>'+
        '<div class="field"><label>Password</label><input type="password" id="reg-pass" placeholder="at least 4 characters"/></div>'+
        '<div class="field"><label>Confirm password</label><input type="password" id="reg-confirm"/><div class="field-error" id="reg-perr"></div></div>'+
        '<button class="btn btn-primary btn-block" type="submit">Create account &amp; sign in</button>'+
      '</form>'+
      (hasAccounts ? '<div class="auth-foot"><button id="back-to-tiles2">&larr; Back to sign in</button></div>' : '')+
      '</div>';
  }

  function wireTilesView(root, accounts){
    root.querySelectorAll('.auth-tile').forEach(function(btn){
      btn.addEventListener('click', function(){
        var account = findAccountById(btn.getAttribute('data-id'));
        root.innerHTML = renderPasswordStep(account);
        wirePasswordStep(root, account);
      });
    });
    var goReg = root.querySelector('#go-register');
    if(goReg) goReg.addEventListener('click', function(){
      root.innerHTML = renderRegisterView(accounts.length > 0);
      wireRegisterView(root);
    });
  }

  function wirePasswordStep(root, account){
    root.querySelector('#back-to-tiles').addEventListener('click', showLoginScreen);
    var form = root.querySelector('#login-form');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var pass = root.querySelector('#login-pass').value;
      var errBox = root.querySelector('#login-err');
      errBox.textContent = '';
      login(account.username, pass).then(function(res){
        if(!res.ok){ errBox.textContent = res.error; return; }
        enterDesktopAfterAuth();
      });
    });
  }

  function wireRegisterView(root){
    var selectedColor = AVATAR_COLORS[0];
    root.querySelectorAll('.auth-avatar-opt').forEach(function(opt){
      opt.addEventListener('click', function(){
        root.querySelectorAll('.auth-avatar-opt').forEach(function(o){ o.classList.remove('selected'); });
        opt.classList.add('selected');
        selectedColor = opt.getAttribute('data-color');
      });
    });
    var back = root.querySelector('#back-to-tiles2');
    if(back) back.addEventListener('click', showLoginScreen);
    root.querySelector('#register-form').addEventListener('submit', function(e){
      e.preventDefault();
      var username = root.querySelector('#reg-username').value;
      var display = root.querySelector('#reg-display').value || username;
      var pass = root.querySelector('#reg-pass').value;
      var confirm = root.querySelector('#reg-confirm').value;
      var uErrBox = root.querySelector('#reg-uerr'), pErrBox = root.querySelector('#reg-perr');
      uErrBox.textContent = ''; pErrBox.textContent = '';
      register({ username:username, displayName:display, password:pass, confirm:confirm, avatarColor:selectedColor }).then(function(res){
        if(!res.ok){
          if(/username/i.test(res.error)) uErrBox.textContent = res.error; else pErrBox.textContent = res.error;
          return;
        }
        return login(username, pass).then(function(){ enterDesktopAfterAuth(); });
      });
    });
  }

  function enterDesktopAfterAuth(){
    hideAuthScreens();
    emit('enter-desktop', { userId: session.id });
  }

  /* ---------------- lock screen ---------------- */
  var lockClockTimer = null;
  function showLockScreen(){
    if(!session) return;
    if(document.getElementById('lock-screen')) return;
    var root = document.createElement('div');
    root.id = 'lock-screen';
    root.innerHTML =
      mark('lock-arcs') +
      '<div class="lock-clock" id="lock-clock-time">--:--</div>'+
      '<div class="lock-date" id="lock-clock-date"></div>'+
      '<div class="lock-card">'+
        avatarHtml(session.avatarColor,(session.displayName||session.username).charAt(0).toUpperCase(),64)+
        '<div class="name">'+esc(session.displayName)+'</div>'+
        '<div class="lock-unlock-row"><input type="password" id="lock-pass" placeholder="Password" autofocus/>'+
        '<button class="btn btn-primary" id="lock-go">'+svg('chevronRight')+'</button></div>'+
        '<div class="field-error" id="lock-err"></div>'+
      '</div>'+
      '<button class="lock-switch" id="lock-switch-user">Switch account</button>';
    document.getElementById('app').appendChild(root);

    function tick(){
      var d = new Date();
      var fmt = (OS.Storage.getUserSettings(session.id)||{}).timeFormat || '24';
      var t = document.getElementById('lock-clock-time'); if(t) t.textContent = OS.Util.fmtClockTime(d, fmt);
      var dd = document.getElementById('lock-clock-date'); if(dd) dd.textContent = OS.Util.fmtDateLong(d);
    }
    tick();
    lockClockTimer = setInterval(tick, 1000*10);

    function tryUnlock(){
      var pass = document.getElementById('lock-pass').value;
      unlock(pass).then(function(ok){
        if(!ok){ document.getElementById('lock-err').textContent = 'Incorrect password.'; return; }
      });
    }
    root.querySelector('#lock-go').addEventListener('click', tryUnlock);
    root.querySelector('#lock-pass').addEventListener('keydown', function(e){ if(e.key==='Enter') tryUnlock(); });
    root.querySelector('#lock-switch-user').addEventListener('click', function(){ logout(); });
  }

  function hideAuthScreens(){
    if(lockClockTimer){ clearInterval(lockClockTimer); lockClockTimer = null; }
    var a = document.getElementById('auth-screen'); if(a) a.remove();
    var l = document.getElementById('lock-screen'); if(l) l.remove();
  }

  OS.Auth = {
    currentUser: currentUser,
    listAccountsPublic: listAccountsPublic,
    register: register,
    login: login,
    logout: logout,
    lock: lock,
    unlock: unlock,
    resumeSession: resumeSession,
    showLoginScreen: showLoginScreen,
    showLockScreen: showLockScreen,
    hideAuthScreens: hideAuthScreens,
    changePassword: changePassword,
    updateProfile: updateProfile,
    deleteAccount: deleteAccount,
    avatarHtml: avatarHtml,
    AVATAR_COLORS: AVATAR_COLORS
  };

})(window);
