'use strict';
/* =================================================================
   MERIDIAN OS — Proxy server
   Fetches any URL on behalf of the browser app's iframe, strips the
   headers that block embedding (X-Frame-Options / CSP), rewrites
   HTML/CSS so all links and assets keep flowing through this server,
   and injects a tiny shim that keeps the Meridian address bar in
   sync as the user navigates inside a site.

   Usage:
     npm install          (first time only)
     npm start            (or: node proxy.js)

   Then open index.html in your browser.  The browser app will
   automatically connect to http://localhost:3001.
   ================================================================= */

const http    = require('http');
const https   = require('https');
const zlib    = require('zlib');
const express = require('express');

const app  = express();
const PORT = 3001;

/* ---- URL helpers -------------------------------------------------- */
function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'");
}
function resolveUrl(rel, base) {
  if (!rel) return rel;
  try { return new URL(rel, base).href; } catch (e) { return rel; }
}
function isProxyable(u) {
  if (!u || typeof u !== 'string') return false;
  return !/^(data|javascript|blob|mailto|tel):/i.test(u) && u[0] !== '#';
}
function toProxy(target, base) {
  if (!isProxyable(target) || target.startsWith('/proxy?url=')) return target;
  const abs = resolveUrl(target, base);
  return abs ? '/proxy?url=' + encodeURIComponent(abs) : target;
}

/* ---- HTML rewriter ------------------------------------------------ */
// Injected into every HTML page so navigation inside the site keeps
// the Meridian address bar correct and API calls flow through the proxy.
const navShim = `<script data-meridian-proxy="1">
(function(){
  var P='/proxy?url=';
  function px(u,base){
    if(!u||typeof u!=='string'||u.indexOf(P)===0
       ||/^(data|javascript|blob|#|mailto|tel):/.test(u)) return u;
    try{ return P+encodeURIComponent(new URL(u,base||BASE).href); }catch(e){ return u; }
  }
  function realUrl(){
    var m=location.href.match(/[?&]url=([^&]*)/);
    return m ? decodeURIComponent(m[1]) : BASE;
  }
  function notify(){ try{ parent.postMessage({type:'meridian-nav',url:realUrl()},'*'); }catch(e){} }
  notify();
  ['pushState','replaceState'].forEach(function(fn){
    var orig=history[fn];
    history[fn]=function(){ orig.apply(this,arguments); notify(); };
  });
  window.addEventListener('popstate', notify);
  var _fetch=window.fetch;
  if(_fetch) window.fetch=function(r,o){
    if(typeof r==='string') r=px(r);
    else if(r&&typeof r==='object'&&r.url) r=new Request(px(r.url),r);
    return _fetch.call(this,r,o);
  };
  var _open=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    if(u) arguments[1]=px(String(u));
    return _open.apply(this,arguments);
  };
})();
</script>`;

function rewriteHtml(html, base) {
  // Attribute URLs (src href action data-src poster)
  html = html.replace(
    /\b(src|href|action|data-src|poster|data-href)\s*=\s*(["'])(.*?)\2/gi,
    function(m, attr, q, val) {
      val = val.trim();
      val = decodeEntities(val);
      if (!isProxyable(val) || val.startsWith('/proxy?url=')) return m;
      return attr + '=' + q + toProxy(val, base) + q;
    }
  );

  // srcset
  html = html.replace(/\bsrcset\s*=\s*(["'])(.*?)\1/gi, function(m, q, srcset) {
    var out = srcset.split(',').map(function(part) {
      var t = part.trim(), sp = t.search(/\s/);
      if (sp === -1) return isProxyable(t) ? toProxy(t, base) : t;
      var u = t.slice(0, sp), rest = t.slice(sp);
      return (isProxyable(u) ? toProxy(u, base) : u) + rest;
    }).join(', ');
    return 'srcset=' + q + out + q;
  });

  // inline style url()
  html = html.replace(/\burl\(\s*(["']?)((?!data:)[^"')]+)\1\s*\)/gi, function(m, q, u) {
    if (!isProxyable(u) || u.startsWith('/proxy?url=')) return m;
    return 'url(' + q + toProxy(u, base) + q + ')';
  });

  // Strip integrity / crossorigin (they fail after rewriting)
  html = html.replace(/\s+integrity\s*=\s*(["']).*?\1/gi, '');
  html = html.replace(/\s+crossorigin(\s*=\s*(["'])[^"']*\2)?(?=[\s>])/gi, '');

  // Stamp BASE into the shim and inject before </head>
  const shim = navShim.replace('BASE', JSON.stringify(base));
  if (html.includes('</head>')) return html.replace('</head>', shim + '</head>');
  if (/<body/i.test(html)) return html.replace(/<body[^>]*>/i, function(t) { return t + shim; });
  return shim + html;
}

/* ---- CSS rewriter ------------------------------------------------- */
function rewriteCss(css, base) {
  return css.replace(/\burl\(\s*(["']?)((?!data:)[^"')]+)\1\s*\)/gi, function(m, q, u) {
    if (!isProxyable(u) || u.startsWith('/proxy?url=')) return m;
    return 'url(' + q + toProxy(u, base) + q + ')';
  });
}

/* ---- Header cleaner ----------------------------------------------- */
const STRIP_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'strict-transport-security',
  'x-content-type-options',
  'x-xss-protection',
  'permissions-policy',
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
]);
function cleanHeaders(src) {
  var out = {};
  Object.keys(src).forEach(function(k) {
    if (!STRIP_HEADERS.has(k.toLowerCase())) out[k] = src[k];
  });
  out['access-control-allow-origin']  = '*';
  out['access-control-allow-methods'] = 'GET,POST,OPTIONS,HEAD,PUT,PATCH,DELETE';
  out['access-control-allow-headers'] = '*';
  return out;
}

/* ---- Upstream fetcher --------------------------------------------- */
function fetchUpstream(targetUrl, method, reqHeaders, body, cb) {
  var parsed;
  try { parsed = new URL(targetUrl); } catch (e) { return cb(new Error('Invalid URL: ' + targetUrl)); }

  var isHttps = parsed.protocol === 'https:';
  var lib = isHttps ? https : http;
  var opts = {
    hostname : parsed.hostname,
    port     : parsed.port || (isHttps ? 443 : 80),
    path     : parsed.pathname + (parsed.search || ''),
    method   : method || 'GET',
    headers  : {
      'Host'                    : parsed.hostname,
      'User-Agent'              : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept'                  : reqHeaders['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language'         : reqHeaders['accept-language'] || 'en-US,en;q=0.5',
      'Accept-Encoding'         : 'gzip, deflate, br',
      'Cache-Control'           : 'max-age=0',
      'Upgrade-Insecure-Requests' : '1',
    },
    timeout: 20000,
  };

  var done = false;
  var req = lib.request(opts, function(res) {
    if (done) return;
    done = true;
    cb(res);
  });
  req.on('error', function(err) {
    if (done) return;
    done = true;
    cb(err);
  });
  req.setTimeout(20000, function() { req.destroy(new Error('Timed out after 20 s')); });
  if (body && body.length) req.write(body);
  req.end();
}

function decompress(stream, enc) {
  try {
    if (enc === 'gzip')    return stream.pipe(zlib.createGunzip());
    if (enc === 'deflate') return stream.pipe(zlib.createInflate());
    if (enc === 'br')      return stream.pipe(zlib.createBrotliDecompress());
  } catch (e) {}
  return stream;
}

/* ---- Error page --------------------------------------------------- */
function errorPage(url, msg) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proxy error</title>'+
    '<style>body{font:14px/1.7 system-ui,sans-serif;padding:40px 32px;background:#111;color:#ccc;max-width:560px}'+
    'h2{color:#ffa857;margin:0 0 12px}code{background:#1e1e1e;padding:2px 6px;border-radius:4px;color:#e8c77d}'+
    'button{margin-top:18px;padding:9px 20px;cursor:pointer;border-radius:8px;border:1px solid #444;background:#222;color:#ccc}</style></head>'+
    '<body><h2>⚠ Could not load this page</h2>'+
    '<p>URL: <code>'+url+'</code></p>'+
    '<p style="color:#888">'+msg+'</p>'+
    '<button onclick="history.back()">← Go back</button></body></html>';
}

/* ---- Express middleware ------------------------------------------- */
// CORS
app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,HEAD,PUT,PATCH,DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Collect request body (needed for POST forms)
app.use(function(req, res, next) {
  var parts = [];
  req.on('data', function(c) { parts.push(c); });
  req.on('end',  function()  { req.rawBody = Buffer.concat(parts); next(); });
});

/* ---- Routes ------------------------------------------------------- */
// Health check — the browser app pings this to see if the proxy is running
app.get('/', function(req, res) {
  res.json({ ok: true, name: 'Meridian Proxy', port: PORT });
});

// Main proxy route
app.all('/proxy', function(req, res) {
  var rawUrl = req.query.url;
  if (!rawUrl) {
    return res.status(400).send('Missing ?url= parameter.\n\nUsage: /proxy?url=https://example.com');
  }

  var target;
  try {
    target = decodeURIComponent(rawUrl);
    new URL(target); // throws if invalid
  } catch (e) {
    return res.status(400).send('Bad URL: ' + rawUrl);
  }

  fetchUpstream(target, req.method, req.headers, req.rawBody, function(upstream) {
    if (res.headersSent) return;

    // Network error
    if (upstream instanceof Error) {
      res.status(502).send(errorPage(target, upstream.message));
      return;
    }

    // Redirect — rewrite Location through proxy
    if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
      var loc = resolveUrl(upstream.headers.location, target);
      var rh  = cleanHeaders(upstream.headers);
      rh['location'] = '/proxy?url=' + encodeURIComponent(loc);
      upstream.resume();
      res.writeHead(upstream.statusCode, rh);
      return res.end();
    }

    var ct     = (upstream.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    var isHtml = ct === 'text/html' || ct === 'application/xhtml+xml';
    var isCss  = ct === 'text/css';
    var rh     = cleanHeaders(upstream.headers);

    // Binary / passthrough
    if (!isHtml && !isCss) {
      res.writeHead(upstream.statusCode, rh);
      return upstream.pipe(res);
    }

    // Buffer, decompress, rewrite, re-send
    var enc = upstream.headers['content-encoding'];
    delete rh['content-encoding'];

    var stream = decompress(upstream, enc);
    var parts  = [];
    stream.on('data',  function(c) { parts.push(c); });
    stream.on('error', function(e) {
      console.error('[proxy] decompress error:', e.message);
      res.status(502).send(errorPage(target, 'Decompress failed: ' + e.message));
    });
    stream.on('end', function() {
      var body;
      try { body = Buffer.concat(parts).toString('utf8'); } catch (e) { body = ''; }

      if (isHtml) body = rewriteHtml(body, target);
      else        body = rewriteCss(body, target);

      rh['content-type']   = upstream.headers['content-type'] || ct;
      rh['content-length'] = String(Buffer.byteLength(body, 'utf8'));
      res.writeHead(upstream.statusCode, rh);
      res.end(body);
    });
  });
});

/* ---- Crash safety net ----------------------------------------------
   A single bad upstream response should never take the whole proxy
   down. Log and keep running instead of exiting. ------------------- */
process.on('uncaughtException', function(err) {
  console.error('[proxy] uncaught exception (kept running):', err.message);
});
process.on('unhandledRejection', function(err) {
  console.error('[proxy] unhandled rejection (kept running):', err);
});

/* ---- Start -------------------------------------------------------- */
app.listen(PORT, function() {
  console.log('\n  ✅  Meridian proxy is running\n');
  console.log('  http://localhost:' + PORT + '\n');
  console.log('  Test: http://localhost:' + PORT + '/proxy?url=https://example.com\n');
});
