/* =================================================================
   MERIDIAN OS — Virtual file system (OS.FS) + File Explorer app
   The same VFS is shared by the Explorer, Notepad and Terminal apps.
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml;

  /* ----------------------------- OS.FS ----------------------------- */
  function getRoot(userId){ return OS.Storage.getUserFS(userId); }
  function saveRoot(userId, root){ OS.Storage.setUserFS(userId, root); }

  function getNode(root, pathArr){
    var node = root;
    for(var i=0;i<pathArr.length;i++){
      if(!node.children) return null;
      var next = node.children.filter(function(c){ return c.name === pathArr[i]; })[0];
      if(!next) return null;
      node = next;
    }
    return node;
  }
  function sortedChildren(node){
    if(!node || !node.children) return [];
    return node.children.slice().sort(function(a,b){
      if(a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
  function nameTaken(node, name){ return node.children.some(function(c){ return c.name.toLowerCase() === name.toLowerCase(); }); }

  function createFolder(userId, pathArr, name){
    var root = getRoot(userId);
    var parent = getNode(root, pathArr);
    if(!parent) return { ok:false, error:'Folder not found.' };
    if(!name || !name.trim()) return { ok:false, error:'Name cannot be empty.' };
    if(nameTaken(parent, name)) return { ok:false, error:'That name already exists here.' };
    parent.children.push({ name:name.trim(), type:'folder', children:[] });
    saveRoot(userId, root);
    return { ok:true };
  }
  function createFile(userId, pathArr, name, content){
    var root = getRoot(userId);
    var parent = getNode(root, pathArr);
    if(!parent) return { ok:false, error:'Folder not found.' };
    if(!name || !name.trim()) return { ok:false, error:'Name cannot be empty.' };
    if(nameTaken(parent, name)) return { ok:false, error:'That name already exists here.' };
    parent.children.push({ name:name.trim(), type:'file', content: content||'' });
    saveRoot(userId, root);
    return { ok:true };
  }
  function writeFile(userId, pathArr, name, content){
    var root = getRoot(userId);
    var parent = getNode(root, pathArr);
    if(!parent) return { ok:false, error:'Folder not found.' };
    var file = parent.children.filter(function(c){ return c.name===name && c.type==='file'; })[0];
    if(!file) return createFile(userId, pathArr, name, content);
    file.content = content;
    saveRoot(userId, root);
    return { ok:true };
  }
  function renameEntry(userId, pathArr, oldName, newName){
    var root = getRoot(userId);
    var parent = getNode(root, pathArr);
    if(!parent) return { ok:false, error:'Folder not found.' };
    if(!newName || !newName.trim()) return { ok:false, error:'Name cannot be empty.' };
    if(oldName.toLowerCase() !== newName.toLowerCase() && nameTaken(parent, newName)) return { ok:false, error:'That name already exists here.' };
    var entry = parent.children.filter(function(c){ return c.name === oldName; })[0];
    if(!entry) return { ok:false, error:'Item not found.' };
    entry.name = newName.trim();
    saveRoot(userId, root);
    return { ok:true };
  }
  function removeEntry(userId, pathArr, name){
    var root = getRoot(userId);
    var parent = getNode(root, pathArr);
    if(!parent) return { ok:false, error:'Folder not found.' };
    parent.children = parent.children.filter(function(c){ return c.name !== name; });
    saveRoot(userId, root);
    return { ok:true };
  }
  function pathString(pathArr){ return '/' + pathArr.join('/'); }

  OS.FS = {
    getRoot:getRoot, saveRoot:saveRoot, getNode:getNode, sortedChildren:sortedChildren,
    createFolder:createFolder, createFile:createFile, writeFile:writeFile,
    renameEntry:renameEntry, removeEntry:removeEntry, pathString:pathString
  };

  /* --------------------------- Explorer app --------------------------- */
  function iconFor(entry){
    if(entry.type === 'folder') return 'folder';
    if(/\.(txt|md|log)$/i.test(entry.name)) return 'fileText';
    if(/\.(png|jpg|jpeg|gif|svg)$/i.test(entry.name)) return 'image';
    return 'fileText';
  }

  function build(ctx){
    var session = OS.Auth.currentUser();
    var userId = session.id;
    var path = (ctx.data && ctx.data.startPath) || [];
    var histStack = [path.slice()], histIdx = 0;
    var selected = null;

    ctx.bodyEl.innerHTML =
      '<div class="app-toolbar">'+
        '<button data-act="back" title="Back">'+svg('arrowLeft')+'</button>'+
        '<button data-act="fwd" title="Forward">'+svg('arrowRight')+'</button>'+
        '<button data-act="up" title="Up">'+svg('chevronRight',"icon")+'</button>'+
        '<div class="sep"></div>'+
        '<button data-act="newfolder" title="New folder">'+svg('folderPlus')+'</button>'+
        '<button data-act="newfile" title="New text file">'+svg('filePlus')+'</button>'+
        '<button data-act="rename" title="Rename" disabled>'+svg('edit')+'</button>'+
        '<button data-act="delete" title="Delete" disabled>'+svg('trash')+'</button>'+
        '<div class="fx-breadcrumb" id="fx-crumb" style="margin-left:8px;"></div>'+
      '</div>'+
      '<div class="fx-shell">'+
        '<div class="fx-side" id="fx-side"></div>'+
        '<div class="fx-main" id="fx-main"></div>'+
      '</div>'+
      '<div class="fx-statusbar" id="fx-status"></div>';

    var upBtn = ctx.bodyEl.querySelector('[data-act="up"]');
    upBtn.style.transform = 'rotate(-90deg)';

    var quickLinks = [
      { label:'Home', path:[], icon:'desktop' },
      { label:'Documents', path:['Documents'], icon:'folder' },
      { label:'Pictures', path:['Pictures'], icon:'folder' },
      { label:'Downloads', path:['Downloads'], icon:'download' }
    ];
    ctx.bodyEl.querySelector('#fx-side').innerHTML = quickLinks.map(function(q){
      return '<div class="fx-side-item" data-path=\''+JSON.stringify(q.path)+'\'>'+svg(q.icon,'icon')+'<span>'+esc(q.label)+'</span></div>';
    }).join('');

    function renderCrumb(){
      var parts = ['Home'].concat(path);
      var crumb = ctx.bodyEl.querySelector('#fx-crumb');
      crumb.innerHTML = parts.map(function(p, i){
        var html = '<span data-i="'+i+'">'+esc(p)+'</span>';
        if(i < parts.length-1) html += '<span class="sep">'+svg('chevronRight')+'</span>';
        return html;
      }).join('');
      crumb.querySelectorAll('span[data-i]').forEach(function(node){
        node.addEventListener('click', function(){
          var i = +node.getAttribute('data-i');
          navigate(path.slice(0, i));
        });
      });
    }

    function renderSide(){
      ctx.bodyEl.querySelectorAll('.fx-side-item').forEach(function(node){
        var p = JSON.parse(node.getAttribute('data-path'));
        node.classList.toggle('active', JSON.stringify(p) === JSON.stringify(path));
      });
    }

    function renderMain(){
      var root = OS.FS.getRoot(userId);
      var node = OS.FS.getNode(root, path);
      var main = ctx.bodyEl.querySelector('#fx-main');
      selected = null;
      updateToolbarState();
      if(!node){ navigate([]); return; }

      if(node.virtual === 'downloads'){
        var dls = OS.Storage.getDownloads(userId);
        if(!dls.length){
          main.innerHTML = '<div class="fx-empty">'+svg('download','icon')+'<div>Files you download in the browser will appear here.</div></div>';
        }else{
          main.innerHTML = '<div class="fx-grid">'+dls.map(function(d){
            return '<div class="fx-entry" data-kind="download"><span class="icon">'+svg('fileText')+'</span><span class="name">'+esc(d.name)+'</span></div>';
          }).join('')+'</div>';
        }
        ctx.bodyEl.querySelector('#fx-status').textContent = dls.length + (dls.length===1?' item':' items') + ' · read-only';
        return;
      }

      var children = OS.FS.sortedChildren(node);
      if(!children.length){
        main.innerHTML = '<div class="fx-empty">'+svg('folder','icon')+'<div>This folder is empty.</div></div>';
      } else {
        main.innerHTML = '<div class="fx-grid">'+children.map(function(c){
          return '<div class="fx-entry" data-name="'+esc(c.name)+'" data-type="'+c.type+'"><span class="icon">'+svg(iconFor(c))+'</span><span class="name">'+esc(c.name)+'</span></div>';
        }).join('')+'</div>';
      }
      ctx.bodyEl.querySelector('#fx-status').textContent = children.length + (children.length===1?' item':' items');
      wireEntries();
    }

    function wireEntries(){
      ctx.bodyEl.querySelectorAll('.fx-entry[data-name]').forEach(function(node){
        node.addEventListener('click', function(e){
          ctx.bodyEl.querySelectorAll('.fx-entry').forEach(function(n){ n.classList.remove('selected'); });
          node.classList.add('selected');
          selected = { name: node.getAttribute('data-name'), type: node.getAttribute('data-type') };
          updateToolbarState();
        });
        node.addEventListener('dblclick', function(){
          var name = node.getAttribute('data-name'), type = node.getAttribute('data-type');
          if(type === 'folder') navigate(path.concat([name]));
          else openFile(name);
        });
        node.addEventListener('contextmenu', function(e){
          e.preventDefault();
          selected = { name: node.getAttribute('data-name'), type: node.getAttribute('data-type') };
          ctx.bodyEl.querySelectorAll('.fx-entry').forEach(function(n){ n.classList.remove('selected'); });
          node.classList.add('selected');
          updateToolbarState();
          OS.UI.showContextMenu(e.clientX, e.clientY, [
            { label:'Open', icon:'chevronRight', action:function(){ selected.type==='folder'? navigate(path.concat([selected.name])) : openFile(selected.name); } },
            { label:'Rename', icon:'edit', action:doRename },
            { label:'Delete', icon:'trash', danger:true, action:doDelete }
          ]);
        });
      });
    }

    function updateToolbarState(){
      ctx.bodyEl.querySelector('[data-act="back"]').disabled = histIdx <= 0;
      ctx.bodyEl.querySelector('[data-act="fwd"]').disabled = histIdx >= histStack.length-1;
      ctx.bodyEl.querySelector('[data-act="up"]').disabled = path.length === 0;
      ctx.bodyEl.querySelector('[data-act="rename"]').disabled = !selected;
      ctx.bodyEl.querySelector('[data-act="delete"]').disabled = !selected;
    }

    function openFile(name){
      var root = OS.FS.getRoot(userId);
      var node = OS.FS.getNode(root, path);
      var file = node.children.filter(function(c){ return c.name===name; })[0];
      if(!file) return;
      OS.WM.openWindow('notepad', { path: path.slice(), name: name, content: file.content||'' });
    }

    function navigate(newPath, fromHistory){
      path = newPath;
      if(!fromHistory){
        histStack = histStack.slice(0, histIdx+1);
        histStack.push(path.slice());
        histIdx = histStack.length-1;
      }
      renderCrumb(); renderSide(); renderMain();
      ctx.setTitle((path.length? path[path.length-1] : 'File Explorer'));
    }

    ctx.bodyEl.querySelector('#fx-side').addEventListener('click', function(e){
      var item = e.target.closest('.fx-side-item');
      if(item) navigate(JSON.parse(item.getAttribute('data-path')));
    });

    function doRename(){
      if(!selected) return;
      OS.UI.prompt({ title:'Rename', value: selected.name }).then(function(val){
        if(val === null) return;
        var res = OS.FS.renameEntry(userId, path, selected.name, val);
        if(!res.ok) OS.UI.toast({ title:'Could not rename', body:res.error, icon:'info' });
        else renderMain();
      });
    }
    function doDelete(){
      if(!selected) return;
      OS.UI.confirm({ title:'Delete '+selected.name+'?', message:'This cannot be undone.', danger:true, okLabel:'Delete' }).then(function(ok){
        if(!ok) return;
        OS.FS.removeEntry(userId, path, selected.name);
        renderMain();
      });
    }

    ctx.bodyEl.querySelector('.app-toolbar').addEventListener('click', function(e){
      var btn = e.target.closest('button'); if(!btn || btn.disabled) return;
      var act = btn.getAttribute('data-act');
      if(act === 'back' && histIdx>0){ histIdx--; navigate(histStack[histIdx], true); }
      else if(act === 'fwd' && histIdx<histStack.length-1){ histIdx++; navigate(histStack[histIdx], true); }
      else if(act === 'up' && path.length){ navigate(path.slice(0,-1)); }
      else if(act === 'newfolder'){
        OS.UI.prompt({ title:'New folder', placeholder:'Folder name' }).then(function(name){
          if(!name) return;
          var res = OS.FS.createFolder(userId, path, name);
          if(!res.ok) OS.UI.toast({ title:'Could not create folder', body:res.error }); else renderMain();
        });
      }
      else if(act === 'newfile'){
        OS.UI.prompt({ title:'New text file', placeholder:'File name (e.g. notes.txt)' }).then(function(name){
          if(!name) return;
          if(!/\.[a-z0-9]+$/i.test(name)) name += '.txt';
          var res = OS.FS.createFile(userId, path, name, '');
          if(!res.ok) OS.UI.toast({ title:'Could not create file', body:res.error }); else { renderMain(); }
        });
      }
      else if(act === 'rename') doRename();
      else if(act === 'delete') doDelete();
    });

    navigate(path);

    return {
      onReopen: function(data){ if(data && data.startPath) navigate(data.startPath); }
    };
  }

  OS.Apps.register({
    id:'explorer', name:'File Explorer', title:'File Explorer', icon:'folder',
    defaultWidth:720, defaultHeight:480, minWidth:420, minHeight:280,
    build: build
  });

})(window);
