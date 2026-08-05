/* =================================================================
   MERIDIAN OS — Tasks
   A small persistent to-do list, one list per user, stored through
   OS.Storage the same way notifications/bookmarks are.
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml;

  function getTasks(userId){ return OS.Storage.read(OS.Storage.userKey(userId,'tasks'), []); }
  function setTasks(userId, val){ return OS.Storage.write(OS.Storage.userKey(userId,'tasks'), val); }

  var FILTERS = { all:function(){ return true; }, active:function(t){ return !t.done; }, done:function(t){ return t.done; } };

  function buildTasks(ctx){
    var session = OS.Auth.currentUser();
    var userId = session.id;
    var tasks = getTasks(userId);
    var filter = 'all';

    ctx.bodyEl.innerHTML =
      '<div class="tk-shell">'+
        '<div class="tk-add">'+
          '<input type="text" id="tk-input" placeholder="Add a task and press Enter…" maxlength="200">'+
          '<select id="tk-pri" title="Priority">'+
            '<option value="low">Low</option>'+
            '<option value="normal" selected>Normal</option>'+
            '<option value="high">High</option>'+
          '</select>'+
        '</div>'+
        '<div class="tk-filters" id="tk-filters">'+
          '<button class="tk-filter active" data-f="all">All</button>'+
          '<button class="tk-filter" data-f="active">Active</button>'+
          '<button class="tk-filter" data-f="done">Done</button>'+
        '</div>'+
        '<div class="tk-list" id="tk-list"></div>'+
        '<div class="tk-foot"><span id="tk-count"></span><button id="tk-clear">Clear completed</button></div>'+
      '</div>';

    var input = ctx.bodyEl.querySelector('#tk-input');
    var pri = ctx.bodyEl.querySelector('#tk-pri');
    var list = ctx.bodyEl.querySelector('#tk-list');
    var countEl = ctx.bodyEl.querySelector('#tk-count');

    function save(){ setTasks(userId, tasks); refreshTitle(); }
    function refreshTitle(){
      var open = tasks.filter(function(t){ return !t.done; }).length;
      ctx.setTitle('Tasks' + (open? ' ('+open+')' : ''));
    }

    function render(){
      var rows = tasks.filter(FILTERS[filter]);
      if(rows.length === 0){
        list.innerHTML = '<div class="tk-empty">'+svg('check')+'<div>'+
          (filter==='all' ? 'No tasks yet — add one above.' : 'Nothing here.') + '</div></div>';
      } else {
        list.innerHTML = rows.map(function(t){
          return '<div class="tk-item pri-'+t.priority+(t.done?' done':'')+'" data-id="'+t.id+'">'+
            '<button class="tk-check" data-act="toggle" aria-label="Toggle done">'+(t.done? svg('check') : '')+'</button>'+
            '<span class="tk-text">'+esc(t.text)+'</span>'+
            '<span class="tk-pri-dot" title="'+t.priority+' priority"></span>'+
            '<button class="tk-del" data-act="del" title="Delete">'+svg('trash')+'</button>'+
          '</div>';
        }).join('');
      }
      var doneCount = tasks.filter(function(t){ return t.done; }).length;
      countEl.textContent = tasks.length + ' task' + (tasks.length===1?'':'s') + (doneCount? ', '+doneCount+' done' : '');
      refreshTitle();
    }

    function addTask(){
      var val = input.value.trim();
      if(!val) return;
      tasks.unshift({ id:OS.Storage.uid('task'), text:val, done:false, priority:pri.value, ts:Date.now() });
      input.value = '';
      save(); render();
    }

    input.addEventListener('keydown', function(e){ if(e.key === 'Enter') addTask(); });

    ctx.bodyEl.querySelector('#tk-filters').addEventListener('click', function(e){
      var btn = e.target.closest('.tk-filter'); if(!btn) return;
      filter = btn.getAttribute('data-f');
      ctx.bodyEl.querySelectorAll('.tk-filter').forEach(function(b){ b.classList.toggle('active', b===btn); });
      render();
    });

    list.addEventListener('click', function(e){
      var btn = e.target.closest('button'); if(!btn) return;
      var row = e.target.closest('.tk-item'); if(!row) return;
      var id = row.getAttribute('data-id');
      var task = tasks.filter(function(t){ return t.id === id; })[0];
      if(!task) return;
      var act = btn.getAttribute('data-act');
      if(act === 'toggle'){ task.done = !task.done; save(); render(); }
      else if(act === 'del'){ tasks = tasks.filter(function(t){ return t.id !== id; }); save(); render(); }
    });

    ctx.bodyEl.querySelector('#tk-clear').addEventListener('click', function(){
      if(!tasks.some(function(t){ return t.done; })) return;
      OS.UI.confirm({ title:'Clear completed tasks?', message:'This removes every task marked done.', okLabel:'Clear', danger:true }).then(function(ok){
        if(!ok) return;
        tasks = tasks.filter(function(t){ return !t.done; });
        save(); render();
      });
    });

    render();
    input.focus();
  }

  OS.Apps.register({
    id:'tasks', name:'Tasks', title:'Tasks', icon:'check',
    defaultWidth:380, defaultHeight:480, minWidth:300, minHeight:340,
    build: buildTasks
  });

})(window);
