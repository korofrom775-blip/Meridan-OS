/* =================================================================
   MERIDIAN OS — Settings app + shared theme application
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml;

  /* -----------------------------------------------------------------
     OS.Theme — applies persisted settings to the live document.
     Used at boot and whenever settings change.
     ----------------------------------------------------------------- */
  var ACCENTS = {
    copper:{ accent:'#ff8a5b', strong:'#ffa379', rgb:'255,138,91' },
    teal:  { accent:'#4fd2c4', strong:'#7fe0d5', rgb:'79,210,196' },
    violet:{ accent:'#9b8cff', strong:'#b3a6ff', rgb:'155,140,255' },
    rose:  { accent:'#ff8cc6', strong:'#ffa8d3', rgb:'255,140,198' },
    gold:  { accent:'#ffc857', strong:'#ffd685', rgb:'255,200,87' },
    slate: { accent:'#9fb4ff', strong:'#b7c7ff', rgb:'159,180,255' }
  };
  var WALLPAPERS = {
    dusk:    'radial-gradient(circle at 25% 15%, rgba(255,138,91,0.35), transparent 50%), radial-gradient(circle at 80% 80%, rgba(79,210,196,0.22), transparent 55%), linear-gradient(160deg, #11131c 0%, #0b0c12 75%)',
    midnight:'radial-gradient(circle at 80% 10%, rgba(155,140,255,0.18), transparent 50%), linear-gradient(160deg,#0b0c14 0%,#171b2b 60%,#0b0c14 100%)',
    meadow:  'radial-gradient(circle at 70% 20%,rgba(91,217,138,0.25),transparent 55%), linear-gradient(160deg,#0c1410 0%,#0a0c10 75%)',
    ember:   'radial-gradient(circle at 30% 75%, rgba(255,107,107,0.25), transparent 55%), linear-gradient(150deg,#1a0f0c,#0b0c12 75%)',
    paper:   'linear-gradient(160deg,#1c1d22 0%,#101116 70%)'
  };

  function applyTheme(settings){
    var root = document.documentElement;
    root.setAttribute('data-mode', settings.mode || 'dark');
    var acc = ACCENTS[settings.accent] || ACCENTS.copper;
    root.style.setProperty('--accent', acc.accent);
    root.style.setProperty('--accent-strong', acc.strong);
    root.style.setProperty('--accent-soft', 'rgba('+acc.rgb+',0.16)');
    root.style.setProperty('--accent-rgb', acc.rgb);

    var app = document.getElementById('app');
    if(app){
      app.setAttribute('data-taskbar', settings.taskbarPosition || 'bottom');
      app.setAttribute('data-iconsize', settings.iconSize || 'medium');
      app.classList.toggle('no-anim', settings.animations === false);
    }
    var desktop = document.getElementById('desktop');
    if(desktop){
      if(settings.wallpaper === 'custom' && settings.wallpaperCustom){
        desktop.style.backgroundImage = 'url("'+settings.wallpaperCustom.replace(/"/g,'')+'")';
      } else {
        desktop.style.backgroundImage = WALLPAPERS[settings.wallpaper] || WALLPAPERS.dusk;
      }
    }
  }

  OS.Theme = { apply: applyTheme, ACCENTS: ACCENTS, WALLPAPERS: WALLPAPERS };

  /* -----------------------------------------------------------------
     Settings app
     ----------------------------------------------------------------- */
  var SECTIONS = [
    { id:'appearance', label:'Appearance', icon:'palette' },
    { id:'wallpaper', label:'Wallpaper', icon:'image' },
    { id:'taskbar', label:'Taskbar', icon:'layout' },
    { id:'desktop', label:'Desktop', icon:'desktop' },
    { id:'notifications', label:'Notifications', icon:'bell' },
    { id:'accounts', label:'Accounts', icon:'user' },
    { id:'about', label:'About', icon:'info' }
  ];

  function buildSettings(ctx){
    var session = OS.Auth.currentUser();
    var userId = session.id;
    var settings = OS.Storage.getUserSettings(userId);
    var active = (ctx.data && ctx.data.section) || 'appearance';

    ctx.bodyEl.innerHTML =
      '<div class="set-shell">'+
        '<div class="set-nav" id="set-nav"></div>'+
        '<div class="set-main" id="set-main"></div>'+
      '</div>';

    var nav = ctx.bodyEl.querySelector('#set-nav');
    var main = ctx.bodyEl.querySelector('#set-main');

    function persist(){ var ok = OS.Storage.setUserSettings(userId, settings); OS.Theme.apply(settings); document.dispatchEvent(new CustomEvent('meridian:settings-changed')); return ok; }

    function renderNav(){
      nav.innerHTML = SECTIONS.map(function(s){
        return '<div class="set-nav-item'+(s.id===active?' active':'')+'" data-s="'+s.id+'">'+svg(s.icon,'icon')+'<span>'+s.label+'</span></div>';
      }).join('');
      nav.querySelectorAll('.set-nav-item').forEach(function(node){
        node.addEventListener('click', function(){ active = node.getAttribute('data-s'); renderNav(); renderMain(); });
      });
    }

    function renderMain(){
      if(active === 'appearance') return renderAppearance();
      if(active === 'wallpaper') return renderWallpaper();
      if(active === 'taskbar') return renderTaskbar();
      if(active === 'desktop') return renderDesktop();
      if(active === 'notifications') return renderNotifications();
      if(active === 'accounts') return renderAccounts();
      if(active === 'about') return renderAbout();
    }

    function row(title, sub, controlHtml){
      return '<div class="set-row"><div class="lbl-wrap"><div class="lbl-title">'+esc(title)+'</div>'+(sub?'<div class="lbl-sub">'+esc(sub)+'</div>':'')+'</div>'+controlHtml+'</div>';
    }
    function switchHtml(id, on){ return '<div class="switch'+(on?' on':'')+'" data-switch="'+id+'"></div>'; }

    function renderAppearance(){
      main.innerHTML = '<h2>Appearance</h2>'+
        '<div class="set-card"><div class="lbl-title" style="margin-bottom:10px;">Accent color</div>'+
        '<div class="swatch-row">'+Object.keys(OS.Theme.ACCENTS).map(function(k){
          return '<div class="swatch'+(settings.accent===k?' selected':'')+'" data-accent="'+k+'" style="background:'+OS.Theme.ACCENTS[k].accent+';"></div>';
        }).join('')+'</div></div>'+
        '<div class="set-card">'+
          row('Dark mode','Switch between dark and light surfaces', switchHtml('mode', settings.mode!=='light'))+
          row('Window & menu animations','Turn off for a snappier, simpler feel', switchHtml('animations', settings.animations!==false))+
          row('Interface sounds','Subtle sounds for notifications and actions', switchHtml('sound', settings.sound!==false))+
        '</div>';
      main.querySelectorAll('[data-accent]').forEach(function(node){
        node.addEventListener('click', function(){ settings.accent = node.getAttribute('data-accent'); persist(); renderAppearance(); });
      });
      wireSwitch('mode', function(on){ settings.mode = on ? 'dark':'light'; });
      wireSwitch('animations', function(on){ settings.animations = on; });
      wireSwitch('sound', function(on){ settings.sound = on; });
    }

    function renderWallpaper(){
      var isCustom = settings.wallpaper === 'custom' && settings.wallpaperCustom;
      main.innerHTML = '<h2>Wallpaper</h2><div class="set-card"><div class="wall-grid">'+
        Object.keys(OS.Theme.WALLPAPERS).map(function(k){
          return '<div class="wall-opt'+(settings.wallpaper===k?' selected':'')+'" data-wp="'+k+'" style="background:'+OS.Theme.WALLPAPERS[k]+';">'+(settings.wallpaper===k?'<span class="check">'+svg('check')+'</span>':'')+'</div>';
        }).join('')+
        (isCustom ? '<div class="wall-opt selected" data-wp="custom" style="background-image:url(\''+settings.wallpaperCustom.replace(/'/g,'')+'\');background-size:cover;background-position:center;"><span class="check">'+svg('check')+'</span></div>' : '')+
        '</div></div>'+
        '<div class="set-card">'+
          '<div class="lbl-title" style="margin-bottom:4px;">Upload from this device</div>'+
          '<div class="lbl-sub" style="margin-bottom:10px;">JPG, PNG, GIF or WebP, up to 3MB</div>'+
          '<input type="file" id="wp-file" accept="image/*" class="u-hidden"/>'+
          '<button class="btn btn-sm" id="wp-upload-btn">Choose image…</button>'+
          '<div class="field-error" id="wp-upload-err"></div>'+
        '</div>'+
        '<div class="set-card">'+row('…or use an image URL','Paste a direct link to an image', '<input type="text" id="wp-custom" value="'+esc(settings.wallpaper==='custom'&&!isCustomFromUpload(settings.wallpaperCustom)?settings.wallpaperCustom||'':'')+'" placeholder="https://…" style="width:220px;"/>')+
        '<button class="btn btn-sm" id="wp-use-custom" style="margin-top:4px;">Use this URL</button></div>';

      main.querySelectorAll('[data-wp]').forEach(function(node){
        node.addEventListener('click', function(){
          var val = node.getAttribute('data-wp');
          if(val === 'custom') return; /* already the active custom image, nothing to switch to */
          settings.wallpaper = val; persist(); renderWallpaper();
        });
      });
      main.querySelector('#wp-use-custom').addEventListener('click', function(){
        var url = main.querySelector('#wp-custom').value.trim();
        if(!url) return;
        settings.wallpaperCustom = url;
        settings.wallpaper = 'custom';
        var ok = persist();
        if(!ok) OS.UI.toast({ title:'Could not save wallpaper', body:'Try a shorter URL or a smaller uploaded image.' });
        renderWallpaper();
      });
      main.querySelector('#wp-upload-btn').addEventListener('click', function(){ main.querySelector('#wp-file').click(); });
      main.querySelector('#wp-file').addEventListener('change', function(e){
        var file = e.target.files && e.target.files[0];
        var errBox = main.querySelector('#wp-upload-err');
        errBox.textContent = '';
        if(!file) return;
        if(!/^image\//.test(file.type)){ errBox.textContent = 'Please choose an image file.'; return; }
        if(file.size > 3*1024*1024){ errBox.textContent = 'That image is too big — please use something under 3MB.'; return; }
        var reader = new FileReader();
        reader.onload = function(ev){
          settings.wallpaperCustom = ev.target.result;
          settings.wallpaper = 'custom';
          var ok = persist();
          if(!ok){ errBox.textContent = 'This image is too large to save on this device. Try a smaller one.'; return; }
          renderWallpaper();
        };
        reader.onerror = function(){ errBox.textContent = 'Could not read that file.'; };
        reader.readAsDataURL(file);
      });
    }
    function isCustomFromUpload(val){ return typeof val === 'string' && val.indexOf('data:') === 0; }

    function renderTaskbar(){
      main.innerHTML = '<h2>Taskbar</h2><div class="set-card">'+
        row('Position','Choose which edge the taskbar sits on', '<select id="tb-pos"><option value="bottom"'+(settings.taskbarPosition==='bottom'?' selected':'')+'>Bottom</option><option value="top"'+(settings.taskbarPosition==='top'?' selected':'')+'>Top</option></select>')+
        row('Auto-hide','Hide the taskbar until you move the pointer to the edge', switchHtml('autohide', settings.taskbarAutohide))+
        '</div>';
      main.querySelector('#tb-pos').addEventListener('change', function(e){ settings.taskbarPosition = e.target.value; persist(); });
      wireSwitch('autohide', function(on){ settings.taskbarAutohide = on; });
    }

    function renderDesktop(){
      main.innerHTML = '<h2>Desktop</h2><div class="set-card">'+
        row('Icon size','Size of icons on the desktop', '<select id="dk-size"><option value="small"'+(settings.iconSize==='small'?' selected':'')+'>Small</option><option value="medium"'+(settings.iconSize==='medium'?' selected':'')+'>Medium</option><option value="large"'+(settings.iconSize==='large'?' selected':'')+'>Large</option></select>')+
        row('Lock after inactivity','Automatically lock the screen when idle', '<select id="dk-lock"><option value="0"'+(settings.lockTimeoutMin===0?' selected':'')+'>Never</option><option value="5"'+(settings.lockTimeoutMin===5?' selected':'')+'>5 minutes</option><option value="15"'+(settings.lockTimeoutMin===15?' selected':'')+'>15 minutes</option><option value="30"'+(settings.lockTimeoutMin===30?' selected':'')+'>30 minutes</option></select>')+
        '</div>';
      main.querySelector('#dk-size').addEventListener('change', function(e){ settings.iconSize = e.target.value; persist(); });
      main.querySelector('#dk-lock').addEventListener('change', function(e){ settings.lockTimeoutMin = +e.target.value; persist(); document.dispatchEvent(new CustomEvent('meridian:idle-timeout-changed')); });
    }

    function renderNotifications(){
      main.innerHTML = '<h2>Notifications</h2><div class="set-card">'+
        row('Do not disturb','Silence toast pop-ups (still saved to the notification list)', switchHtml('dnd', settings.dndNotifications))+
        '</div>'+
        '<button class="btn btn-sm" id="nt-clear">Clear all notifications</button>';
      wireSwitch('dnd', function(on){ settings.dndNotifications = on; });
      main.querySelector('#nt-clear').addEventListener('click', function(){
        OS.Storage.setNotifications(userId, []);
        OS.UI.loadNotifications(userId);
        OS.UI.toast({ title:'Notifications cleared' });
      });
    }

    function renderAccounts(){
      var accounts = OS.Auth.listAccountsPublic();
      main.innerHTML = '<h2>Accounts</h2>'+
        accounts.map(function(a){
          return '<div class="acct-row">'+OS.Auth.avatarHtml(a.avatarColor,(a.displayName||a.username).charAt(0).toUpperCase())+
          '<div class="who"><div class="name">'+esc(a.displayName)+'</div><div class="sub">@'+esc(a.username)+'</div></div>'+
          (a.id===userId? '<span class="tag">This device</span>' : '')+
          '<button class="btn btn-sm" data-edit="'+a.id+'">Edit</button>'+
          (a.id!==userId ? '<button class="btn btn-sm btn-danger" data-del="'+a.id+'">Remove</button>' : '')+
          '</div>';
        }).join('')+
        '<div style="display:flex; gap:8px; margin-top:14px;">'+
        '<button class="btn btn-sm" id="acct-pass">Change password</button>'+
        '<button class="btn btn-sm" id="acct-switch">Switch account</button>'+
        '<button class="btn btn-sm btn-danger" id="acct-signout">Sign out</button>'+
        '</div>';
      main.querySelectorAll('[data-edit]').forEach(function(node){
        node.addEventListener('click', function(){
          var id = node.getAttribute('data-edit');
          var acc = accounts.filter(function(a){ return a.id===id; })[0];
          OS.UI.prompt({ title:'Display name', value: acc.displayName }).then(function(val){
            if(!val) return;
            OS.Auth.updateProfile(id, { displayName: val });
            renderAccounts();
            document.dispatchEvent(new CustomEvent('meridian:profile-refresh'));
          });
        });
      });
      main.querySelectorAll('[data-del]').forEach(function(node){
        node.addEventListener('click', function(){
          OS.UI.confirm({ title:'Remove this account?', message:'All of its data on this device will be deleted.', danger:true, okLabel:'Remove' }).then(function(ok){
            if(!ok) return;
            OS.Auth.deleteAccount(node.getAttribute('data-del'));
            renderAccounts();
          });
        });
      });
      main.querySelector('#acct-pass').addEventListener('click', function(){
        OS.UI.openModal(
          '<div class="modal-head"><h3>Change password</h3></div>'+
          '<div class="modal-body">'+
          '<div class="field"><label>Current password</label><input type="password" id="cp-old"/></div>'+
          '<div class="field"><label>New password</label><input type="password" id="cp-new"/></div>'+
          '<div class="field-error" id="cp-err"></div></div>'+
          '<div class="modal-foot"><button class="btn" data-x="cancel">Cancel</button><button class="btn btn-primary" data-x="ok">Save</button></div>',
          function(modal, close){
            modal.querySelector('[data-x="cancel"]').addEventListener('click', close);
            modal.querySelector('[data-x="ok"]').addEventListener('click', function(){
              var oldP = modal.querySelector('#cp-old').value, newP = modal.querySelector('#cp-new').value;
              OS.Auth.changePassword(userId, oldP, newP).then(function(res){
                if(!res.ok){ modal.querySelector('#cp-err').textContent = res.error; return; }
                close(); OS.UI.toast({ title:'Password updated' });
              });
            });
          }
        );
      });
      main.querySelector('#acct-switch').addEventListener('click', function(){ OS.Auth.logout(); });
      main.querySelector('#acct-signout').addEventListener('click', function(){ OS.Auth.logout(); });
    }

    function renderAbout(){
      var bytes = OS.Storage.byteSize();
      var pct = Math.min(100, Math.round(bytes/(5*1024*1024)*100));
      main.innerHTML = '<h2>About</h2><div class="about-block">'+OS.Icons.mark()+
        '<h3>Meridian OS</h3><p>Build 2026.1 · runs entirely in this browser tab</p></div>'+
        '<div class="set-card"><div class="lbl-title">Local storage used</div>'+
        '<div class="storage-bar"><div class="fill" style="width:'+pct+'%;"></div></div>'+
        '<div class="lbl-sub" style="margin-top:6px;">'+Math.round(bytes/1024)+' KB on this device</div></div>'+
        '<button class="btn btn-sm btn-danger" id="ab-reset">Reset all Meridian data on this device</button>';
      main.querySelector('#ab-reset').addEventListener('click', function(){
        OS.UI.confirm({ title:'Reset everything?', message:'This signs everyone out and permanently deletes every account, file and setting stored by Meridian OS on this device.', danger:true, okLabel:'Reset' }).then(function(ok){
          if(!ok) return;
          OS.Storage.wipeAll();
          location.reload();
        });
      });
    }

    function wireSwitch(id, onChange){
      var el = main.querySelector('[data-switch="'+id+'"]');
      if(!el) return;
      el.addEventListener('click', function(){
        var on = !el.classList.contains('on');
        el.classList.toggle('on', on);
        onChange(on);
        persist();
      });
    }

    renderNav();
    renderMain();

    return {
      onReopen: function(data){ if(data && data.section){ active = data.section; renderNav(); renderMain(); } }
    };
  }

  OS.Apps.register({
    id:'settings', name:'Settings', title:'Settings', icon:'gear', singleInstance:true,
    defaultWidth:680, defaultHeight:520, minWidth:480, minHeight:360,
    build: buildSettings
  });

})(window);
