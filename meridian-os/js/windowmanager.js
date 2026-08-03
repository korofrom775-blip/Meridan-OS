/* =================================================================
   MERIDIAN OS — Window manager
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml, clamp = OS.Util.clamp;

  var layer, ghost;
  var windows = {};          /* id -> state */
  var openOrder = [];        /* window ids in the order they were opened */
  var zCounter = 10;
  var cascadeStep = { x:0, y:0 };

  function init(){
    layer = document.getElementById('window-layer');
    ghost = document.getElementById('snap-ghost');
    window.addEventListener('resize', reflowOnViewportResize);
  }

  function reflowOnViewportResize(){
    var b = desktopBounds();
    Object.keys(windows).forEach(function(id){
      var w = windows[id];
      if(w.maximized) return; /* CSS keeps maximized windows filling the desktop */
      var newW = Math.min(w.el.offsetWidth, Math.max(120, b.width-16));
      var newH = Math.min(w.el.offsetHeight, Math.max(120, b.height-16));
      var newX = clamp(w.el.offsetLeft, 0, Math.max(0, b.width-newW));
      var newY = clamp(w.el.offsetTop, 0, Math.max(0, b.height-newH));
      w.el.style.width = newW+'px'; w.el.style.height = newH+'px';
      w.el.style.left = newX+'px'; w.el.style.top = newY+'px';
    });
  }

  function emit(name, detail){ document.dispatchEvent(new CustomEvent('meridian:'+name, { detail: detail||{} })); }

  function desktopBounds(){
    var d = document.getElementById('desktop');
    var r = d.getBoundingClientRect();
    return { left:0, top:0, width:r.width, height:r.height };
  }

  function getOpenWindows(){
    return openOrder.filter(function(id){ return windows[id]; }).map(function(id){
      var w = windows[id];
      return { id:id, appId:w.appId, title:w.title, minimized:w.minimized, focused:w.id===focusedId, icon:w.icon };
    });
  }

  var focusedId = null;

  function findExistingSingleInstance(appId){
    for(var i=0;i<openOrder.length;i++){
      var w = windows[openOrder[i]];
      if(w && w.appId === appId) return w;
    }
    return null;
  }

  function openWindow(appId, data){
    var appDef = OS.Apps.get(appId);
    if(!appDef){ console.warn('Unknown app', appId); return null; }
    if(appDef.singleInstance){
      var existing = findExistingSingleInstance(appId);
      if(existing){
        restoreWindow(existing.id);
        focusWindow(existing.id);
        if(data && existing.onReopen) existing.onReopen(data);
        return existing.id;
      }
    }
    var id = OS.Storage.uid('win');
    var bounds = desktopBounds();
    var w = (appDef.defaultWidth || 640), h = (appDef.defaultHeight || 440);
    w = Math.min(w, bounds.width - 24);
    h = Math.min(h, bounds.height - 24);

    var startMax = bounds.width < 720;
    var x = clamp(Math.round((bounds.width - w)/2 + cascadeStep.x), 8, Math.max(8, bounds.width - w - 8));
    var y = clamp(Math.round((bounds.height - h)/2 + cascadeStep.y), 8, Math.max(8, bounds.height - h - 8));
    cascadeStep.x = (cascadeStep.x + 28) % 140;
    cascadeStep.y = (cascadeStep.y + 22) % 110;

    var el = document.createElement('div');
    el.className = 'win';
    el.style.width = w+'px'; el.style.height = h+'px';
    el.style.left = x+'px'; el.style.top = y+'px';
    el.innerHTML =
      '<div class="winbar">'+
        '<span class="glyph">'+svg(appDef.icon||'square')+'</span>'+
        '<span class="title">'+esc(appDef.title||appDef.name)+'</span>'+
        '<div class="wincontrols">'+
          '<button class="winmin" title="Minimize">'+svg('minus')+'</button>'+
          '<button class="winmax" title="Maximize">'+svg('square')+'</button>'+
          '<button class="close" title="Close">'+svg('close')+'</button>'+
        '</div>'+
      '</div>'+
      '<div class="winbody"><div class="winloading"><span class="spinner"></span>Loading…</div></div>'+
      '<div class="resize-handle rh-n"></div><div class="resize-handle rh-s"></div>'+
      '<div class="resize-handle rh-e"></div><div class="resize-handle rh-w"></div>'+
      '<div class="resize-handle rh-ne"></div><div class="resize-handle rh-nw"></div>'+
      '<div class="resize-handle rh-se"></div><div class="resize-handle rh-sw"></div>';
    layer.appendChild(el);

    var state = {
      id:id, appId:appId, el:el, title: appDef.title||appDef.name, icon:appDef.icon,
      x:x, y:y, w:w, h:h, maximized:false, minimized:false, prevRect:null,
      minW: appDef.minWidth||300, minH: appDef.minHeight||200, onReopen:null
    };
    windows[id] = state;
    openOrder.push(id);

    var body = el.querySelector('.winbody');
    var ctx = {
      bodyEl: body, windowId: id, data: data||{}, winEl: el,
      setTitle: function(t){ state.title = t; el.querySelector('.winbar .title').textContent = t; emit('window-changed',{}); },
      close: function(){ closeWindow(id); }
    };

    wireChrome(el, id);
    focusWindow(id);
    emit('window-opened', { id:id, appId:appId });

    setTimeout(function(){
      try{
        var handle = appDef.build(ctx);
        body.querySelector('.winloading') && body.querySelector('.winloading').remove();
        if(handle){
          if(handle.onReopen) state.onReopen = handle.onReopen;
          state.handle = handle;
        }
      }catch(err){
        body.innerHTML = '<div class="winloading" style="position:static;flex:1;color:var(--signal-red);">Something went wrong loading this app.</div>';
        console.error(err);
      }
    }, 60);

    if(startMax) maximizeWindow(id);
    return id;
  }

  function wireChrome(el, id){
    var bar = el.querySelector('.winbar');
    bar.addEventListener('mousedown', function(e){ if(!e.target.closest('button')) focusWindow(id); });
    bar.addEventListener('dblclick', function(e){ if(!e.target.closest('button')) toggleMaximize(id); });
    el.addEventListener('mousedown', function(){ focusWindow(id); }, true);
    el.querySelector('.winmin').addEventListener('click', function(){ minimizeWindow(id); });
    el.querySelector('.winmax').addEventListener('click', function(){ toggleMaximize(id); });
    el.querySelector('.close').addEventListener('click', function(){ closeWindow(id); });
    makeDraggable(el, bar, id);
    el.querySelectorAll('.resize-handle').forEach(function(h){ makeResizable(el, h, id); });
  }

  function focusWindow(id){
    var w = windows[id]; if(!w) return;
    if(w.minimized) restoreWindow(id);
    focusedId = id;
    zCounter += 1;
    w.el.style.zIndex = zCounter;
    Object.keys(windows).forEach(function(k){ windows[k].el.classList.toggle('focused', k===id); });
    emit('window-focused', { id:id });
  }

  function closeWindow(id){
    var w = windows[id]; if(!w) return;
    if(w.handle && typeof w.handle.onClose === 'function'){ try{ w.handle.onClose(); }catch(e){ console.error(e); } }
    w.el.classList.add('closing');
    setTimeout(function(){
      w.el.remove();
      delete windows[id];
      openOrder = openOrder.filter(function(x){ return x!==id; });
      if(focusedId === id){
        focusedId = openOrder.length ? openOrder[openOrder.length-1] : null;
        if(focusedId) focusWindow(focusedId);
      }
      emit('window-closed', { id:id });
    }, 150);
  }

  function minimizeWindow(id){
    var w = windows[id]; if(!w) return;
    w.minimized = true;
    w.el.classList.add('minimized');
    if(focusedId === id){
      var rest = openOrder.filter(function(x){ return x!==id && windows[x] && !windows[x].minimized; });
      focusedId = rest.length ? rest[rest.length-1] : null;
      if(focusedId) focusWindow(focusedId);
    }
    emit('window-minimized', { id:id });
  }

  function restoreWindow(id){
    var w = windows[id]; if(!w) return;
    w.minimized = false;
    w.el.classList.remove('minimized');
    emit('window-restored', { id:id });
  }

  function toggleMaximize(id){
    var w = windows[id]; if(!w) return;
    if(w.maximized) restoreFromMaximize(id); else maximizeWindow(id);
  }

  function maximizeWindow(id){
    var w = windows[id]; if(!w || w.maximized) return;
    w.prevRect = { x:w.el.offsetLeft, y:w.el.offsetTop, w:w.el.offsetWidth, h:w.el.offsetHeight };
    w.maximized = true;
    w.el.classList.add('maximized');
    w.el.querySelector('.winmax').innerHTML = svg('restore');
    focusWindow(id);
  }

  function restoreFromMaximize(id){
    var w = windows[id]; if(!w || !w.maximized) return;
    var r = w.prevRect || { x:60,y:60,w:640,h:440 };
    w.el.style.left = r.x+'px'; w.el.style.top = r.y+'px';
    w.el.style.width = r.w+'px'; w.el.style.height = r.h+'px';
    w.maximized = false;
    w.el.classList.remove('maximized');
    w.el.querySelector('.winmax').innerHTML = svg('square');
  }

  /* ---------------- dragging + edge snapping ---------------- */
  function makeDraggable(el, handle, id){
    var startX, startY, originX, originY, dragging=false;
    handle.addEventListener('pointerdown', function(e){
      if(e.target.closest('button')) return;
      var w = windows[id]; if(!w) return;
      if(w.maximized){
        /* unmaximize, keep cursor over same relative position */
        restoreFromMaximize(id);
      }
      dragging = true;
      el.classList.add('dragging');
      startX = e.clientX; startY = e.clientY;
      originX = el.offsetLeft; originY = el.offsetTop;
      handle.setPointerCapture(e.pointerId);
      focusWindow(id);
    });
    handle.addEventListener('pointermove', function(e){
      if(!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      var b = desktopBounds();
      var nx = clamp(originX + dx, -el.offsetWidth+80, b.width-80);
      var ny = clamp(originY + dy, 0, b.height-32);
      el.style.left = nx+'px'; el.style.top = ny+'px';
      handleSnapPreview(e.clientY, e.clientX, b);
    });
    handle.addEventListener('pointerup', function(e){
      if(!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      finishSnap(id, e.clientX, e.clientY);
      hideGhost();
    });
  }

  var snapZone = null;
  function handleSnapPreview(clientY, clientX, b){
    var zone = null;
    if(clientY <= 4) zone = 'top';
    else if(clientX <= 4) zone = 'left';
    else if(clientX >= b.width-4) zone = 'right';
    snapZone = zone;
    if(!zone){ hideGhost(); return; }
    var rect;
    if(zone==='top') rect = { left:0, top:0, width:b.width, height:b.height };
    else if(zone==='left') rect = { left:0, top:0, width:b.width/2, height:b.height };
    else rect = { left:b.width/2, top:0, width:b.width/2, height:b.height };
    ghost.style.left = rect.left+'px'; ghost.style.top = rect.top+'px';
    ghost.style.width = rect.width+'px'; ghost.style.height = rect.height+'px';
    ghost.classList.add('visible');
  }
  function hideGhost(){ if(ghost) ghost.classList.remove('visible'); snapZone = null; }
  function finishSnap(id, clientX, clientY){
    if(!snapZone) return;
    var w = windows[id]; if(!w) return;
    var b = desktopBounds();
    if(snapZone === 'top'){ maximizeWindow(id); return; }
    if(w.maximized) w.maximized = false, w.el.classList.remove('maximized'), w.el.querySelector('.winmax').innerHTML = svg('square');
    if(snapZone === 'left'){ w.el.style.left='0px'; w.el.style.top='0px'; w.el.style.width=(b.width/2)+'px'; w.el.style.height=b.height+'px'; }
    else if(snapZone === 'right'){ w.el.style.left=(b.width/2)+'px'; w.el.style.top='0px'; w.el.style.width=(b.width/2)+'px'; w.el.style.height=b.height+'px'; }
  }

  /* ---------------- resizing ---------------- */
  function makeResizable(el, handle, id){
    var dir = handle.className.match(/rh-(\w+)/)[1];
    var startX, startY, ox, oy, ow, oh, active=false;
    handle.addEventListener('pointerdown', function(e){
      var w = windows[id]; if(!w || w.maximized) return;
      active = true;
      el.classList.add('resizing');
      startX = e.clientX; startY = e.clientY;
      ox = el.offsetLeft; oy = el.offsetTop; ow = el.offsetWidth; oh = el.offsetHeight;
      handle.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    handle.addEventListener('pointermove', function(e){
      if(!active) return;
      var w = windows[id]; if(!w) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      var b = desktopBounds();
      var nx=ox, ny=oy, nw=ow, nh=oh;
      if(dir.indexOf('e')>=0) nw = clamp(ow+dx, w.minW, b.width-ox);
      if(dir.indexOf('s')>=0) nh = clamp(oh+dy, w.minH, b.height-oy);
      if(dir.indexOf('w')>=0){ nw = clamp(ow-dx, w.minW, ox+ow); nx = ox+ow-nw; }
      if(dir.indexOf('n')>=0){ nh = clamp(oh-dy, w.minH, oy+oh); ny = oy+oh-nh; }
      el.style.left=nx+'px'; el.style.top=ny+'px'; el.style.width=nw+'px'; el.style.height=nh+'px';
    });
    handle.addEventListener('pointerup', function(e){
      if(!active) return;
      active = false;
      el.classList.remove('resizing');
    });
  }

  function closeAll(){ openOrder.slice().forEach(closeWindow); }
  function minimizeAll(){ openOrder.forEach(function(id){ if(windows[id] && !windows[id].minimized) minimizeWindow(id); }); }
  function getWindow(id){ return windows[id]; }

  OS.WM = {
    init: init,
    openWindow: openWindow,
    closeWindow: closeWindow,
    minimizeWindow: minimizeWindow,
    restoreWindow: restoreWindow,
    toggleMaximize: toggleMaximize,
    focusWindow: focusWindow,
    getOpenWindows: getOpenWindows,
    getWindow: getWindow,
    closeAll: closeAll,
    minimizeAll: minimizeAll,
    desktopBounds: desktopBounds
  };

})(window);
