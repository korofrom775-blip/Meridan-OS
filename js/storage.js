/* =================================================================
   MERIDIAN OS — Storage layer
   All persistence goes through this module so the schema lives in
   one place. Keys are namespaced under "meridian." to avoid clashing
   with anything else that might share localStorage.
   ================================================================= */
(function(global){
  'use strict';

  var PREFIX = 'meridian.';
  var available = true;
  try{
    var t = '__meridian_probe__';
    window.localStorage.setItem(t,'1');
    window.localStorage.removeItem(t);
  }catch(e){ available = false; }

  function read(key, fallback){
    if(!available) return fallback;
    try{
      var raw = window.localStorage.getItem(PREFIX + key);
      if(raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    }catch(e){ return fallback; }
  }
  function write(key, value){
    if(!available) return false;
    try{
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    }catch(e){ return false; }
  }
  function remove(key){
    if(!available) return;
    try{ window.localStorage.removeItem(PREFIX + key); }catch(e){}
  }
  function allKeys(){
    if(!available) return [];
    var out = [];
    for(var i=0;i<window.localStorage.length;i++){
      var k = window.localStorage.key(i);
      if(k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
    }
    return out;
  }
  function byteSize(){
    if(!available) return 0;
    var n = 0;
    allKeys().forEach(function(k){
      var raw = window.localStorage.getItem(PREFIX + k);
      if(raw) n += raw.length;
    });
    return n;
  }

  function uid(prefix){
    return (prefix||'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }

  /* ---- per-user key helper ---- */
  function userKey(userId, name){ return 'user.' + userId + '.' + name; }

  /* ---- default data factories ---- */
  function defaultSettings(){
    return {
      accent:'copper',
      mode:'dark',
      wallpaper:'dusk',
      wallpaperCustom:'',
      animations:true,
      sound:true,
      timeFormat:'24',
      taskbarPosition:'bottom',
      taskbarAutohide:false,
      iconSize:'medium',
      lockTimeoutMin:0,
      dndNotifications:false
    };
  }
  function defaultDesktop(){
    return { icons:[
      { id:'browser',  x:24, y:24 },
      { id:'explorer', x:24, y:130 },
      { id:'notepad',  x:24, y:236 },
      { id:'terminal', x:24, y:342 },
      { id:'settings', x:24, y:448 }
    ], pinned:['browser','explorer','settings'] };
  }
  function defaultFS(){
    return {
      name:'/', type:'folder', children:[
        { name:'Documents', type:'folder', children:[
          { name:'Welcome.txt', type:'file', content:'Welcome to Meridian OS.\n\nThis is a virtual file system, stored entirely in your browser.\nCreate folders and text files, open them from the File Explorer,\nand they will still be here next time you sign in.' }
        ]},
        { name:'Pictures', type:'folder', children:[] },
        { name:'Downloads', type:'folder', children:[], virtual:'downloads' }
      ]
    };
  }
  function defaultBrowserSettings(){
    return { searchEngine:'duckduckgo', homepage:'meridian://home', clearHistoryOnExit:false };
  }

  function seedUserData(userId){
    write(userKey(userId,'settings'), defaultSettings());
    write(userKey(userId,'desktop'), defaultDesktop());
    write(userKey(userId,'fs'), defaultFS());
    write(userKey(userId,'bookmarks'), []);
    write(userKey(userId,'history'), []);
    write(userKey(userId,'downloads'), []);
    write(userKey(userId,'browserSettings'), defaultBrowserSettings());
    write(userKey(userId,'notifications'), []);
    write(userKey(userId,'customApps'), []);
  }

  global.OS = global.OS || {};
  global.OS.Storage = {
    read: read,
    write: write,
    remove: remove,
    allKeys: allKeys,
    byteSize: byteSize,
    available: available,
    uid: uid,
    userKey: userKey,
    defaults:{
      settings: defaultSettings,
      desktop: defaultDesktop,
      fs: defaultFS,
      browserSettings: defaultBrowserSettings
    },
    seedUserData: seedUserData,

    /* convenience accessors used throughout the app */
    getAccounts: function(){ return read('accounts', []); },
    setAccounts: function(list){ return write('accounts', list); },
    getSession: function(){ return read('session', null); },
    setSession: function(s){ return write('session', s); },
    clearSession: function(){ remove('session'); },
    getLastUser: function(){ return read('lastUser', ''); },
    setLastUser: function(name){ return write('lastUser', name); },

    getUserSettings: function(userId){ return read(userKey(userId,'settings'), defaultSettings()); },
    setUserSettings: function(userId, val){ return write(userKey(userId,'settings'), val); },
    getUserDesktop: function(userId){ return read(userKey(userId,'desktop'), defaultDesktop()); },
    setUserDesktop: function(userId, val){ return write(userKey(userId,'desktop'), val); },
    getUserFS: function(userId){ return read(userKey(userId,'fs'), defaultFS()); },
    setUserFS: function(userId, val){ return write(userKey(userId,'fs'), val); },
    getBookmarks: function(userId){ return read(userKey(userId,'bookmarks'), []); },
    setBookmarks: function(userId, val){ return write(userKey(userId,'bookmarks'), val); },
    getHistory: function(userId){ return read(userKey(userId,'history'), []); },
    setHistory: function(userId, val){ return write(userKey(userId,'history'), val); },
    getDownloads: function(userId){ return read(userKey(userId,'downloads'), []); },
    setDownloads: function(userId, val){ return write(userKey(userId,'downloads'), val); },
    getBrowserSettings: function(userId){ return read(userKey(userId,'browserSettings'), defaultBrowserSettings()); },
    setBrowserSettings: function(userId, val){ return write(userKey(userId,'browserSettings'), val); },
    getNotifications: function(userId){ return read(userKey(userId,'notifications'), []); },
    setNotifications: function(userId, val){ return write(userKey(userId,'notifications'), val); },
    getCustomApps: function(userId){ return read(userKey(userId,'customApps'), []); },
    setCustomApps: function(userId, val){ return write(userKey(userId,'customApps'), val); },

    wipeUserData: function(userId){
      ['settings','desktop','fs','bookmarks','history','downloads','browserSettings','notifications','customApps'].forEach(function(n){
        remove(userKey(userId,n));
      });
    },
    wipeAll: function(){
      allKeys().forEach(function(k){ remove(k); });
    }
  };

})(window);
