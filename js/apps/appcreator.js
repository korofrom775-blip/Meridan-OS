/* =================================================================
   MERIDIAN OS — App Creator
   Lets the user define a lightweight "app": a name + a link. Each one
   becomes a launchable, dynamically-registered app whose only job is
   to open the Browser app at that address. Definitions are stored
   per-user and re-registered on every login (see registerSaved()).
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml;

  var CUSTOM_PREFIX = 'custom_';

  function normalizeUrl(raw){
    var s = (raw||'').trim();
    if(!s) return '';
    if(/^https?:\/\//i.test(s)) return s;
    if(/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s)) return 'https://' + s;
    return s;
  }

  /* Register one saved definition as a real app in the registry. */
  function registerOne(def){
    OS.Apps.register({
      id: CUSTOM_PREFIX + def.id,
      name: def.name, title: def.name, icon: 'globe',
      custom: true, customDef: def,
      build: function(ctx){
        ctx.close();
        OS.WM.openWindow('browser', { url: def.url });
      }
    });
  }

  /* Called once per login (see main.js) so custom apps are launchable
     from the desktop / start menu / search before the user opens
     App Creator itself. */
  function registerSaved(userId){
    OS.Storage.getCustomApps(userId).forEach(registerOne);
  }

  function buildAppCreator(ctx){
    var session = OS.Auth.currentUser();
    var userId = session.id;

    function render(){
      var apps = OS.Storage.getCustomApps(userId);
      var list = apps.map(function(a){
        return '<div class="sm-list-item" data-id="'+esc(a.id)+'">'+
          '<span class="glyph">'+svg('globe')+'</span>'+
          '<span class="lbl">'+esc(a.name)+'<br><small style="opacity:.6;">'+esc(a.url)+'</small></span>'+
          '<button class="ac-remove" data-id="'+esc(a.id)+'" title="Remove">'+svg('trash')+'</button>'+
        '</div>';
      }).join('') || '<div class="sm-empty">No apps created yet.</div>';

      ctx.bodyEl.innerHTML =
        '<div class="app-toolbar" style="flex-direction:column;align-items:stretch;gap:8px;padding:12px;">'+
          '<input type="text" id="ac-name" placeholder="App name (e.g. Reddit)" class="ac-input">'+
          '<input type="text" id="ac-url" placeholder="Link (e.g. https://reddit.com)" class="ac-input">'+
          '<button id="ac-create" class="btn">'+svg('plus')+' Create app</button>'+
        '</div>'+
        '<div class="ac-list" style="overflow-y:auto;flex:1;padding:0 12px 12px;">'+list+'</div>';

      ctx.bodyEl.querySelector('#ac-create').addEventListener('click', doCreate);
      ctx.bodyEl.querySelectorAll('.ac-remove').forEach(function(btn){
        btn.addEventListener('click', function(e){
          e.stopPropagation();
          doRemove(btn.getAttribute('data-id'));
        });
      });
    }

    function doCreate(){
      var nameEl = ctx.bodyEl.querySelector('#ac-name');
      var urlEl = ctx.bodyEl.querySelector('#ac-url');
      var name = (nameEl.value||'').trim();
      var url = normalizeUrl(urlEl.value);

      if(!name){ OS.UI.toast({ title:'Name required', body:'Give the app a name.' }); return; }
      if(!url){ OS.UI.toast({ title:'Link required', body:'Give the app a link to open.' }); return; }
      if(!/^https?:\/\//i.test(url)){ OS.UI.toast({ title:'Invalid link', body:'Links must start with http:// or https://' }); return; }

      var apps = OS.Storage.getCustomApps(userId);
      var def = { id: OS.Storage.uid('app'), name: name, url: url };
      apps.push(def);
      OS.Storage.setCustomApps(userId, apps);
      registerOne(def);
      OS.Desktop.addIcon(CUSTOM_PREFIX + def.id);

      nameEl.value = ''; urlEl.value = '';
      OS.UI.toast({ title:'App created', body:name+' added to your desktop', icon:'check' });
      render();
    }

    function doRemove(id){
      var apps = OS.Storage.getCustomApps(userId).filter(function(a){ return a.id !== id; });
      OS.Storage.setCustomApps(userId, apps);
      OS.Desktop.removeIcon(CUSTOM_PREFIX + id);
      render();
    }

    render();
  }

  OS.Apps.register({
    id:'appcreator', name:'App Creator', title:'App Creator', icon:'plus',
    defaultWidth:420, defaultHeight:520, minWidth:320, minHeight:360,
    build: buildAppCreator
  });

  OS.CustomApps = { registerSaved: registerSaved, normalizeUrl: normalizeUrl };

})(window);
