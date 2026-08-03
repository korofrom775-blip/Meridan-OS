/* =================================================================
   MERIDIAN OS — Browser app
   A client-side, sandboxed browser: typed addresses or searches load
   in a normal iframe — exactly how any browser tab loads a page, with
   no server in between. Some sites set headers that refuse embedding
   in any iframe anywhere on the web (see the note in render()); that
   is the site's own choice, and this app does not try to work around
   it. See the project README for a longer explanation.
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml, uid = OS.Storage.uid;

  var SEARCH_ENGINES = {
    bing:       { label:'Bing',       url:'https://www.bing.com/search?q=' },
    duckduckgo: { label:'DuckDuckGo', url:'https://html.duckduckgo.com/html/?q=' },
    wikipedia:  { label:'Wikipedia',  url:'https://en.wikipedia.org/w/index.php?search=' },
    startpage:  { label:'Startpage',  url:'https://www.startpage.com/sp/search?query=' },
    brave:      { label:'Brave Search', url:'https://search.brave.com/search?q=' },
    google:     { label:'Google',       url:'https://www.google.com/search?q=' }
  };
  var QUICK_LINKS = [
    { name:'Wikipedia',        url:'https://www.wikipedia.org' },
    { name:'GitHub',           url:'https://github.com' },
    { name:'MDN Web Docs',     url:'https://developer.mozilla.org' },
    { name:'Hacker News',      url:'https://news.ycombinator.com' },
    { name:'Internet Archive', url:'https://archive.org' },
    { name:'Bing',             url:'https://www.bing.com' }
  ];
  var HOME = 'meridian://home';

  var IS_ELECTRON = !!(global.meridianElectron && global.meridianElectron.isElectron);

  // Same-origin relative path — works wherever this app is actually
  // hosted (localhost during development, or whatever domain the proxy
  // server ends up deployed to) since proxy.js serves this app itself.
  var PROXY_BASE = '/proxy?url=';
  function viaProxy(url){
    if(IS_ELECTRON) return url; // <webview> loads real URLs directly, no proxy needed
    return PROXY_BASE ? PROXY_BASE + encodeURIComponent(url) : url;
  }

  // YouTube's full site can't run inside a proxied iframe (Service Workers,
  // DRM, anti-embed detection). Its official embed player is built to be
  // embedded though, so detect watch URLs and use that instead.
  function youtubeEmbedUrl(url){
    var m;
    m = url.match(/^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?[^#]*[?&]?v=([\w-]{6,})/i);
    if(m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    m = url.match(/^https?:\/\/youtu\.be\/([\w-]{6,})/i);
    if(m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    m = url.match(/^https?:\/\/(?:www\.)?youtube\.com\/shorts\/([\w-]{6,})/i);
    if(m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    return null;
  }
  var ZOOM_MIN = 0.5, ZOOM_MAX = 2;

  function hostnameOf(url){
    try{ return new URL(url).hostname.replace(/^www\./,''); }catch(e){ return url; }
  }
  function looksLikeUrl(s){
    if(/^https?:\/\//i.test(s)) return true;
    if(/\s/.test(s)) return false;
    if(/^localhost(:\d+)?(\/.*)?$/i.test(s)) return true;
    return /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s);
  }
  function normalize(raw, engine){
    var s = (raw||'').trim();
    if(!s) return HOME;
    if(/^meridian:\/\//i.test(s)) return s.toLowerCase();
    if(looksLikeUrl(s)) return /^https?:\/\//i.test(s) ? s : 'https://'+s;
    var eng = SEARCH_ENGINES[engine] || SEARCH_ENGINES.bing;
    return eng.url + encodeURIComponent(s);
  }

  function buildBrowser(ctx){
    var session = OS.Auth.currentUser();
    var userId = session.id;
    var bset = OS.Storage.getBrowserSettings(userId);
    var tabs = [];
    var activeId = null;
    var loadWatchdog = null;
    var closedStack = [];
    var suggestSel = -1;

    ctx.bodyEl.innerHTML =
      '<div class="br-shell">'+
        '<div class="br-tabstrip"><div class="br-tabs" id="br-tabs"></div><button class="br-newtab" id="br-newtab" title="New tab">'+svg('plus')+'</button></div>'+
        '<div class="br-navbar">'+
          '<button class="navbtn" data-nav="back" title="Back">'+svg('arrowLeft')+'</button>'+
          '<button class="navbtn" data-nav="fwd" title="Forward">'+svg('arrowRight')+'</button>'+
          '<button class="navbtn" data-nav="reload" title="Reload">'+svg('refresh')+'</button>'+
          '<button class="navbtn" data-nav="home" title="Home">'+svg('home')+'</button>'+
          '<div class="br-addr"><span class="lock">'+svg('lock')+'</span><input id="br-addr-input" placeholder="Search or enter an address"/><span class="star" id="br-star" title="Bookmark this page">'+svg('star')+'</span><div class="br-suggest" id="br-suggest"></div></div>'+
          '<button class="navbtn" data-nav="openexternal" title="Open in a new browser tab">'+svg('externalLink')+'</button>'+
          '<button class="br-menu-btn" id="br-menu" title="More">'+svg('more')+'</button>'+
        '</div>'+
        '<div class="br-bookbar" id="br-bookbar"></div>'+
        '<div class="br-viewport" id="br-viewport">'+
          '<div class="br-loadbar" id="br-loadbar" style="width:0;opacity:0;"></div>'+
          /* no allow-popups / allow-popups-to-escape-sandbox: keeps target="_blank" links and window.open() from inside loaded pages
             from spawning real new browser tabs. Use the "Open in new browser tab" button for that instead. */
          (IS_ELECTRON
            ? '<webview id="br-frame" src="about:blank" allowpopups></webview>'
            : '<iframe id="br-frame" sandbox="allow-scripts allow-forms allow-same-origin" referrerpolicy="no-referrer"></iframe>')+
          '<div class="br-page" id="br-page-home"></div>'+
          '<div class="br-page" id="br-page-history"></div>'+
          '<div class="br-page" id="br-page-downloads"></div>'+
          '<div class="br-page" id="br-page-settings"></div>'+
          '<div class="br-frame-note" id="br-note"></div>'+
        '</div>'+
      '</div>';

    var els = {
      tabsWrap: ctx.bodyEl.querySelector('#br-tabs'),
      addr: ctx.bodyEl.querySelector('#br-addr-input'),
      suggest: ctx.bodyEl.querySelector('#br-suggest'),
      star: ctx.bodyEl.querySelector('#br-star'),
      frame: ctx.bodyEl.querySelector('#br-frame'),
      loadbar: ctx.bodyEl.querySelector('#br-loadbar'),
      note: ctx.bodyEl.querySelector('#br-note'),
      bookbar: ctx.bodyEl.querySelector('#br-bookbar'),
      back: ctx.bodyEl.querySelector('[data-nav="back"]'),
      fwd: ctx.bodyEl.querySelector('[data-nav="fwd"]'),
      openExternal: ctx.bodyEl.querySelector('[data-nav="openexternal"]'),
      pages:{
        home: ctx.bodyEl.querySelector('#br-page-home'),
        history: ctx.bodyEl.querySelector('#br-page-history'),
        downloads: ctx.bodyEl.querySelector('#br-page-downloads'),
        settings: ctx.bodyEl.querySelector('#br-page-settings')
      }
    };

    function newTab(url, opts){
      var t = { id: uid('tab'), title:'New Tab', url: url||HOME, stack:[url||HOME], idx:0, zoom:1, pinned:false, private: !!(opts && opts.private) };
      tabs.push(t);
      activeId = t.id;
      renderTabs();
      go(t, t.url, true);
      return t;
    }
    function activeTab(){ return tabs.filter(function(t){ return t.id===activeId; })[0]; }
    function closeTab(id){
      var idx = tabs.findIndex(function(t){ return t.id===id; });
      if(idx === -1) return;
      var closed = tabs[idx];
      if(!closed.private && !/^meridian:\/\//.test(closed.url)){
        closedStack.push({ url: closed.url });
        if(closedStack.length > 15) closedStack.shift();
      }
      tabs.splice(idx,1);
      if(!tabs.length){ ctx.close(); return; }
      if(activeId === id){ activeId = tabs[Math.max(0,idx-1)].id; }
      renderTabs();
      renderActive();
    }
    function reopenClosedTab(){
      if(!closedStack.length) return;
      newTab(closedStack.pop().url);
    }
    function cycleTab(dir){
      if(tabs.length < 2) return;
      var idx = tabs.findIndex(function(t){ return t.id===activeId; });
      idx = (idx + dir + tabs.length) % tabs.length;
      activeId = tabs[idx].id;
      renderTabs(); renderActive();
    }

    function renderTabs(){
      var order = tabs.filter(function(t){ return t.pinned; }).concat(tabs.filter(function(t){ return !t.pinned; }));
      els.tabsWrap.innerHTML = order.map(function(t){
        var icon = t.private ? 'eye' : (t.url===HOME ? 'sparkle' : 'globe');
        return '<div class="br-tab'+(t.id===activeId?' active':'')+(t.pinned?' pinned':'')+(t.private?' private':'')+'" data-id="'+t.id+'" title="'+esc(t.title)+'">'+
          '<span class="favicon">'+svg(icon)+'</span>'+
          '<span class="ttl">'+esc(t.title)+'</span>'+
          '<span class="closebtn" data-close="'+t.id+'">'+svg('close')+'</span></div>';
      }).join('');
      els.tabsWrap.querySelectorAll('.br-tab').forEach(function(node){
        node.addEventListener('click', function(e){
          if(e.target.closest('[data-close]')) return;
          activeId = node.getAttribute('data-id');
          renderTabs(); renderActive();
        });
        node.addEventListener('contextmenu', function(e){
          e.preventDefault();
          var id = node.getAttribute('data-id');
          var tb = tabs.filter(function(x){ return x.id===id; })[0];
          if(!tb) return;
          OS.UI.showContextMenu(e.clientX, e.clientY, [
            { label:'Duplicate tab', icon:'copy', action:function(){
                var nt = newTab(tb.url); nt.private = tb.private; renderTabs();
              } },
            { label: tb.pinned ? 'Unpin tab' : 'Pin tab', icon:'pin', action:function(){ tb.pinned = !tb.pinned; renderTabs(); } },
            { divider:true },
            { label:'Close other tabs', icon:'close', action:function(){
                tabs = tabs.filter(function(x){ return x.id===tb.id || x.pinned; });
                if(!tabs.some(function(x){ return x.id===activeId; })) activeId = tb.id;
                renderTabs(); renderActive();
              } },
            { label:'Close tab', icon:'close', danger:true, action:function(){ closeTab(tb.id); } }
          ]);
        });
      });
      els.tabsWrap.querySelectorAll('[data-close]').forEach(function(node){
        node.addEventListener('click', function(e){ e.stopPropagation(); closeTab(node.getAttribute('data-close')); });
      });
    }

    function titleFor(url){
      if(url === HOME) return 'New Tab';
      if(/^meridian:\/\/history/.test(url)) return 'History';
      if(/^meridian:\/\/downloads/.test(url)) return 'Downloads';
      if(/^meridian:\/\/settings/.test(url)) return 'Browser Settings';
      return hostnameOf(url);
    }

    function showInternalPage(name){
      Object.keys(els.pages).forEach(function(k){ els.pages[k].classList.toggle('visible', k===name); });
      ctx.bodyEl.querySelector('#br-viewport').classList.add('hidden-frame');
    }
    function hideInternalPages(){
      Object.keys(els.pages).forEach(function(k){ els.pages[k].classList.remove('visible'); });
      ctx.bodyEl.querySelector('#br-viewport').classList.remove('hidden-frame');
    }

    function startLoading(){
      els.loadbar.style.opacity = '1';
      els.loadbar.style.width = '0%';
      requestAnimationFrame(function(){ els.loadbar.style.width = '70%'; });
      hideFrameNote();
      clearTimeout(loadWatchdog);
      var watchedTab = activeTab();
      loadWatchdog = setTimeout(function(){ showFrameNote(watchedTab); }, 4500);
    }
    function finishLoading(){
      els.loadbar.style.width = '100%';
      clearTimeout(loadWatchdog);
      setTimeout(function(){ els.loadbar.style.opacity='0'; }, 220);
    }
    function showFrameNote(tab){
      if(!tab || tab.id !== activeId) return;
      els.note.innerHTML =
        'Taking a while, or showing blank? Some sites refuse to load inside another page.'+
        '<button class="btn btn-sm note-btn" id="note-openexternal">'+svg('externalLink')+' Open in new tab</button>'+
        '<button class="note-close" id="note-dismiss" title="Dismiss">'+svg('close')+'</button>';
      els.note.classList.add('visible');
      els.note.querySelector('#note-openexternal').addEventListener('click', function(){ window.open(tab.url, '_blank', 'noopener'); });
      els.note.querySelector('#note-dismiss').addEventListener('click', hideFrameNote);
    }
    function hideFrameNote(){ els.note.classList.remove('visible'); els.note.innerHTML=''; }

    function go(tab, rawInput, isInitial){
      var url = normalize(rawInput, bset.searchEngine);
      if(!isInitial){
        tab.stack = tab.stack.slice(0, tab.idx+1);
        tab.stack.push(url);
        tab.idx = tab.stack.length-1;
      }
      tab.url = url;
      tab.title = titleFor(url);
      renderTabs();
      if(tab.id === activeId) render(tab);
      if(!/^meridian:\/\//.test(url) && !tab.private){
        recordHistory(url, tab.title);
      }
    }

    function render(tab){
      els.addr.value = tab.url === HOME ? '' : tab.url;
      updateStar(tab.url);
      els.back.disabled = tab.idx <= 0;
      els.fwd.disabled = tab.idx >= tab.stack.length-1;
      els.openExternal.disabled = /^meridian:\/\//.test(tab.url);
      var m = tab.url.match(/^meridian:\/\/(\w+)/);
      if(m){
        hideInternalPages();
        hideFrameNote();
        if(m[1] === 'home') renderHome();
        else if(m[1] === 'history') renderHistoryPage();
        else if(m[1] === 'downloads') renderDownloadsPage();
        else if(m[1] === 'settings') renderSettingsPage();
        showInternalPage(m[1]);
      } else {
        hideInternalPages();
        startLoading();
        var yt = youtubeEmbedUrl(tab.url);
        els.frame.src = yt ? yt : viaProxy(tab.url);
        applyZoom(tab);
      }
    }
    function renderActive(){ var t = activeTab(); if(t) render(t); }

    function applyZoom(t){
      var z = (t && t.zoom) || 1;
      els.frame.style.transform = z===1 ? '' : 'scale('+z+')';
      els.frame.style.transformOrigin = '0 0';
      els.frame.style.width = z===1 ? '100%' : (100/z)+'%';
      els.frame.style.height = z===1 ? '100%' : (100/z)+'%';
    }
    function setZoom(t, delta){
      if(!t) return;
      t.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round((t.zoom+delta)*10)/10));
      applyZoom(t);
      OS.UI.toast({ title:'Zoom', body:Math.round(t.zoom*100)+'%', icon:'search' });
    }
    function reloadTab(t){
      if(!t) return;
      if(/^meridian:\/\//.test(t.url)) render(t);
      else { var u = t.url; els.frame.src='about:blank'; startLoading(); setTimeout(function(){ var yt=youtubeEmbedUrl(u); els.frame.src= yt ? yt : viaProxy(u); applyZoom(t); }, 30); }
    }

    els.frame.addEventListener(IS_ELECTRON ? 'did-finish-load' : 'load', finishLoading);

    // In Electron, <webview> navigates to the real URL directly (no proxy
    // shim needed) — its own nav events keep the address bar/history in sync.
    if(IS_ELECTRON){
      els.frame.addEventListener('did-navigate', syncFromWebview);
      els.frame.addEventListener('did-navigate-in-page', syncFromWebview);
    }
    function syncFromWebview(e){
      var t = activeTab(); if(!t) return;
      var url = e.url; if(!url || url === t.url || url === 'about:blank') return;
      t.url = url; t.title = titleFor(url);
      t.stack[t.idx] = url;
      renderTabs();
      els.addr.value = url;
      updateStar(url);
      if(!t.private) recordHistory(url, t.title);
    }

    // When PROXY_BASE is set, the proxy's injected shim posts the real URL of
    // whatever loaded inside the iframe (including clicks/redirects that happen
    // entirely inside the proxied page). Keep the address bar/history in sync.
    if(!IS_ELECTRON) window.addEventListener('message', function(e){
      if(!e.data || e.data.type !== 'meridian-nav' || !e.data.url) return;
      var t = activeTab(); if(!t) return;
      if(e.data.url === t.url) return;
      t.url = e.data.url; t.title = titleFor(t.url);
      t.stack[t.idx] = t.url; // in-page navigation replaces the current entry rather than pushing a new one
      renderTabs();
      els.addr.value = t.url;
      updateStar(t.url);
      if(!t.private) recordHistory(t.url, t.title);
    });

    /* ---- bookmarks ---- */
    function bookmarks(){ return OS.Storage.getBookmarks(userId); }
    function isBookmarked(url){ return bookmarks().some(function(b){ return b.url===url; }); }
    function updateStar(url){
      var on = !/^meridian:\/\//.test(url) && isBookmarked(url);
      els.star.innerHTML = svg(on?'starFilled':'star');
      els.star.classList.toggle('active', on);
      els.star.style.display = /^meridian:\/\//.test(url) ? 'none' : 'flex';
    }
    function toggleBookmark(){
      var t = activeTab(); if(!t || /^meridian:\/\//.test(t.url)) return;
      var list = bookmarks();
      if(isBookmarked(t.url)){ list = list.filter(function(b){ return b.url !== t.url; }); }
      else { list.push({ id:uid('bm'), url:t.url, title:t.title }); OS.UI.toast({ title:'Bookmarked', body:t.title, icon:'starFilled' }); }
      OS.Storage.setBookmarks(userId, list);
      updateStar(t.url);
      renderBookbar();
    }
    function renderBookbar(){
      var list = bookmarks();
      els.bookbar.classList.toggle('empty', list.length===0);
      els.bookbar.innerHTML = list.map(function(b){
        return '<div class="br-bookchip" data-url="'+esc(b.url)+'"><span class="dot"></span>'+esc(b.title)+'</div>';
      }).join('');
      els.bookbar.querySelectorAll('.br-bookchip').forEach(function(node){
        node.addEventListener('click', function(){ go(activeTab(), node.getAttribute('data-url')); });
        node.addEventListener('contextmenu', function(e){
          e.preventDefault();
          OS.UI.showContextMenu(e.clientX, e.clientY, [
            { label:'Remove bookmark', icon:'trash', danger:true, action:function(){
              OS.Storage.setBookmarks(userId, bookmarks().filter(function(b){ return b.url !== node.getAttribute('data-url'); }));
              renderBookbar(); updateStar(activeTab().url);
            } }
          ]);
        });
      });
    }

    /* ---- history ---- */
    function recordHistory(url, title){
      var list = OS.Storage.getHistory(userId);
      list.unshift({ id:uid('h'), url:url, title:title, ts:Date.now() });
      OS.Storage.setHistory(userId, list.slice(0,400));
    }
    function renderHistoryPage(){
      var list = OS.Storage.getHistory(userId);
      var groups = [];
      var lastLabel = null;
      list.forEach(function(item){
        var label = OS.Util.dayLabel(item.ts);
        if(label !== lastLabel){ groups.push({ label:label, items:[] }); lastLabel = label; }
        groups[groups.length-1].items.push(item);
      });
      var html = '<div class="br-subpage"><h2>History</h2>'+
        '<div class="br-search-row"><input id="hist-filter" placeholder="Search history"/></div>'+
        '<div style="margin-bottom:14px;"><button class="btn btn-sm" id="hist-clear">Clear browsing history</button></div>'+
        '<div id="hist-groups">'+
        (groups.length ? groups.map(function(g){
          return '<div class="br-day-group"><div class="br-day-label">'+esc(g.label)+'</div>'+
            g.items.map(rowHtml).join('')+'</div>';
        }).join('') : '<div class="br-empty-state">'+svg('history')+'<div>No history yet</div></div>')+
        '</div></div>';
      els.pages.history.innerHTML = html;
      function rowHtml(item){
        return '<div class="br-hist-row" data-url="'+esc(item.url)+'" data-id="'+item.id+'">'+
          '<span class="favicon">'+esc(hostnameOf(item.url).charAt(0).toUpperCase())+'</span>'+
          '<div class="info"><div class="ttl">'+esc(item.title)+'</div><div class="url">'+esc(item.url)+'</div></div>'+
          '<span class="time">'+new Date(item.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</span>'+
          '<span class="del" data-del="'+item.id+'">'+svg('close')+'</span></div>';
      }
      els.pages.history.querySelectorAll('.br-hist-row').forEach(function(node){
        node.addEventListener('click', function(e){
          if(e.target.closest('[data-del]')) return;
          go(activeTab(), node.getAttribute('data-url'));
        });
      });
      els.pages.history.querySelectorAll('[data-del]').forEach(function(node){
        node.addEventListener('click', function(e){
          e.stopPropagation();
          var id = node.getAttribute('data-del');
          OS.Storage.setHistory(userId, OS.Storage.getHistory(userId).filter(function(h){ return h.id!==id; }));
          renderHistoryPage();
        });
      });
      var clearBtn = els.pages.history.querySelector('#hist-clear');
      clearBtn.addEventListener('click', function(){
        OS.UI.confirm({ title:'Clear browsing history?', message:'This removes all history on this device.', danger:true, okLabel:'Clear' }).then(function(ok){
          if(!ok) return; OS.Storage.setHistory(userId, []); renderHistoryPage();
        });
      });
      els.pages.history.querySelector('#hist-filter').addEventListener('input', OS.Util.debounce(function(e){
        var q = e.target.value.toLowerCase();
        els.pages.history.querySelectorAll('.br-hist-row').forEach(function(row){
          var match = row.textContent.toLowerCase().indexOf(q) !== -1;
          row.style.display = match ? '' : 'none';
        });
      }, 120));
    }

    /* ---- downloads ---- */
    function renderDownloadsPage(){
      var list = OS.Storage.getDownloads(userId);
      var html = '<div class="br-subpage"><h2>Downloads</h2>'+
        '<div class="set-card"><div class="lbl-title" style="margin-bottom:10px;">Save something to this device</div>'+
        '<div style="display:flex; gap:8px; flex-wrap:wrap;">'+
        '<button class="btn btn-sm" data-mk="bookmarks">Export bookmarks (.json)</button>'+
        '<button class="btn btn-sm" data-mk="history">Export history (.json)</button>'+
        '</div></div>'+
        (list.length ? list.map(function(d){
          return '<div class="br-dl-row"><span class="ic">'+svg('fileText')+'</span>'+
            '<div class="info"><div class="name">'+esc(d.name)+'</div><div class="meta">'+Math.max(1,Math.round(d.size/1024))+' KB · '+new Date(d.ts).toLocaleString()+'</div></div></div>';
        }).join('') : '<div class="br-empty-state">'+svg('download')+'<div>No downloads yet</div></div>')+
        (list.length ? '<button class="btn btn-sm" id="dl-clear" style="margin-top:6px;">Clear list</button>' : '')+
        '</div>';
      els.pages.downloads.innerHTML = html;
      var clear = els.pages.downloads.querySelector('#dl-clear');
      if(clear) clear.addEventListener('click', function(){ OS.Storage.setDownloads(userId, []); renderDownloadsPage(); });
      els.pages.downloads.querySelectorAll('[data-mk]').forEach(function(node){
        node.addEventListener('click', function(){
          var kind = node.getAttribute('data-mk');
          var name, content;
          if(kind === 'bookmarks'){ name='bookmarks.json'; content = JSON.stringify(bookmarks(), null, 2); }
          else { name='history.json'; content = JSON.stringify(OS.Storage.getHistory(userId), null, 2); }
          var size = OS.Util.downloadBlob(name, content, 'application/json');
          var list2 = OS.Storage.getDownloads(userId);
          list2.unshift({ id:uid('dl'), name:name, size:size, ts:Date.now() });
          OS.Storage.setDownloads(userId, list2);
          OS.UI.toast({ title:'Downloaded', body:name, icon:'download' });
          renderDownloadsPage();
        });
      });
    }

    /* ---- new tab page (no search box here — the address bar already searches) ---- */
    function renderHome(){
      var bms = bookmarks();
      els.pages.home.innerHTML = '<div class="br-hometab">'+
        OS.Icons.mark()+
        '<div class="greet">Where to?</div>'+
        '<div class="br-home-section-title">Shortcuts</div>'+
        '<div class="br-quick-grid">'+QUICK_LINKS.map(function(q){
          return '<div class="br-quick-tile" data-url="'+esc(q.url)+'"><span class="ic">'+esc(q.name.charAt(0))+'</span><span class="lbl">'+esc(q.name)+'</span></div>';
        }).join('')+'</div>'+
        (bms.length ? '<div class="br-home-section-title">Bookmarks</div><div class="br-quick-grid">'+bms.map(function(b){
          return '<div class="br-quick-tile" data-url="'+esc(b.url)+'"><span class="ic">'+esc(hostnameOf(b.url).charAt(0).toUpperCase())+'</span><span class="lbl">'+esc(b.title)+'</span></div>';
        }).join('')+'</div>' : '')+
        '<div class="br-credit">Meridian Browser · made by Koro</div>'+
      '</div>';
      els.pages.home.querySelectorAll('[data-url]').forEach(function(node){
        node.addEventListener('click', function(){ go(activeTab(), node.getAttribute('data-url')); });
      });
    }

    /* ---- settings page ---- */
    function renderSettingsPage(){
      els.pages.settings.innerHTML = '<div class="br-subpage"><h2>Browser settings</h2>'+
        '<div class="set-card">'+
          '<div class="set-row"><div><div class="lbl-title">Search engine</div><div class="lbl-sub">Used for anything typed that is not a web address</div></div>'+
          '<select id="bs-engine">'+Object.keys(SEARCH_ENGINES).map(function(k){ return '<option value="'+k+'"'+(bset.searchEngine===k?' selected':'')+'>'+SEARCH_ENGINES[k].label+'</option>'; }).join('')+'</select></div>'+
          '<div class="set-row"><div><div class="lbl-title">Homepage</div><div class="lbl-sub">Opened by the Home button and new tabs</div></div>'+
          '<input type="text" id="bs-home" value="'+esc(bset.homepage)+'" style="width:220px;"/></div>'+
          '<div class="set-row"><div><div class="lbl-title">Clear history when this window closes</div></div>'+
          '<div class="switch'+(bset.clearHistoryOnExit?' on':'')+'" id="bs-clearexit"></div></div>'+
        '</div>'+
        '<div class="set-card"><div class="lbl-title" style="margin-bottom:6px;">Appearance</div>'+
        '<div class="lbl-sub" style="margin-bottom:10px;">The browser follows your Meridian OS theme.</div>'+
        '<button class="btn btn-sm" id="bs-open-appearance">Open OS appearance settings</button></div>'+
        '<div class="br-credit">Meridian Browser · made by Koro</div>'+
        '</div>';
      els.pages.settings.querySelector('#bs-engine').addEventListener('change', function(e){
        bset.searchEngine = e.target.value; OS.Storage.setBrowserSettings(userId, bset);
      });
      els.pages.settings.querySelector('#bs-home').addEventListener('change', function(e){
        bset.homepage = e.target.value || HOME; OS.Storage.setBrowserSettings(userId, bset);
      });
      els.pages.settings.querySelector('#bs-clearexit').addEventListener('click', function(){
        bset.clearHistoryOnExit = !bset.clearHistoryOnExit;
        this.classList.toggle('on', bset.clearHistoryOnExit);
        OS.Storage.setBrowserSettings(userId, bset);
      });
      els.pages.settings.querySelector('#bs-open-appearance').addEventListener('click', function(){
        OS.WM.openWindow('settings', { section:'appearance' });
      });
    }

    /* ---- wiring ---- */
    ctx.bodyEl.querySelector('#br-newtab').addEventListener('click', function(){ newTab(bset.homepage); });
    ctx.bodyEl.querySelector('.br-navbar').addEventListener('click', function(e){
      var btn = e.target.closest('.navbtn'); if(!btn || btn.disabled) return;
      var t = activeTab(); var nav = btn.getAttribute('data-nav');
      if(nav === 'back' && t.idx>0){ t.idx--; t.url = t.stack[t.idx]; t.title=titleFor(t.url); renderTabs(); render(t); }
      else if(nav === 'fwd' && t.idx<t.stack.length-1){ t.idx++; t.url = t.stack[t.idx]; t.title=titleFor(t.url); renderTabs(); render(t); }
      else if(nav === 'reload'){ reloadTab(t); }
      else if(nav === 'home') go(t, bset.homepage);
      else if(nav === 'openexternal'){ if(!/^meridian:\/\//.test(t.url)) window.open(t.url, '_blank', 'noopener'); }
    });
    function suggestionCandidates(query){
      var q = query.trim().toLowerCase();
      if(!q) return [];
      var seen = {}, out = [];
      bookmarks().forEach(function(b){
        if(out.length>=5) return;
        if(!seen[b.url] && (b.url.toLowerCase().indexOf(q)!==-1 || b.title.toLowerCase().indexOf(q)!==-1)){
          seen[b.url]=1; out.push({ url:b.url, title:b.title, icon:'starFilled' });
        }
      });
      if(out.length<5){
        OS.Storage.getHistory(userId).some(function(h){
          if(out.length>=5) return true;
          if(!seen[h.url] && (h.url.toLowerCase().indexOf(q)!==-1 || h.title.toLowerCase().indexOf(q)!==-1)){
            seen[h.url]=1; out.push({ url:h.url, title:h.title, icon:'history' });
          }
          return false;
        });
      }
      return out;
    }
    function renderSuggestions(query){
      suggestSel = -1;
      var cands = suggestionCandidates(query);
      var rows = cands.map(function(c){
        return '<div class="br-suggest-row" data-url="'+esc(c.url)+'"><span class="ic">'+svg(c.icon)+'</span><span class="txt">'+esc(c.title)+'</span></div>';
      });
      if(query.trim()){
        var eng = SEARCH_ENGINES[bset.searchEngine] || SEARCH_ENGINES.bing;
        rows.push('<div class="br-suggest-row" data-url="__search__"><span class="ic">'+svg('search')+'</span><span class="txt">Search '+esc(eng.label)+' for &ldquo;'+esc(query.trim())+'&rdquo;</span></div>');
      }
      els.suggest.innerHTML = rows.join('');
      els.suggest.classList.toggle('visible', rows.length>0);
      els.suggest.querySelectorAll('.br-suggest-row').forEach(function(node){
        node.addEventListener('mousedown', function(ev){
          ev.preventDefault();
          var u = node.getAttribute('data-url');
          go(activeTab(), u==='__search__' ? els.addr.value : u);
          hideSuggestions(); els.addr.blur();
        });
      });
    }
    function hideSuggestions(){ els.suggest.classList.remove('visible'); els.suggest.innerHTML=''; suggestSel=-1; }
    function highlightSuggest(rows){ rows.forEach(function(r,i){ r.classList.toggle('sel', i===suggestSel); }); }

    els.addr.addEventListener('input', OS.Util.debounce(function(){ renderSuggestions(els.addr.value); }, 100));
    els.addr.addEventListener('focus', function(){ if(els.addr.value) renderSuggestions(els.addr.value); });
    els.addr.addEventListener('blur', function(){ setTimeout(hideSuggestions, 120); });
    els.addr.addEventListener('keydown', function(e){
      var rows = els.suggest.querySelectorAll('.br-suggest-row');
      if(e.key === 'ArrowDown' && rows.length){ e.preventDefault(); suggestSel = Math.min(rows.length-1, suggestSel+1); highlightSuggest(rows); }
      else if(e.key === 'ArrowUp' && rows.length){ e.preventDefault(); suggestSel = Math.max(0, suggestSel-1); highlightSuggest(rows); }
      else if(e.key === 'Enter'){
        if(suggestSel>=0 && rows[suggestSel]) rows[suggestSel].dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true }));
        else { go(activeTab(), els.addr.value); hideSuggestions(); }
      }
      else if(e.key === 'Escape'){ hideSuggestions(); els.addr.blur(); }
    });
    els.star.addEventListener('click', toggleBookmark);

    ctx.bodyEl.addEventListener('keydown', function(e){
      var meta = e.ctrlKey || e.metaKey;
      if(!meta) return;
      var k = e.key.toLowerCase();
      if(k==='t' && !e.shiftKey){ e.preventDefault(); newTab(bset.homepage); }
      else if(k==='t' && e.shiftKey){ e.preventDefault(); reopenClosedTab(); }
      else if(k==='w'){ e.preventDefault(); closeTab(activeId); }
      else if(k==='l'){ e.preventDefault(); els.addr.focus(); els.addr.select(); }
      else if(k==='r'){ e.preventDefault(); reloadTab(activeTab()); }
      else if(k==='=' || k==='+'){ e.preventDefault(); setZoom(activeTab(), 0.1); }
      else if(k==='-'){ e.preventDefault(); setZoom(activeTab(), -0.1); }
      else if(k==='0'){ e.preventDefault(); var t=activeTab(); if(t){ t.zoom=1; applyZoom(t); } }
      else if(e.key==='Tab'){ e.preventDefault(); cycleTab(e.shiftKey ? -1 : 1); }
    });
    ctx.bodyEl.querySelector('#br-menu').addEventListener('click', function(e){
      var t = activeTab();
      OS.UI.showContextMenu(e.clientX, e.clientY, [
        { label:'History', icon:'history', action:function(){ go(activeTab(), 'meridian://history'); } },
        { label:'Downloads', icon:'download', action:function(){ go(activeTab(), 'meridian://downloads'); } },
        { label:'Bookmarks', icon:'bookmark', action:function(){ go(activeTab(), HOME); } },
        { divider:true },
        { label:'New private tab', icon:'eye', action:function(){ newTab(bset.homepage, { private:true }); } },
        { label:'Reopen closed tab', icon:'history', disabled: !closedStack.length, action:reopenClosedTab },
        { divider:true },
        { label:'Zoom: '+Math.round(((t&&t.zoom)||1)*100)+'%', icon:'search', disabled:true },
        { label:'Zoom in', icon:'plus', action:function(){ setZoom(activeTab(), 0.1); } },
        { label:'Zoom out', icon:'minus', action:function(){ setZoom(activeTab(), -0.1); } },
        { divider:true },
        { label:'Browser settings', icon:'gear', action:function(){ go(activeTab(), 'meridian://settings'); } }
      ]);
    });

    renderBookbar();
    newTab(ctx.data && ctx.data.url ? ctx.data.url : bset.homepage);

    return {
      onReopen: function(data){ if(data && data.url) newTab(data.url); },
      onClose: function(){
        if(bset.clearHistoryOnExit) OS.Storage.setHistory(userId, []);
      }
    };
  }

  OS.Apps.register({
    id:'browser', name:'Browser', title:'Browser', icon:'globe',
    defaultWidth:920, defaultHeight:620, minWidth:480, minHeight:340,
    build: buildBrowser
  });

})(window);
