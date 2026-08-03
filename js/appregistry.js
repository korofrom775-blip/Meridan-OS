/* =================================================================
   MERIDIAN OS — App registry
   Each built-in app file calls OS.Apps.register({...}) to add itself.
   Keeping a registry instead of hard wiring avoids load-order coupling
   between the window manager, desktop, taskbar and the apps themselves.
   ================================================================= */
(function(global){
  'use strict';
  var OS = global.OS = global.OS || {};
  var registry = {};
  var order = [];

  function register(def){
    if(!def || !def.id) throw new Error('App definition needs an id');
    registry[def.id] = def;
    if(order.indexOf(def.id) === -1) order.push(def.id);
  }
  function get(id){ return registry[id]; }
  function all(){ return order.map(function(id){ return registry[id]; }); }
  function launchable(){ return all().filter(function(a){ return !a.hidden; }); }

  OS.Apps = { register:register, get:get, all:all, launchable:launchable };

})(window);
