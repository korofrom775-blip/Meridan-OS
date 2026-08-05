/* =================================================================
   MERIDIAN OS — Image Viewer
   Lightweight viewer for pictures saved from Paint or dropped into
   the virtual file system. Supports zoom and "Edit in Paint".
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var svg = OS.Icons.svg, esc = OS.Util.escapeHtml;

  function buildImageViewer(ctx){
    var state = { path:(ctx.data && ctx.data.path)||[], name:(ctx.data && ctx.data.name)||'', content:(ctx.data && ctx.data.content)||'', zoom:1 };

    ctx.bodyEl.innerHTML =
      '<div class="iv-shell">'+
        '<div class="app-toolbar">'+
          '<button data-act="zoomout" title="Zoom out">−</button>'+
          '<span id="iv-zoom" class="iv-zoom-lbl">100%</span>'+
          '<button data-act="zoomin" title="Zoom in">+</button>'+
          '<button data-act="reset" title="Reset zoom">'+svg('refresh')+'</button>'+
          '<span class="pt-sep"></span>'+
          '<button data-act="edit" title="Edit in Paint">'+svg('edit')+'</button>'+
          '<button data-act="download" title="Download">'+svg('download')+'</button>'+
        '</div>'+
        '<div class="iv-view" id="iv-view"><img id="iv-img" alt=""></div>'+
      '</div>';

    var img = ctx.bodyEl.querySelector('#iv-img');
    var zoomLbl = ctx.bodyEl.querySelector('#iv-zoom');

    function render(){
      img.src = state.content;
      img.style.transform = 'scale(' + state.zoom + ')';
      zoomLbl.textContent = Math.round(state.zoom*100) + '%';
      ctx.setTitle((state.name || 'Image Viewer'));
    }
    render();

    ctx.bodyEl.querySelector('.app-toolbar').addEventListener('click', function(e){
      var btn = e.target.closest('button'); if(!btn) return;
      var act = btn.getAttribute('data-act');
      if(act === 'zoomin') state.zoom = Math.min(4, state.zoom + 0.25);
      else if(act === 'zoomout') state.zoom = Math.max(0.25, state.zoom - 0.25);
      else if(act === 'reset') state.zoom = 1;
      else if(act === 'edit') OS.WM.openWindow('paint', { path: state.path, name: state.name, content: state.content });
      else if(act === 'download'){
        var a = document.createElement('a');
        a.href = state.content; a.download = state.name || 'image.png';
        document.body.appendChild(a); a.click(); a.remove();
        return;
      }
      render();
    });

    return {
      onReopen: function(data){
        if(!data) return;
        state.path = data.path||[]; state.name = data.name||''; state.content = data.content||''; state.zoom = 1;
        render();
      }
    };
  }

  OS.Apps.register({
    id:'imageviewer', name:'Image Viewer', title:'Image Viewer', icon:'image', hidden:true,
    defaultWidth:640, defaultHeight:500, minWidth:320, minHeight:280,
    build: buildImageViewer
  });

})(window);
