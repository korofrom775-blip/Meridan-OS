/* =================================================================
   MERIDIAN OS — UI kit: icons, toasts, notifications, context menus, modals
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};

  /* -----------------------------------------------------------------
     ICONS — small inline SVG set, one consistent stroke language
     ----------------------------------------------------------------- */
  var PATHS = {
    search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    bell:'<path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10z"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/>',
    lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/>',
    unlock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7-2.6"/>',
    power:'<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
    chevronLeft:'<path d="M15 5l-7 7 7 7"/>',
    chevronRight:'<path d="M9 5l7 7-7 7"/>',
    chevronDown:'<path d="M5 9l7 7 7-7"/>',
    close:'<path d="M6 6l12 12M18 6L6 18"/>',
    minus:'<path d="M5 12h14"/>',
    square:'<rect x="5" y="5" width="14" height="14" rx="2"/>',
    restore:'<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 16V6a1 1 0 0 1 1-1h10"/>',
    folder:'<path d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z"/>',
    folderPlus:'<path d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z"/><path d="M12 12v4M10 14h4"/>',
    fileText:'<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 16h6"/>',
    filePlus:'<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M12 12v4M10 14h4"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M3 17l5-5 4 4 3-3 6 6"/>',
    download:'<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 19h14"/>',
    star:'<path d="M12 4l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 16.4 6.9 19.2l1.2-5.6L4 9.8l5.6-.6z"/>',
    starFilled:'<path d="M12 4l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 16.4 6.9 19.2l1.2-5.6L4 9.8l5.6-.6z" class="icon-fill" fill="currentColor"/>',
    refresh:'<path d="M4 10a8 8 0 0 1 14.5-4.5M20 14a8 8 0 0 1-14.5 4.5"/><path d="M18 3v5h-5M6 21v-5h5"/>',
    home:'<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
    arrowLeft:'<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
    arrowRight:'<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    trash:'<path d="M5 7h14"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M7 7l1 13h8l1-13"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 13.8a7.8 7.8 0 0 0 0-3.6l2-1.6-2-3.4-2.4 1a7.7 7.7 0 0 0-3.1-1.8L13.5 2h-3l-.4 2.4a7.7 7.7 0 0 0-3.1 1.8l-2.4-1-2 3.4 2 1.6a7.8 7.8 0 0 0 0 3.6l-2 1.6 2 3.4 2.4-1a7.7 7.7 0 0 0 3.1 1.8l.4 2.4h3l.4-2.4a7.7 7.7 0 0 0 3.1-1.8l2.4 1 2-3.4z"/>',
    monitor:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    volume:'<path d="M5 9v6h4l5 4V5l-5 4H5z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    palette:'<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5-.5-2.5S14 15 15 15h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="9.5" cy="7.3" r="1"/><circle cx="14.5" cy="7.3" r="1"/><circle cx="16.5" cy="11" r="1"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    edit:'<path d="M4 20l1-4 11-11 3 3-11 11-4 1z"/><path d="M13 6l3 3"/>',
    terminal:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>',
    calculator:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><circle cx="8" cy="12" r="0.7" class="icon-fill" fill="currentColor"/><circle cx="12" cy="12" r="0.7" class="icon-fill" fill="currentColor"/><circle cx="16" cy="12" r="0.7" class="icon-fill" fill="currentColor"/><circle cx="8" cy="16" r="0.7" class="icon-fill" fill="currentColor"/><circle cx="12" cy="16" r="0.7" class="icon-fill" fill="currentColor"/><circle cx="16" cy="16" r="0.7" class="icon-fill" fill="currentColor"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.8" class="icon-fill" fill="currentColor"/>',
    check:'<path d="M5 12l5 5 9-10"/>',
    moon:'<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    sun:'<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    more:'<circle cx="5" cy="12" r="1.3" class="icon-fill" fill="currentColor"/><circle cx="12" cy="12" r="1.3" class="icon-fill" fill="currentColor"/><circle cx="19" cy="12" r="1.3" class="icon-fill" fill="currentColor"/>',
    shield:'<path d="M12 3l8 3v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    desktop:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    history:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
    bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
    sparkle:'<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
    layout:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    save:'<path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 4v6h7V4"/><path d="M8 21v-6h8v6"/>',
    externalLink:'<path d="M9 6H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3"/><path d="M21 3h-6m6 0v6m0-6L11 13"/>',
    pin:'<path d="M9 4h6l1 6 3 3v2H5v-2l3-3z"/><path d="M12 15v6"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
  };
  function svg(name, cls){
    var inner = PATHS[name] || PATHS.info;
    return '<svg class="icon'+(cls?(' '+cls):'')+'" viewBox="0 0 24 24" aria-hidden="true">'+inner+'</svg>';
  }
  function meridianMark(cls){
    return '<div class="meridian-mark'+(cls?(' '+cls):'')+'">'+
      '<svg viewBox="0 0 120 120" aria-hidden="true">'+
        '<circle cx="60" cy="60" r="58" fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-width="1.5"/>'+
        '<g class="arcs" fill="none" stroke="currentColor" stroke-width="1.5">'+
          '<ellipse cx="60" cy="60" rx="20" ry="58" stroke-opacity="0.85"/>'+
          '<ellipse cx="60" cy="60" rx="40" ry="58" stroke-opacity="0.5"/>'+
          '<ellipse cx="60" cy="60" rx="58" ry="58" stroke-opacity="0.28"/>'+
          '<line x1="2" y1="60" x2="118" y2="60" stroke-opacity="0.3"/>'+
        '</g>'+
        '<circle cx="60" cy="60" r="5" fill="currentColor"/>'+
      '</svg>'+
    '</div>';
  }
  OS.Icons = { svg:svg, mark:meridianMark, has:function(n){ return !!PATHS[n]; } };

  /* -----------------------------------------------------------------
     small shared utilities
     ----------------------------------------------------------------- */
  function escapeHtml(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function debounce(fn, wait){
    var t; return function(){
      var args = arguments, ctx = this;
      clearTimeout(t); t = setTimeout(function(){ fn.apply(ctx,args); }, wait);
    };
  }
  function timeAgo(ts){
    var s = Math.floor((Date.now()-ts)/1000);
    if(s < 10) return 'just now';
    if(s < 60) return s+'s ago';
    var m = Math.floor(s/60); if(m < 60) return m+'m ago';
    var h = Math.floor(m/60); if(h < 24) return h+'h ago';
    var d = Math.floor(h/24); return d+'d ago';
  }
  function fmtClockTime(d, fmt){
    var h = d.getHours(), m = d.getMinutes();
    if(fmt === '12'){
      var suffix = h >= 12 ? 'PM':'AM';
      var h12 = h % 12; if(h12 === 0) h12 = 12;
      return h12 + ':' + String(m).padStart(2,'0') + ' ' + suffix;
    }
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  }
  function fmtDateLong(d){
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
  }
  function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
  function dayLabel(ts){
    var d = new Date(ts), now = new Date();
    if(sameDay(d,now)) return 'Today';
    var y = new Date(now); y.setDate(y.getDate()-1);
    if(sameDay(d,y)) return 'Yesterday';
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();
  }
  function downloadBlob(filename, content, mime){
    var blob = new Blob([content], {type: mime || 'text/plain'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    return blob.size;
  }
  OS.Util = { escapeHtml:escapeHtml, clamp:clamp, debounce:debounce, timeAgo:timeAgo, fmtClockTime:fmtClockTime, fmtDateLong:fmtDateLong, dayLabel:dayLabel, downloadBlob:downloadBlob };

  /* -----------------------------------------------------------------
     TOAST + NOTIFICATION CENTER
     ----------------------------------------------------------------- */
  var toastStack, notifBtn, notifBadge, notifCenterEl;
  var notifications = [];
  var centerOpen = false;

  function initNotif(){
    toastStack = document.getElementById('toast-stack');
  }

  function toast(opts){
    if(typeof opts === 'string') opts = { title: opts };
    if(!toastStack) initNotif();
    if(!toastStack) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = svg(opts.icon||'info','glyph') +
      '<div><div class="title">'+escapeHtml(opts.title||'')+'</div>'+
      (opts.body? '<div class="body">'+escapeHtml(opts.body)+'</div>' : '')+'</div>';
    toastStack.appendChild(el);
    var dur = opts.duration || 3200;
    var timer = setTimeout(remove, dur);
    function remove(){
      clearTimeout(timer);
      el.classList.add('leaving');
      setTimeout(function(){ el.remove(); }, 180);
    }
    el.addEventListener('click', remove);
    return remove;
  }

  function notify(appName, title, body, icon){
    var session = OS.Auth ? OS.Auth.currentUser() : null;
    var item = { id: OS.Storage.uid('n'), app: appName, title: title, body: body||'', icon: icon||'bell', ts: Date.now(), read:false };
    notifications.unshift(item);
    notifications = notifications.slice(0, 60);
    if(session){ OS.Storage.setNotifications(session.id, notifications); }
    var dnd = session && OS.Storage.getUserSettings(session.id).dndNotifications;
    if(!dnd) toast({ title: title, body: body, icon: icon });
    renderNotifBadge();
    if(centerOpen) renderNotifList();
  }

  function loadNotifications(userId){
    notifications = OS.Storage.getNotifications(userId) || [];
    renderNotifBadge();
  }

  function renderNotifBadge(){
    notifBadge = document.getElementById('tray-notif-badge');
    if(!notifBadge) return;
    var unread = notifications.filter(function(n){ return !n.read; }).length;
    if(unread > 0){ notifBadge.textContent = unread > 9 ? '9+' : String(unread); notifBadge.classList.remove('u-hidden'); }
    else { notifBadge.classList.add('u-hidden'); }
  }

  function renderNotifList(){
    var list = document.getElementById('notif-list');
    if(!list) return;
    if(notifications.length === 0){
      list.innerHTML = '<div class="nc-empty">'+svg('bell')+'<div style="margin-top:8px;">You\'re all caught up</div></div>';
      return;
    }
    list.innerHTML = notifications.map(function(n){
      return '<div class="nc-item">'+
        '<div class="top"><span class="app">'+escapeHtml(n.app)+'</span><span class="time">'+timeAgo(n.ts)+'</span></div>'+
        '<div class="title">'+escapeHtml(n.title)+'</div>'+
        (n.body? '<div class="body">'+escapeHtml(n.body)+'</div>' : '')+
      '</div>';
    }).join('');
  }

  function toggleNotifCenter(force){
    var existing = document.getElementById('notif-center');
    var shouldOpen = force !== undefined ? force : !existing;
    if(existing){ existing.classList.add('closing'); setTimeout(function(){ existing.remove(); }, 110); }
    var btn = document.getElementById('tray-notif-btn');
    if(btn) btn.classList.remove('active');
    if(!shouldOpen || existing){ centerOpen = false; return; }
    centerOpen = true;
    var panel = document.createElement('div');
    panel.id = 'notif-center';
    panel.className = 'glass';
    panel.innerHTML =
      '<div class="nc-head"><h3>Notifications</h3><button id="notif-clear">Clear all</button></div>'+
      '<div class="nc-list" id="notif-list"></div>';
    document.getElementById('app').appendChild(panel);
    if(btn) btn.classList.add('active');
    renderNotifList();
    notifications.forEach(function(n){ n.read = true; });
    var session = OS.Auth.currentUser();
    if(session) OS.Storage.setNotifications(session.id, notifications);
    renderNotifBadge();
    document.getElementById('notif-clear').addEventListener('click', function(){
      notifications = [];
      var s = OS.Auth.currentUser();
      if(s) OS.Storage.setNotifications(s.id, notifications);
      renderNotifList(); renderNotifBadge();
    });
    setTimeout(function(){
      document.addEventListener('mousedown', outsideClose, true);
    }, 0);
    function outsideClose(e){
      var el = document.getElementById('notif-center');
      if(!el) { document.removeEventListener('mousedown', outsideClose, true); return; }
      if(!el.contains(e.target) && e.target.id !== 'tray-notif-btn' && !(btn && btn.contains(e.target))){
        toggleNotifCenter(false);
        document.removeEventListener('mousedown', outsideClose, true);
      }
    }
  }

  OS.UI = OS.UI || {};
  OS.UI.toast = toast;
  OS.UI.notify = notify;
  OS.UI.loadNotifications = loadNotifications;
  OS.UI.toggleNotifCenter = toggleNotifCenter;
  OS.UI.clearNotifRuntime = function(){ notifications = []; centerOpen = false; };

  /* -----------------------------------------------------------------
     CONTEXT MENU — generic builder
     items: [{label, icon, action, danger, disabled, divider}]
     ----------------------------------------------------------------- */
  function closeContextMenu(){
    var el = document.querySelector('.ctx-menu');
    if(el) el.remove();
    document.removeEventListener('mousedown', ctxOutside, true);
    document.removeEventListener('keydown', ctxEsc, true);
  }
  function ctxOutside(e){
    var el = document.querySelector('.ctx-menu');
    if(el && !el.contains(e.target)) closeContextMenu();
  }
  function ctxEsc(e){ if(e.key === 'Escape') closeContextMenu(); }

  function showContextMenu(x, y, items){
    closeContextMenu();
    var menu = document.createElement('div');
    menu.className = 'ctx-menu glass';
    menu.innerHTML = items.map(function(it){
      if(it.divider) return '<div class="ctx-sep"></div>';
      return '<div class="ctx-item'+(it.danger?' danger':'')+(it.disabled?' disabled':'')+'" data-act="'+items.indexOf(it)+'">'+
        '<span class="glyph">'+(it.icon? svg(it.icon) : '')+'</span><span>'+escapeHtml(it.label)+'</span></div>';
    }).join('');
    document.getElementById('app').appendChild(menu);
    var w = menu.offsetWidth, h = menu.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;
    menu.style.left = Math.min(x, vw - w - 8) + 'px';
    menu.style.top = Math.min(y, vh - h - 8) + 'px';
    menu.querySelectorAll('.ctx-item').forEach(function(node){
      node.addEventListener('click', function(){
        var idx = +node.getAttribute('data-act');
        var it = items[idx];
        closeContextMenu();
        if(it && !it.disabled && typeof it.action === 'function') it.action();
      });
    });
    setTimeout(function(){
      document.addEventListener('mousedown', ctxOutside, true);
      document.addEventListener('keydown', ctxEsc, true);
    }, 0);
  }
  OS.UI.showContextMenu = showContextMenu;
  OS.UI.closeContextMenu = closeContextMenu;

  /* -----------------------------------------------------------------
     MODAL DIALOGS — confirm / prompt / custom
     ----------------------------------------------------------------- */
  function closeModal(){
    var scrim = document.querySelector('.scrim');
    if(scrim) scrim.remove();
  }
  function openModal(html, onMount){
    closeModal();
    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = '<div class="modal">'+html+'</div>';
    document.getElementById('app').appendChild(scrim);
    scrim.addEventListener('mousedown', function(e){ if(e.target === scrim) closeModal(); });
    if(typeof onMount === 'function') onMount(scrim.querySelector('.modal'), closeModal);
    return scrim.querySelector('.modal');
  }
  function confirmDialog(opts){
    return new Promise(function(resolve){
      var html =
        '<div class="modal-head"><h3>'+escapeHtml(opts.title||'Are you sure?')+'</h3></div>'+
        '<div class="modal-body"><p>'+escapeHtml(opts.message||'')+'</p></div>'+
        '<div class="modal-foot"><button class="btn" data-x="cancel">'+escapeHtml(opts.cancelLabel||'Cancel')+'</button>'+
        '<button class="btn '+(opts.danger?'btn-danger':'btn-primary')+'" data-x="ok">'+escapeHtml(opts.okLabel||'Confirm')+'</button></div>';
      openModal(html, function(modal, close){
        modal.querySelector('[data-x="cancel"]').addEventListener('click', function(){ close(); resolve(false); });
        modal.querySelector('[data-x="ok"]').addEventListener('click', function(){ close(); resolve(true); });
      });
    });
  }
  function promptDialog(opts){
    return new Promise(function(resolve){
      var html =
        '<div class="modal-head"><h3>'+escapeHtml(opts.title||'Enter a value')+'</h3></div>'+
        '<div class="modal-body"><div class="field"><input type="text" id="prompt-input" value="'+escapeHtml(opts.value||'')+'" placeholder="'+escapeHtml(opts.placeholder||'')+'"/><div class="field-error" id="prompt-err"></div></div></div>'+
        '<div class="modal-foot"><button class="btn" data-x="cancel">Cancel</button><button class="btn btn-primary" data-x="ok">'+escapeHtml(opts.okLabel||'Save')+'</button></div>';
      openModal(html, function(modal, close){
        var input = modal.querySelector('#prompt-input');
        input.focus(); input.select();
        function submit(){
          var val = input.value.trim();
          if(opts.validate){
            var err = opts.validate(val);
            if(err){ modal.querySelector('#prompt-err').textContent = err; return; }
          }
          close(); resolve(val);
        }
        modal.querySelector('[data-x="cancel"]').addEventListener('click', function(){ close(); resolve(null); });
        modal.querySelector('[data-x="ok"]').addEventListener('click', submit);
        input.addEventListener('keydown', function(e){ if(e.key === 'Enter') submit(); });
      });
    });
  }
  OS.UI.openModal = openModal;
  OS.UI.closeModal = closeModal;
  OS.UI.confirm = confirmDialog;
  OS.UI.prompt = promptDialog;

})(window);
