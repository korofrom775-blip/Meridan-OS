/* =================================================================
   MERIDIAN OS — Taskbar + Start menu (the "shell")
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml;

  var userId, clockTimer;

  function init(uid){
    userId = uid;
    document.getElementById('taskbar').classList.remove('u-hidden');
    renderStartButton();
    renderTaskbarApps();
    renderTray();
    wireGlobal();
    startClock();
    applyAutohide();
    document.addEventListener('meridian:window-opened', renderTaskbarApps);
    document.addEventListener('meridian:window-closed', renderTaskbarApps);
    document.addEventListener('meridian:window-focused', renderTaskbarApps);
    document.addEventListener('meridian:window-minimized', renderTaskbarApps);
    document.addEventListener('meridian:window-restored', renderTaskbarApps);
    document.addEventListener('meridian:window-changed', renderTaskbarApps);
    document.addEventListener('meridian:settings-changed', onSettingsChanged);
    document.addEventListener('meridian:profile-refresh', renderTray);
  }

  function teardown(){
    document.getElementById('taskbar').classList.add('u-hidden');
    closeStartMenu(true);
    OS.UI.toggleNotifCenter(false);
    if(clockTimer) clearInterval(clockTimer);
  }

  function onSettingsChanged(){
    applyAutohide();
  }

  function renderStartButton(){
    var btn = document.getElementById('start-btn');
    btn.innerHTML = OS.Icons.mark('small');
  }

  function renderTaskbarApps(){
    var wrap = document.getElementById('taskbar-apps');
    var open = OS.WM.getOpenWindows();
    var pinned = OS.Desktop.pinnedAppIds();
    var entries = [];
    pinned.forEach(function(appId){
      var openWin = open.filter(function(w){ return w.appId===appId; })[0];
      entries.push({ appId:appId, win: openWin||null });
    });
    open.forEach(function(w){
      if(pinned.indexOf(w.appId) === -1) entries.push({ appId:w.appId, win:w });
    });
    wrap.innerHTML = entries.map(function(e){
      var appDef = OS.Apps.get(e.appId);
      if(!appDef) return '';
      var running = !!e.win;
      var focused = running && e.win.focused && !e.win.minimized;
      return '<div class="taskbar-app'+(focused?' focused':'')+'" data-app="'+e.appId+'" data-winid="'+(running?e.win.id:'')+'">'+
        '<span class="glyph">'+svg(appDef.icon)+'</span><span class="lbl">'+esc(running?e.win.title:appDef.name)+'</span>'+
        (running?'<span class="dot"></span>':'')+
      '</div>';
    }).join('');
    wrap.querySelectorAll('.taskbar-app').forEach(function(node){
      node.addEventListener('click', function(){
        var appId = node.getAttribute('data-app'), winId = node.getAttribute('data-winid');
        if(!winId){ OS.WM.openWindow(appId); return; }
        var w = OS.WM.getWindow(winId);
        if(!w) return;
        if(w.minimized){ OS.WM.restoreWindow(winId); OS.WM.focusWindow(winId); }
        else if(w.el.classList.contains('focused')){ OS.WM.minimizeWindow(winId); }
        else { OS.WM.focusWindow(winId); }
      });
      node.addEventListener('contextmenu', function(e){
        e.preventDefault();
        var appId = node.getAttribute('data-app'), winId = node.getAttribute('data-winid');
        var pinned2 = OS.Desktop.isPinned(appId);
        var items = [
          { label:'Open new window', icon:'square', action:function(){ OS.WM.openWindow(appId); } },
          { label: pinned2?'Unpin from taskbar':'Pin to taskbar', icon:'bookmark', action:function(){ OS.Desktop.togglePin(appId); renderTaskbarApps(); } }
        ];
        if(winId){ items.push({ divider:true }, { label:'Close window', icon:'close', danger:true, action:function(){ OS.WM.closeWindow(winId); } }); }
        OS.UI.showContextMenu(e.clientX, e.clientY, items);
      });
    });
  }

  function renderTray(){
    var tray = document.getElementById('tray');
    var session = OS.Auth.currentUser();
    tray.innerHTML =
      '<button class="tray-btn" id="tray-notif-btn">'+svg('bell')+'<span class="tray-badge u-hidden" id="tray-notif-badge">0</span></button>'+
      '<div class="tray-btn" id="tray-clock"><div class="t" id="tray-clock-t">--:--</div><div class="d" id="tray-clock-d">—</div></div>'+
      '<button class="tray-btn" id="tray-user-btn">'+OS.Auth.avatarHtml(session.avatarColor,(session.displayName||session.username).charAt(0).toUpperCase(),26)+'</button>';
    document.getElementById('tray-notif-btn').addEventListener('click', function(){ OS.UI.toggleNotifCenter(); });
    document.getElementById('tray-user-btn').addEventListener('click', showUserMenu);
    tickClock();
  }

  function showUserMenu(e){
    var session = OS.Auth.currentUser();
    var rect = e.currentTarget.getBoundingClientRect();
    OS.UI.showContextMenu(rect.right-200, rect.top-150, [
      { label: session.displayName, icon:'user', disabled:true },
      { divider:true },
      { label:'Lock', icon:'lock', action:function(){ OS.Auth.lock(); } },
      { label:'Sign out', icon:'power', action:function(){ OS.Auth.logout(); } }
    ]);
  }

  function tickClock(){
    var settings = OS.Storage.getUserSettings(userId);
    var d = new Date();
    var t = document.getElementById('tray-clock-t');
    var dd = document.getElementById('tray-clock-d');
    if(t) t.textContent = OS.Util.fmtClockTime(d, settings.timeFormat);
    if(dd) dd.textContent = d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  }
  function startClock(){ tickClock(); clockTimer = setInterval(tickClock, 15000); }

  /* ---------------- start menu ---------------- */
  var startMenuOpen = false;
  function toggleStartMenu(){ startMenuOpen ? closeStartMenu() : openStartMenu(); }
  function openStartMenu(opts){
    opts = opts || {};
    closeStartMenu(true);
    startMenuOpen = true;
    document.getElementById('start-btn').classList.add('active');
    var panel = document.createElement('div');
    panel.id = 'start-menu';
    panel.className = 'glass';
    var session = OS.Auth.currentUser();
    panel.innerHTML =
      '<div class="sm-search"><span style="color:var(--paper-faint);">'+svg('search')+'</span><input id="sm-search-input" placeholder="Search apps"/></div>'+
      '<div class="sm-body" id="sm-body"></div>'+
      '<div class="sm-foot">'+
        '<div class="sm-user">'+OS.Auth.avatarHtml(session.avatarColor,(session.displayName||session.username).charAt(0).toUpperCase(),30)+'<span class="name">'+esc(session.displayName)+'</span></div>'+
        '<div class="sm-foot-actions">'+
          '<button id="sm-lock" title="Lock">'+svg('lock')+'</button>'+
          '<button id="sm-power" title="Power">'+svg('power')+'</button>'+
        '</div>'+
      '</div>';
    document.getElementById('app').appendChild(panel);
    renderStartBody('');
    var input = panel.querySelector('#sm-search-input');
    if(opts.focusSearch !== false) input.focus();
    input.addEventListener('input', function(){ renderStartBody(input.value.trim().toLowerCase()); });
    panel.querySelector('#sm-lock').addEventListener('click', function(){ closeStartMenu(); OS.Auth.lock(); });
    panel.querySelector('#sm-power').addEventListener('click', showPowerMenu);
    setTimeout(function(){ document.addEventListener('mousedown', startOutside, true); }, 0);
  }
  function startOutside(e){
    var panel = document.getElementById('start-menu');
    var btn = document.getElementById('start-btn');
    var search = document.getElementById('task-search');
    if(panel && !panel.contains(e.target) && !btn.contains(e.target) && !(search && search.contains(e.target))) closeStartMenu();
  }
  function closeStartMenu(skipAnim){
    var panel = document.getElementById('start-menu');
    document.getElementById('start-btn').classList.remove('active');
    startMenuOpen = false;
    document.removeEventListener('mousedown', startOutside, true);
    if(!panel) return;
    if(skipAnim){ panel.remove(); return; }
    panel.classList.add('closing');
    setTimeout(function(){ panel.remove(); }, 110);
  }

  function renderStartBody(query){
    var body = document.getElementById('sm-body');
    if(!body) return;
    var apps = OS.Apps.launchable();
    if(query){
      var filtered = apps.filter(function(a){ return a.name.toLowerCase().indexOf(query)!==-1; });
      body.innerHTML = '<div class="sm-section-title">Results</div>'+
        (filtered.length ? filtered.map(listItem).join('') : '<div class="sm-empty">No apps match "'+esc(query)+'"</div>');
      wireList(body);
      return;
    }
    var pinnedIds = OS.Desktop.pinnedAppIds();
    var pinnedApps = pinnedIds.map(function(id){ return OS.Apps.get(id); }).filter(Boolean);
    body.innerHTML =
      '<div class="sm-section-title">Pinned</div>'+
      '<div class="sm-pinned-grid">'+(pinnedApps.length ? pinnedApps.map(tile).join('') : '<div class="sm-empty" style="grid-column:1/-1;">Pin apps from their right-click menu</div>')+'</div>'+
      '<div class="sm-section-title">All apps</div>'+
      apps.map(listItem).join('');
    wireList(body);
  }
  function tile(a){ return '<div class="sm-tile" data-app="'+a.id+'"><span class="glyph">'+svg(a.icon)+'</span><span class="lbl">'+esc(a.name)+'</span></div>'; }
  function listItem(a){ return '<div class="sm-list-item" data-app="'+a.id+'"><span class="glyph">'+svg(a.icon)+'</span><span class="lbl">'+esc(a.name)+'</span></div>'; }
  function wireList(body){
    body.querySelectorAll('[data-app]').forEach(function(node){
      node.addEventListener('click', function(){ OS.WM.openWindow(node.getAttribute('data-app')); closeStartMenu(); });
      node.addEventListener('contextmenu', function(e){
        e.preventDefault();
        var appId = node.getAttribute('data-app');
        var pinned = OS.Desktop.isPinned(appId);
        OS.UI.showContextMenu(e.clientX, e.clientY, [
          { label: pinned?'Unpin from taskbar':'Pin to taskbar', icon:'bookmark', action:function(){ OS.Desktop.togglePin(appId); renderTaskbarApps(); } }
        ]);
      });
    });
  }

  function showPowerMenu(e){
    var rect = e.currentTarget.getBoundingClientRect();
    OS.UI.showContextMenu(rect.left, rect.top-150, [
      { label:'Lock', icon:'lock', action:function(){ closeStartMenu(); OS.Auth.lock(); } },
      { label:'Sign out', icon:'user', action:function(){ closeStartMenu(); OS.Auth.logout(); } },
      { label:'Restart', icon:'refresh', action:function(){ closeStartMenu(); location.reload(); } },
      { label:'Shut down', icon:'power', danger:true, action:function(){ closeStartMenu(); shutdownSequence(); } }
    ]);
  }
  function shutdownSequence(){
    var overlay = document.createElement('div');
    overlay.id = 'boot-screen';
    overlay.style.zIndex = '1100';
    overlay.innerHTML = OS.Icons.mark()+'<div class="boot-word">Shutting down…</div>';
    document.getElementById('app').appendChild(overlay);
    setTimeout(function(){ OS.Auth.logout(); overlay.remove(); }, 1100);
  }

  /* ---------------- search box in taskbar ---------------- */
  function wireGlobal(){
    document.getElementById('start-btn').addEventListener('click', toggleStartMenu);
    var searchInput = document.getElementById('task-search-input');
    if(searchInput){
      searchInput.addEventListener('focus', function(){
        if(!startMenuOpen) openStartMenu({ focusSearch:false });
        var smInput = document.getElementById('sm-search-input');
        if(smInput){ smInput.value = searchInput.value; }
        renderStartBody(searchInput.value.trim().toLowerCase());
      });
      searchInput.addEventListener('input', function(){
        if(!startMenuOpen) openStartMenu({ focusSearch:false });
        var smInput = document.getElementById('sm-search-input');
        if(smInput) smInput.value = searchInput.value;
        renderStartBody(searchInput.value.trim().toLowerCase());
      });
    }
    document.getElementById('taskbar-edge-hint').addEventListener('mouseenter', function(){
      if(OS.Storage.getUserSettings(userId).taskbarAutohide) document.getElementById('taskbar').classList.remove('autohide-hidden');
    });
    document.getElementById('taskbar').addEventListener('mouseleave', function(){
      if(OS.Storage.getUserSettings(userId).taskbarAutohide) document.getElementById('taskbar').classList.add('autohide-hidden');
    });
  }
  function applyAutohide(){
    var on = OS.Storage.getUserSettings(userId).taskbarAutohide;
    document.getElementById('taskbar').classList.toggle('autohide-hidden', !!on);
  }

  OS.Shell = { init:init, teardown:teardown, renderTaskbarApps:renderTaskbarApps, renderTray:renderTray };

})(window);
