/* =================================================================
   MERIDIAN OS — Notepad + Calculator
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml;

  /* ------------------------------ Notepad ------------------------------ */
  function walkFiles(node, pathArr, out){
    (node.children||[]).forEach(function(c){
      if(c.type === 'file') out.push({ path: pathArr, name: c.name });
      else walkFiles(c, pathArr.concat([c.name]), out);
    });
    return out;
  }

  function buildNotepad(ctx){
    var session = OS.Auth.currentUser();
    var userId = session.id;
    var state = {
      path: (ctx.data && ctx.data.path) || null,
      name: (ctx.data && ctx.data.name) || null,
      dirty: false
    };

    ctx.bodyEl.innerHTML =
      '<div class="app-toolbar">'+
        '<button data-act="new" title="New">'+svg('filePlus')+'</button>'+
        '<button data-act="open" title="Open">'+svg('folder')+'</button>'+
        '<button data-act="save" title="Save">'+svg('save')+'</button>'+
      '</div>'+
      '<textarea class="np-text" id="np-text" placeholder="Start typing…" spellcheck="false"></textarea>'+
      '<div class="np-status"><span id="np-path">Untitled</span><span id="np-dirty"></span></div>';

    var textarea = ctx.bodyEl.querySelector('#np-text');
    textarea.value = (ctx.data && ctx.data.content) || '';
    updateStatus();
    refreshTitle();

    textarea.addEventListener('input', function(){ state.dirty = true; updateStatus(); refreshTitle(); });

    function refreshTitle(){
      ctx.setTitle((state.dirty?'• ':'') + (state.name || 'Untitled') + ' — Notepad');
    }
    function updateStatus(){
      var label = state.path ? OS.FS.pathString(state.path) + '/' + state.name : (state.name || 'Untitled — not saved');
      ctx.bodyEl.querySelector('#np-path').textContent = label;
      ctx.bodyEl.querySelector('#np-dirty').textContent = state.dirty ? 'Unsaved changes' : 'Saved';
    }

    function doSave(){
      if(!state.name){
        OS.UI.prompt({ title:'Save As', placeholder:'File name (e.g. notes.txt)' }).then(function(name){
          if(!name) return;
          if(!/\.[a-z0-9]+$/i.test(name)) name += '.txt';
          state.name = name; state.path = ['Documents'];
          var res = OS.FS.createFile(userId, state.path, name, textarea.value);
          if(!res.ok){ OS.UI.toast({ title:'Could not save', body:res.error }); return; }
          state.dirty = false; updateStatus(); refreshTitle();
          OS.UI.toast({ title:'Saved', body:name, icon:'check' });
        });
        return;
      }
      OS.FS.writeFile(userId, state.path, state.name, textarea.value);
      state.dirty = false; updateStatus(); refreshTitle();
      OS.UI.toast({ title:'Saved', body:state.name, icon:'check' });
    }

    function doOpenDialog(){
      var root = OS.FS.getRoot(userId);
      var files = walkFiles(root, [], []);
      var list = files.map(function(f,i){
        return '<div class="sm-list-item" data-i="'+i+'" style="cursor:pointer;"><span class="glyph">'+svg('fileText')+'</span><span class="lbl">'+esc(OS.FS.pathString(f.path)+'/'+f.name)+'</span></div>';
      }).join('') || '<div class="sm-empty">No files yet — create one from File Explorer.</div>';
      OS.UI.openModal(
        '<div class="modal-head"><h3>Open file</h3></div><div class="modal-body" style="max-height:280px;overflow-y:auto;">'+list+'</div><div class="modal-foot"><button class="btn" data-x="cancel">Cancel</button></div>',
        function(modal, close){
          modal.querySelector('[data-x="cancel"]').addEventListener('click', close);
          modal.querySelectorAll('.sm-list-item').forEach(function(node){
            node.addEventListener('click', function(){
              var f = files[+node.getAttribute('data-i')];
              var root2 = OS.FS.getRoot(userId);
              var parent = OS.FS.getNode(root2, f.path);
              var file = parent.children.filter(function(c){ return c.name===f.name; })[0];
              textarea.value = file.content||'';
              state.path = f.path; state.name = f.name; state.dirty=false;
              updateStatus(); refreshTitle(); close();
            });
          });
        }
      );
    }

    ctx.bodyEl.querySelector('.app-toolbar').addEventListener('click', function(e){
      var btn = e.target.closest('button'); if(!btn) return;
      var act = btn.getAttribute('data-act');
      if(act === 'new'){
        if(state.dirty){
          OS.UI.confirm({ title:'Discard changes?', message:'Unsaved changes to "'+(state.name||'Untitled')+'" will be lost.', okLabel:'Discard', danger:true }).then(function(ok){
            if(!ok) return;
            textarea.value=''; state={path:null,name:null,dirty:false}; updateStatus(); refreshTitle();
          });
        } else { textarea.value=''; state={path:null,name:null,dirty:false}; updateStatus(); refreshTitle(); }
      }
      else if(act === 'open') doOpenDialog();
      else if(act === 'save') doSave();
    });

    return {
      onReopen: function(data){
        if(!data) return;
        textarea.value = data.content||'';
        state = { path:data.path||null, name:data.name||null, dirty:false };
        updateStatus(); refreshTitle();
      }
    };
  }

  OS.Apps.register({
    id:'notepad', name:'Notepad', title:'Notepad', icon:'fileText',
    defaultWidth:560, defaultHeight:460, minWidth:340, minHeight:260,
    build: buildNotepad
  });

  /* ----------------------------- Calculator ----------------------------- */
  function buildCalculator(ctx){
    var st = { display:'0', prev:'', operator:null, first:null, waiting:false };
    var OPS = { add:'+', sub:'−', mul:'×', div:'÷' };

    ctx.bodyEl.innerHTML =
      '<div class="calc-shell">'+
        '<div class="calc-display"><div class="prev" id="calc-prev"></div><div class="cur" id="calc-cur">0</div></div>'+
        '<div class="calc-pad">'+
          btn('AC','ac')+btn('C','ce')+btn('%','pct','op')+btn('÷','div','op')+
          btn('7','7')+btn('8','8')+btn('9','9')+btn('×','mul','op')+
          btn('4','4')+btn('5','5')+btn('6','6')+btn('−','sub','op')+
          btn('1','1')+btn('2','2')+btn('3','3')+btn('+','add','op')+
          btn('0','0','wide')+btn('.','dot')+btn('=','eq','eq')+
        '</div>'+
      '</div>';

    function btn(label, act, cls){ return '<button class="'+(cls||'')+'" data-act="'+act+'">'+label+'</button>'; }

    var curEl = ctx.bodyEl.querySelector('#calc-cur');
    var prevEl = ctx.bodyEl.querySelector('#calc-prev');

    function render(){
      curEl.textContent = st.display;
      prevEl.textContent = st.prev;
    }
    function compute(){
      var a = st.first, b = parseFloat(st.display), r = b;
      switch(st.operator){
        case 'add': r = a+b; break;
        case 'sub': r = a-b; break;
        case 'mul': r = a*b; break;
        case 'div': r = b===0 ? NaN : a/b; break;
      }
      st.display = String(Math.round((r+Number.EPSILON)*1e10)/1e10);
      if(isNaN(r)) st.display = 'Error';
    }
    function pressDigit(d){
      if(st.waiting || st.display==='0' || st.display==='Error'){ st.display = d; st.waiting=false; }
      else st.display += d;
    }
    function pressDot(){
      if(st.waiting){ st.display='0.'; st.waiting=false; return; }
      if(st.display.indexOf('.')===-1) st.display += '.';
    }
    function pressOp(op){
      if(st.operator && !st.waiting) compute();
      st.first = parseFloat(st.display);
      st.operator = op;
      st.waiting = true;
      st.prev = st.display + ' ' + OPS[op];
    }
    function pressEq(){
      if(!st.operator) return;
      compute();
      st.prev = '';
      st.operator = null;
      st.waiting = false;
    }
    function pressPct(){ st.display = String(parseFloat(st.display)/100); }
    function pressAC(){ st = { display:'0', prev:'', operator:null, first:null, waiting:false }; }
    function pressCE(){ st.display = '0'; }

    ctx.bodyEl.querySelector('.calc-pad').addEventListener('click', function(e){
      var btn = e.target.closest('button'); if(!btn) return;
      var act = btn.getAttribute('data-act');
      if(/^[0-9]$/.test(act)) pressDigit(act);
      else if(act === 'dot') pressDot();
      else if(act === 'ac') pressAC();
      else if(act === 'ce') pressCE();
      else if(act === 'pct') pressPct();
      else if(act === 'eq') pressEq();
      else pressOp(act);
      render();
    });

    function keyHandler(e){
      if(/^[0-9]$/.test(e.key)) pressDigit(e.key);
      else if(e.key === '.') pressDot();
      else if(e.key === '+') pressOp('add');
      else if(e.key === '-') pressOp('sub');
      else if(e.key === '*') pressOp('mul');
      else if(e.key === '/') pressOp('div');
      else if(e.key === 'Enter' || e.key === '=') pressEq();
      else if(e.key === 'Escape') pressAC();
      else if(e.key === 'Backspace'){ st.display = st.display.length>1 ? st.display.slice(0,-1) : '0'; }
      else return;
      e.preventDefault();
      render();
    }
    ctx.winEl.addEventListener('keydown', keyHandler);
    ctx.winEl.setAttribute('tabindex','-1');
    render();
  }

  OS.Apps.register({
    id:'calculator', name:'Calculator', title:'Calculator', icon:'calculator',
    defaultWidth:300, defaultHeight:440, minWidth:280, minHeight:400,
    build: buildCalculator
  });

})(window);
