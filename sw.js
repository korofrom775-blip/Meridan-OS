/* =================================================================
   MERIDIAN OS — Shell service worker
   Caches the OS shell's own static assets (HTML/CSS/JS) so the
   desktop boots instantly on repeat visits and keeps working if the
   network briefly drops. It never touches proxied browsing traffic —
   requests to the local proxy (a different origin/port) or to any
   other origin are always left alone and go straight to the network.
   ================================================================= */
'use strict';

var CACHE_VERSION = 'meridian-shell-v1';

var SHELL_ASSETS = [
  './',
  './index.html',
  './css/base.css',
  './css/shell.css',
  './css/windows.css',
  './css/apps.css',
  './css/browser.css',
  './js/storage.js',
  './js/ui.js',
  './js/auth.js',
  './js/windowmanager.js',
  './js/appregistry.js',
  './js/apps/explorer.js',
  './js/apps/simpleapps.js',
  './js/apps/terminal.js',
  './js/apps/settingsapp.js',
  './js/apps/browser.js',
  './js/apps/tasks.js',
  './js/apps/imageviewer.js',
  './js/apps/paint.js',
  './js/desktop.js',
  './js/shellui.js',
  './js/main.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      // addAll fails the whole install if any single asset 404s, so fetch
      // them individually and just skip whichever ones are missing —
      // a stale/missing icon shouldn't block the shell from installing.
      return Promise.all(SHELL_ASSETS.map(function(url) {
        return cache.add(url).catch(function(err) {
          console.warn('[sw] could not precache', url, err.message);
        });
      }));
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_VERSION; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

function isShellRequest(url) {
  // Same-origin only, and never the proxy route (proxy lives on its own
  // port/origin anyway, but this guards against future same-origin proxying).
  return url.origin === self.location.origin && url.pathname.indexOf('/proxy') !== 0;
}

self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (!isShellRequest(url)) return; // let all other-origin / proxied traffic pass straight through

  // Stale-while-revalidate: serve the cached shell asset immediately for
  // speed, then quietly refresh the cache from the network in the
  // background so the next load picks up any changes.
  event.respondWith(
    caches.match(req).then(function(cached) {
      var network = fetch(req).then(function(res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function(cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function() { return cached; });
      return cached || network;
    })
  );
});
