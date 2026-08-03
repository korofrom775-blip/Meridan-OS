/* =================================================================
   MERIDIAN OS — Terminal
   A small set of harmless, informational commands operating on the
   same virtual file system as File Explorer and Notepad.
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var esc = OS.Util.escapeHtml;

  var HELP_TEXT =
    'Available commands:\n'+
    '  help            show this list\n'+
    '  ls              list the current folder\n'+
    '  cd <folder>     change folder (cd .. to go up, cd / for home)\n'+
    '  pwd             print working folder\n'+
    '  cat <file>      print a text file\n'+
    '  mkdir <name>    create a folder\n'+
    '  touch <name>    create an empty text file\n'+
    '  echo <text>     print text\n'+
    '  whoami          show the signed-in user\n'+
    '  date            show the current date and time\n'+
    '  sysinfo         show system information\n'+
    '  clear           clear the screen\n'+
    '  exit            close this window';

  function buildTerminal(ctx){
    var session = OS.Auth.currentUser();
    var userId = session.id;
    var cwd = [];
    var cmdHistory = [];
    var histPos = -1;

    ctx.bodyEl.innerHTML = '<div class="term-shell" id="term-shell"></div>';
    var shell = ctx.bodyEl.querySelector('#term-shell');

    function print(text, cls){
      var div = document.createElement('div');
      div.className = 'term-line' + (cls? ' '+cls : '');
      div.textContent = text;
      shell.appendChild(div);
      shell.scrollTop = shell.scrollHeight;
    }
    function prompt(){ return session.username + '@meridian:' + (cwd.length? '/'+cwd.join('/') : '~') + '$'; }

    function newPromptRow(){
      var row = document.createElement('div');
      row.className = 'term-prompt-row';
      row.innerHTML = '<span class="prompt">'+esc(prompt())+'</span>';
      var input = document.createElement('input');
      input.className = 'term-input'; input.autocomplete='off'; input.spellcheck=false;
      row.appendChild(input);
      shell.appendChild(row);
      input.focus();
      shell.scrollTop = shell.scrollHeight;
      input.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){
          var val = input.value;
          row.removeChild(input);
          row.innerHTML += '<span>'+esc(val)+'</span>';
          if(val.trim()){ cmdHistory.push(val); histPos = cmdHistory.length; }
          run(val.trim());
          newPromptRow();
        } else if(e.key === 'ArrowUp'){
          if(histPos > 0){ histPos--; input.value = cmdHistory[histPos]; }
          e.preventDefault();
        } else if(e.key === 'ArrowDown'){
          if(histPos < cmdHistory.length-1){ histPos++; input.value = cmdHistory[histPos]; }
          else { histPos = cmdHistory.length; input.value=''; }
          e.preventDefault();
        }
      });
      shell.addEventListener('click', function(){ input.focus(); });
    }

    function resolveDir(p){
      var root = OS.FS.getRoot(userId);
      return OS.FS.getNode(root, p);
    }

    function run(line){
      if(!line) return;
      var parts = line.split(/\s+/);
      var cmd = parts[0].toLowerCase();
      var rest = line.slice(cmd.length).trim();
      switch(cmd){
        case 'help': print(HELP_TEXT); break;
        case 'whoami': print(session.username); break;
        case 'date': print(new Date().toString()); break;
        case 'pwd': print('/'+cwd.join('/')); break;
        case 'clear': shell.innerHTML=''; break;
        case 'echo': print(rest); break;
        case 'exit': ctx.close(); break;
        case 'sysinfo':
          print('meridian os  —  build 2026.1');
          print('user        '+session.username);
          print('uptime      '+formatUptime());
          print('storage     '+Math.round(OS.Storage.byteSize()/1024)+' KB used (this device)');
          break;
        case 'ls':
          var node = resolveDir(cwd);
          var kids = OS.FS.sortedChildren(node);
          if(!kids.length) print('(empty)');
          else print(kids.map(function(k){ return k.type==='folder' ? k.name+'/' : k.name; }).join('   '));
          break;
        case 'cd':
          if(!rest || rest === '~' || rest === '/'){ cwd = []; break; }
          if(rest === '..'){ cwd = cwd.slice(0,-1); break; }
          var target = cwd.concat([rest]);
          var tnode = resolveDir(target);
          if(!tnode || tnode.type !== 'folder') print('cd: no such folder: '+rest, 'err');
          else cwd = target;
          break;
        case 'cat':
          if(!rest){ print('usage: cat <file>', 'err'); break; }
          var dir = resolveDir(cwd);
          var file = dir && dir.children.filter(function(c){ return c.name===rest && c.type==='file'; })[0];
          if(!file) print('cat: no such file: '+rest, 'err');
          else print(file.content || '(empty file)');
          break;
        case 'mkdir':
          if(!rest){ print('usage: mkdir <name>', 'err'); break; }
          var r1 = OS.FS.createFolder(userId, cwd, rest);
          print(r1.ok ? 'created '+rest+'/' : r1.error, r1.ok?'ok':'err');
          break;
        case 'touch':
          if(!rest){ print('usage: touch <name>', 'err'); break; }
          var r2 = OS.FS.createFile(userId, cwd, rest, '');
          print(r2.ok ? 'created '+rest : r2.error, r2.ok?'ok':'err');
          break;
        default:
          print(cmd+': command not found (try "help")', 'err');
      }
    }

    function formatUptime(){
      var ms = Date.now() - (global.__meridianBootTime || Date.now());
      var s = Math.floor(ms/1000);
      var m = Math.floor(s/60); s%=60;
      return m+'m '+s+'s';
    }

    print('Meridian OS terminal — type "help" to see available commands.');
    newPromptRow();

    return {};
  }

  OS.Apps.register({
    id:'terminal', name:'Terminal', title:'Terminal', icon:'terminal',
    defaultWidth:560, defaultHeight:400, minWidth:360, minHeight:240,
    build: buildTerminal
  });

})(window);
