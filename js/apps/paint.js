/* =================================================================
   MERIDIAN OS — Paint
   Canvas drawing app. Saves as a PNG (data-URL content) into the
   virtual file system, so pictures can be reopened from Explorer /
   the Image Viewer, and Notepad-style Open/Save flows stay familiar.
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml;

  var COLORS = ['#f4ede1','#ff6b6b','#ffa857','#ffd166','#7bd88f','#5ac8fa','#7c93ff','#c98bf0','#8a6a4f','#111111'];

  function walkImageFiles(node, pathArr, out){
    (node.children||[]).forEach(function(c){
      if(c.type === 'file' && /\.(png|jpg|jpeg)$/i.test(c.name)) out.push({ path: pathArr, name: c.name });
      else if(c.type === 'folder') walkImageFiles(c, pathArr.concat([c.name]), out);
    });
    return out;
  }

  function buildPaint(ctx){
    var session = OS.Auth.currentUser();
    var userId = session.id;
    var state = { path: (ctx.data && ctx.data.path) || null, name: (ctx.data && ctx.data.name) || null, dirty:false };

    ctx.bodyEl.innerHTML =
      '<div class="pt-shell">'+
        '<div class="app-toolbar pt-toolbar">'+
          '<button data-act="new" title="New canvas">'+svg('filePlus')+'</button>'+
          '<button data-act="open" title="Open image">'+svg('folder')+'</button>'+
          '<button data-act="save" title="Save">'+svg('save')+'</button>'+
          '<span class="pt-sep"></span>'+
          '<div class="pt-swatches" id="pt-swatches"></div>'+
          '<input type="color" id="pt-custom-color" value="#f4ede1" title="Custom color">'+
          '<span class="pt-sep"></span>'+
          '<input type="range" id="pt-size" min="1" max="40" value="4" title="Brush size">'+
          '<button data-act="erase" id="pt-erase" title="Eraser">'+svg('square')+'</button>'+
          '<button data-act="clear" title="Clear canvas">'+svg('trash')+'</button>'+
          '<button data-act="download" title="Download as PNG">'+svg('download')+'</button>'+
        '</div>'+
        '<div class="pt-canvas-wrap"><canvas id="pt-canvas" width="760" height="460"></canvas></div>'+
        '<div class="np-status"><span id="pt-path">Untitled</span><span id="pt-dirty"></span></div>'+
      '</div>';

    var canvas = ctx.bodyEl.querySelector('#pt-canvas');
    var cx = canvas.getContext('2d');
    var sizeInput = ctx.bodyEl.querySelector('#pt-size');
    var customColor = ctx.bodyEl.querySelector('#pt-custom-color');
    var eraseBtn = ctx.bodyEl.querySelector('#pt-erase');
    var swatchesEl = ctx.bodyEl.querySelector('#pt-swatches');
    var color = COLORS[0], erasing = false, drawing = false, last = null;

    swatchesEl.innerHTML = COLORS.map(function(c,i){
      return '<button class="pt-swatch'+(i===0?' active':'')+'" data-c="'+c+'" style="background:'+c+'"></button>';
    }).join('');

    function fillWhiteBg(){
      cx.fillStyle = '#1c1712';
      cx.fillRect(0,0,canvas.width,canvas.height);
    }
    fillWhiteBg();

    function updateStatus(){
      var label = state.path ? OS.FS.pathString(state.path) + '/' + state.name : (state.name || 'Untitled — not saved');
      ctx.bodyEl.querySelector('#pt-path').textContent = label;
      ctx.bodyEl.querySelector('#pt-dirty').textContent = state.dirty ? 'Unsaved changes' : 'Saved';
    }
    function refreshTitle(){
      ctx.setTitle((state.dirty?'• ':'') + (state.name || 'Untitled') + ' — Paint');
    }
    updateStatus(); refreshTitle();

    function pointerPos(e){
      var r = canvas.getBoundingClientRect();
      var sx = canvas.width / r.width, sy = canvas.height / r.height;
      var cxv = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      var cyv = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return { x: cxv*sx, y: cyv*sy };
    }
    function startDraw(e){
      drawing = true; last = pointerPos(e);
      dot(last);
      e.preventDefault();
    }
    function dot(p){
      cx.beginPath();
      cx.fillStyle = erasing ? '#1c1712' : color;
      cx.arc(p.x, p.y, (+sizeInput.value)/2, 0, Math.PI*2);
      cx.fill();
    }
    function moveDraw(e){
      if(!drawing) return;
      var p = pointerPos(e);
      cx.strokeStyle = erasing ? '#1c1712' : color;
      cx.lineWidth = +sizeInput.value;
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      cx.beginPath();
      cx.moveTo(last.x, last.y);
      cx.lineTo(p.x, p.y);
      cx.stroke();
      last = p;
      state.dirty = true; updateStatus(); refreshTitle();
    }
    function endDraw(){ drawing = false; last = null; }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);
    canvas.addEventListener('touchstart', startDraw, {passive:false});
    canvas.addEventListener('touchmove', moveDraw, {passive:false});
    canvas.addEventListener('touchend', endDraw);

    swatchesEl.addEventListener('click', function(e){
      var btn = e.target.closest('.pt-swatch'); if(!btn) return;
      color = btn.getAttribute('data-c');
      erasing = false;
      swatchesEl.querySelectorAll('.pt-swatch').forEach(function(b){ b.classList.toggle('active', b===btn); });
      eraseBtn.classList.remove('active');
    });
    customColor.addEventListener('input', function(){
      color = customColor.value; erasing = false;
      swatchesEl.querySelectorAll('.pt-swatch').forEach(function(b){ b.classList.remove('active'); });
      eraseBtn.classList.remove('active');
    });

    function resetCanvas(){
      state = { path:null, name:null, dirty:false };
      fillWhiteBg(); updateStatus(); refreshTitle();
    }

    function loadImageDataUrl(dataUrl){
      var img = new Image();
      img.onload = function(){
        fillWhiteBg();
        var scale = Math.min(canvas.width/img.width, canvas.height/img.height, 1);
        var w = img.width*scale, h = img.height*scale;
        cx.drawImage(img, (canvas.width-w)/2, (canvas.height-h)/2, w, h);
      };
      img.src = dataUrl;
    }

    function doOpenDialog(){
      var root = OS.FS.getRoot(userId);
      var files = walkImageFiles(root, [], []);
      var list = files.map(function(f,i){
        return '<div class="sm-list-item" data-i="'+i+'" style="cursor:pointer;"><span class="glyph">'+svg('image')+'</span><span class="lbl">'+esc(OS.FS.pathString(f.path)+'/'+f.name)+'</span></div>';
      }).join('') || '<div class="sm-empty">No images yet — save one from Paint first.</div>';
      OS.UI.openModal(
        '<div class="modal-head"><h3>Open image</h3></div><div class="modal-body" style="max-height:280px;overflow-y:auto;">'+list+'</div><div class="modal-foot"><button class="btn" data-x="cancel">Cancel</button></div>',
        function(modal, close){
          modal.querySelector('[data-x="cancel"]').addEventListener('click', close);
          modal.querySelectorAll('.sm-list-item').forEach(function(node){
            node.addEventListener('click', function(){
              var f = files[+node.getAttribute('data-i')];
              var root2 = OS.FS.getRoot(userId);
              var parent = OS.FS.getNode(root2, f.path);
              var file = parent.children.filter(function(c){ return c.name===f.name; })[0];
              state.path = f.path; state.name = f.name; state.dirty = false;
              loadImageDataUrl(file.content||'');
              updateStatus(); refreshTitle(); close();
            });
          });
        }
      );
    }

    function doSave(){
      var dataUrl = canvas.toDataURL('image/png');
      if(!state.name){
        OS.UI.prompt({ title:'Save As', placeholder:'File name (e.g. drawing.png)', value:'drawing.png' }).then(function(name){
          if(!name) return;
          if(!/\.(png|jpg|jpeg)$/i.test(name)) name += '.png';
          state.name = name; state.path = ['Pictures'];
          var res = OS.FS.createFile(userId, state.path, name, dataUrl);
          if(!res.ok){ OS.UI.toast({ title:'Could not save', body:res.error }); return; }
          state.dirty = false; updateStatus(); refreshTitle();
          OS.UI.toast({ title:'Saved', body:name, icon:'check' });
        });
        return;
      }
      OS.FS.writeFile(userId, state.path, state.name, dataUrl);
      state.dirty = false; updateStatus(); refreshTitle();
      OS.UI.toast({ title:'Saved', body:state.name, icon:'check' });
    }

    ctx.bodyEl.querySelector('.pt-toolbar').addEventListener('click', function(e){
      var btn = e.target.closest('button'); if(!btn) return;
      var act = btn.getAttribute('data-act');
      if(act === 'new'){
        if(state.dirty){
          OS.UI.confirm({ title:'Discard changes?', message:'Unsaved changes to "'+(state.name||'Untitled')+'" will be lost.', okLabel:'Discard', danger:true }).then(function(ok){
            if(ok) resetCanvas();
          });
        } else resetCanvas();
      }
      else if(act === 'open') doOpenDialog();
      else if(act === 'save') doSave();
      else if(act === 'clear'){
        OS.UI.confirm({ title:'Clear canvas?', message:'This wipes your current drawing (unsaved changes will be lost).', okLabel:'Clear', danger:true }).then(function(ok){
          if(!ok) return;
          fillWhiteBg(); state.dirty = true; updateStatus(); refreshTitle();
        });
      }
      else if(act === 'erase'){
        erasing = !erasing;
        eraseBtn.classList.toggle('active', erasing);
        if(erasing) swatchesEl.querySelectorAll('.pt-swatch').forEach(function(b){ b.classList.remove('active'); });
      }
      else if(act === 'download'){
        var a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = (state.name || 'drawing') + (/\.(png|jpg|jpeg)$/i.test(state.name||'') ? '' : '.png');
        document.body.appendChild(a); a.click(); a.remove();
      }
    });

    return {
      onReopen: function(data){
        if(!data) return;
        state = { path:data.path||null, name:data.name||null, dirty:false };
        if(data.content) loadImageDataUrl(data.content); else fillWhiteBg();
        updateStatus(); refreshTitle();
      }
    };
  }

  OS.Apps.register({
    id:'paint', name:'Paint', title:'Paint', icon:'palette',
    defaultWidth:820, defaultHeight:600, minWidth:480, minHeight:400,
    build: buildPaint
  });

})(window);
