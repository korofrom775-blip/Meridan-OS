/* =================================================================
   MERIDIAN OS — Boot sequence & top-level wiring
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  global.__meridianBootTime = Date.now();

  var idleTimer = null;

  function enterDesktop(userId){
    var settings = OS.Storage.getUserSettings(userId);
    OS.Theme.apply(settings);
    document.getElementById('desktop').classList.remove('u-hidden');
    OS.Desktop.render(userId);
    OS.Shell.init(userId);
    OS.UI.loadNotifications(userId);
    armIdleTimer(settings.lockTimeoutMin);
    var account = OS.Auth.currentUser();
    OS.UI.toast({ title:'Welcome back, '+account.displayName, icon:'sparkle' });
  }

  function leaveDesktop(){
    OS.WM.closeAll();
    OS.Shell.teardown();
    document.getElementById('desktop').classList.add('u-hidden');
    document.getElementById('taskbar').classList.add('u-hidden');
    disarmIdleTimer();
  }

  /* ---------------- idle auto-lock ---------------- */
  function armIdleTimer(minutes){
    disarmIdleTimer();
    if(!minutes) return;
    var ms = minutes*60*1000;
    function reset(){
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function(){ OS.Auth.lock(); }, ms);
    }
    idleResetFn = reset;
    ['mousemove','keydown','mousedown','touchstart'].forEach(function(evt){
      document.addEventListener(evt, idleResetFn, { passive:true });
    });
    reset();
  }
  var idleResetFn = null;
  function disarmIdleTimer(){
    clearTimeout(idleTimer);
    if(idleResetFn){
      ['mousemove','keydown','mousedown','touchstart'].forEach(function(evt){
        document.removeEventListener(evt, idleResetFn, { passive:true });
      });
      idleResetFn = null;
    }
  }

  /* ---------------- boot screen ---------------- */
  function runBoot(){
    var boot = document.getElementById('boot-screen');
    var MIN_BOOT_MS = 900;
    var started = Date.now();
    function finish(){
      var elapsed = Date.now()-started;
      var wait = Math.max(0, MIN_BOOT_MS-elapsed);
      setTimeout(function(){
        boot.style.transition = 'opacity 280ms ease-out';
        boot.style.opacity = '0';
        setTimeout(function(){
          boot.remove();
          if(OS.Auth.resumeSession()){
            /* resumed: meridian:login already fired, jump straight in */
          } else {
            OS.Auth.showLoginScreen();
          }
        }, 280);
      }, wait);
    }
    finish();
  }

  /* ---------------- global event wiring ---------------- */
  document.addEventListener('meridian:enter-desktop', function(e){ enterDesktop(e.detail.userId); });
  document.addEventListener('meridian:login', function(e){
    if(e.detail && e.detail.resumed) enterDesktop(e.detail.userId);
  });
  document.addEventListener('meridian:logout', function(){ leaveDesktop(); });
  document.addEventListener('meridian:lock', function(){ disarmIdleTimer(); });
  document.addEventListener('meridian:unlock', function(){
    var session = OS.Auth.currentUser();
    if(session) armIdleTimer(OS.Storage.getUserSettings(session.id).lockTimeoutMin);
  });
  document.addEventListener('meridian:idle-timeout-changed', function(){
    var session = OS.Auth.currentUser();
    if(session) armIdleTimer(OS.Storage.getUserSettings(session.id).lockTimeoutMin);
  });

  /* close transient UI on Escape; basic accessibility nicety */
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      OS.UI.closeContextMenu();
    }
  });

  function init(){
    OS.WM.init();
    runBoot();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
