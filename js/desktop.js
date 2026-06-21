/* =================================================================
   MERIDIAN OS — Desktop (icons, wallpaper hookup, context menu)
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml, clamp = OS.Util.clamp;

  var iconsEl, desktopEl, userId, layout, selectedId = null;

  function render(uid){
    userId = uid;
    iconsEl = document.getElementById('desktop-icons');
    desktopEl = document.getElementById('desktop');
    layout = OS.Storage.getUserDesktop(userId);
    draw();
    wireDesktop();
  }

  function persist(){ OS.Storage.setUserDesktop(userId, layout); }

  function draw(){
    iconsEl.innerHTML = '';
    layout.icons.forEach(function(icon){
      var appDef = OS.Apps.get(icon.id);
      if(!appDef) return;
      var el = document.createElement('div');
      el.className = 'dicon';
      el.style.left = icon.x+'px'; el.style.top = icon.y+'px';
      el.setAttribute('data-id', icon.id);
      el.innerHTML = '<div class="dicon-glyph">'+svg(appDef.icon||'square')+'</div><div class="dicon-label">'+esc(appDef.name)+'</div>';
      iconsEl.appendChild(el);
      wireIcon(el, icon);
    });
  }

  function wireIcon(el, icon){
    el.addEventListener('click', function(e){
      e.stopPropagation();
      select(icon.id);
    });
    el.addEventListener('dblclick', function(e){
      e.stopPropagation();
      OS.WM.openWindow(icon.id);
    });
    el.addEventListener('contextmenu', function(e){
      e.preventDefault(); e.stopPropagation();
      select(icon.id);
      OS.UI.showContextMenu(e.clientX, e.clientY, [
        { label:'Open', icon:'chevronRight', action:function(){ OS.WM.openWindow(icon.id); } },
        { label:'Remove from desktop', icon:'trash', danger:true, action:function(){
          layout.icons = layout.icons.filter(function(i){ return i.id !== icon.id; });
          persist(); draw();
        } }
      ]);
    });

    var dragging=false, startX,startY,ox,oy, moved=false;
    el.addEventListener('pointerdown', function(e){
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      ox = el.offsetLeft; oy = el.offsetTop;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', function(e){
      if(!dragging) return;
      var dx = e.clientX-startX, dy = e.clientY-startY;
      if(Math.abs(dx)>3 || Math.abs(dy)>3) moved = true;
      if(!moved) return;
      var b = desktopEl.getBoundingClientRect();
      var nx = clamp(ox+dx, 0, b.width-90);
      var ny = clamp(oy+dy, 0, b.height-100);
      el.style.left = nx+'px'; el.style.top = ny+'px';
    });
    el.addEventListener('pointerup', function(e){
      if(!dragging) return;
      dragging = false;
      if(moved){
        icon.x = el.offsetLeft; icon.y = el.offsetTop;
        persist();
      }
    });
  }

  function select(id){
    selectedId = id;
    iconsEl.querySelectorAll('.dicon').forEach(function(n){ n.classList.toggle('selected', n.getAttribute('data-id')===id); });
  }
  function deselect(){ selectedId=null; iconsEl.querySelectorAll('.dicon').forEach(function(n){ n.classList.remove('selected'); }); }

  function freeSpot(){
    var used = layout.icons.map(function(i){ return i.y; });
    var y = 24;
    while(used.indexOf(y) !== -1) y += 106;
    return { x:24, y:y };
  }

  function wireDesktop(){
    desktopEl.addEventListener('click', function(e){ if(e.target===desktopEl||e.target===iconsEl) deselect(); });
    desktopEl.addEventListener('contextmenu', function(e){
      if(e.target !== desktopEl && e.target !== iconsEl) return;
      e.preventDefault();
      var missing = OS.Apps.launchable().filter(function(a){ return !layout.icons.some(function(i){ return i.id===a.id; }); });
      var items = [
        { label:'Refresh', icon:'refresh', action:function(){ draw(); } },
        { label:'Sort icons', icon:'grid', action:function(){
          layout.icons.forEach(function(icon, idx){ icon.x = 24; icon.y = 24 + idx*106; });
          persist(); draw();
        } },
        { divider:true }
      ];
      if(missing.length){
        missing.forEach(function(a){
          items.push({ label:'Add "'+a.name+'" icon', icon:a.icon, action:function(){
            var spot = freeSpot();
            layout.icons.push({ id:a.id, x:spot.x, y:spot.y });
            persist(); draw();
          } });
        });
        items.push({ divider:true });
      }
      items.push({ label:'Personalize', icon:'palette', action:function(){ OS.WM.openWindow('settings', { section:'appearance' }); } });
      OS.UI.showContextMenu(e.clientX, e.clientY, items);
    });
  }

  function pinnedAppIds(){ return layout ? layout.pinned.slice() : []; }
  function togglePin(appId){
    if(!layout) return;
    var idx = layout.pinned.indexOf(appId);
    if(idx===-1) layout.pinned.push(appId); else layout.pinned.splice(idx,1);
    persist();
  }
  function isPinned(appId){ return layout && layout.pinned.indexOf(appId) !== -1; }

  OS.Desktop = { render:render, pinnedAppIds:pinnedAppIds, togglePin:togglePin, isPinned:isPinned };

})(window);
