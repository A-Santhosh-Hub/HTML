/*
 * preview-engine.js - turns editor text + a workspace file map into a self-contained HTML document.
 *
 *  - rewrites relative assets in HTML / CSS (url(), @import) / ES module imports to blob: (or data:) URLs
 *  - renders Markdown and SVG, shows anything else as escaped text
 *  - injects a bootstrap that forwards console output + errors, shims storage and fetch(), and
 *    turns relative <a href> clicks into messages so multi-page sites can be browsed
 *
 * Used by preview/frame.js (blob mode, isolated origin) and by the app for the full-screen preview (inline mode).
 */
(function (global) {
  'use strict';

  var ABSOLUTE = /^(?:[a-z][a-z0-9+.\-]*:|\/\/|#)/i;
  var MIME = {
    css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', html: 'text/html', htm: 'text/html',
    json: 'application/json', svg: 'image/svg+xml', txt: 'text/plain', xml: 'application/xml',
  };
  var MEDIA_EXT = { png: 1, jpg: 1, jpeg: 1, gif: 1, webp: 1, bmp: 1, ico: 1, avif: 1, mp4: 1, webm: 1, mp3: 1, wav: 1, ogg: 1 };
  var INLINE_LIMIT = 4 * 1024 * 1024;
  var MAX_MAP_ENTRIES = 3000;

  function extOf(p) {
    var m = /\.([a-z0-9]+)$/i.exec(p || '');
    return m ? m[1].toLowerCase() : '';
  }
  function dirname(p) {
    var i = (p || '').lastIndexOf('/');
    return i < 0 ? '' : p.slice(0, i);
  }
  function joinPath(dir, rel) {
    var parts = dir ? dir.split('/') : [];
    rel.split('/').forEach(function (seg) {
      if (seg === '' || seg === '.') return;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    });
    return parts.join('/');
  }
  function splitSuffix(u) {
    var m = /^([^?#]*)([?#][\s\S]*)?$/.exec(u);
    return [m[1], m[2] || ''];
  }
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + ':' + s.length;
  }
  function escapeText(s) {
    return String(s).replace(/[&<>]/g, function (c) { return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'; });
  }
  async function replaceAsync(str, re, fn) {
    var matches = Array.from(str.matchAll(re));
    if (!matches.length) return str;
    var reps = await Promise.all(matches.map(function (m) { return fn.apply(null, m.concat([m.index])); }));
    var out = '';
    var last = 0;
    matches.forEach(function (m, i) {
      out += str.slice(last, m.index) + reps[i];
      last = m.index + m[0].length;
    });
    return out + str.slice(last);
  }
  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  // Runs INSIDE the previewed page (stringified and injected as the first script)
  function bootstrap(CFG) {
    var host = window.parent;
    function send(msg) { try { host.postMessage(msg, '*'); } catch (e) { /* detached */ } }
    function fmt(v) {
      if (typeof v === 'string') return v;
      if (v instanceof Error) return v.stack || v.message;
      try {
        var seen = [];
        var s = JSON.stringify(v, function (k, x) {
          if (typeof x === 'object' && x !== null) { if (seen.indexOf(x) > -1) return '[Circular]'; seen.push(x); }
          if (typeof x === 'function') return '[Function]';
          return x;
        });
        return s === undefined ? String(v) : s.slice(0, 2000);
      } catch (e) { return String(v); }
    }
    ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
      var orig = console[level];
      console[level] = function () {
        send({ __san: 'console', level: level, args: Array.prototype.map.call(arguments, fmt) });
        if (orig) orig.apply(console, arguments);
      };
    });
    window.addEventListener('error', function (e) {
      var where = e.filename ? ' (' + String(e.filename).split('/').pop() + ':' + e.lineno + ':' + e.colno + ')' : '';
      send({ __san: 'console', level: 'error', args: [(e.message || 'Script error') + where] });
    });
    window.addEventListener('unhandledrejection', function (e) {
      send({ __san: 'console', level: 'error', args: ['Unhandled promise rejection: ' + fmt(e.reason)] });
    });

    // localStorage/sessionStorage can throw in restricted contexts; fall back to an in-memory store
    ['localStorage', 'sessionStorage'].forEach(function (name) {
      try { window[name].getItem('__san'); return; } catch (e) { /* shim below */ }
      var data = {};
      var shim = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
        setItem: function (k, v) { data[k] = String(v); },
        removeItem: function (k) { delete data[k]; },
        clear: function () { data = {}; },
        key: function (i) { return Object.keys(data)[i] || null; },
        get length() { return Object.keys(data).length; },
      };
      try { Object.defineProperty(window, name, { value: shim, configurable: true }); } catch (e) { /* ignore */ }
    });

    // Relative fetch()/XHR against workspace files
    function mapUrl(u) {
      if (typeof u !== 'string' || /^(?:[a-z][a-z0-9+.\-]*:|\/\/)/i.test(u)) return u;
      var parts = u.split(/[?#]/)[0].replace(/^\//, '') ;
      var segs = (u.charAt(0) === '/' ? [] : (CFG.dir ? CFG.dir.split('/') : []));
      parts.split('/').forEach(function (s) { if (s === '..') segs.pop(); else if (s && s !== '.') segs.push(s); });
      var key = segs.join('/');
      return CFG.map[key] || u;
    }
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function (input, init) {
        return origFetch.call(this, typeof input === 'string' ? mapUrl(input) : input, init);
      };
    }
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      var args = Array.prototype.slice.call(arguments);
      args[1] = mapUrl(String(url));
      return origOpen.apply(this, args);
    };

    // Multi-page navigation between workspace files
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.hasAttribute('download') || e.defaultPrevented) return;
      var href = a.getAttribute('href');
      if (!href || /^(?:[a-z][a-z0-9+.\-]*:|\/\/|#)/i.test(href)) return;
      e.preventDefault();
      send({ __san: 'nav', href: href });
    }, true);
  }

  function createEngine(options) {
    var mode = (options && options.mode) || 'blob';
    var inline = mode === 'inline';

    var files = {};            // path -> Blob
    var rawUrls = {};          // path -> original blob: URL (blob mode only)
    var textCache = new WeakMap();
    var processed = {};        // path -> { key, url }
    var created = [];          // blob URLs to revoke

    function revokeAll() {
      created.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
      created = [];
      processed = {};
      rawUrls = {};
    }

    function setFiles(map) {
      revokeAll();
      files = map || {};
      if (!inline) {
        Object.keys(files).slice(0, MAX_MAP_ENTRIES).forEach(function (p) {
          var u = URL.createObjectURL(files[p]);
          rawUrls[p] = u;
          created.push(u);
        });
      }
    }

    function findFile(path) {
      if (files[path]) return path;
      try {
        var dec = decodeURIComponent(path);
        if (files[dec]) return dec;
      } catch (e) { /* malformed URI */ }
      return null;
    }
    function findModule(path) {
      var cands = [path, path + '.js', path + '.mjs', path + '/index.js'];
      for (var i = 0; i < cands.length; i++) { var f = findFile(cands[i]); if (f) return f; }
      return null;
    }

    function resolveRef(fromDir, ref) {
      ref = String(ref || '').trim();
      if (!ref || ABSOLUTE.test(ref)) return null;
      var parts = splitSuffix(ref);
      var path = parts[0].charAt(0) === '/' ? joinPath('', parts[0]) : joinPath(fromDir, parts[0]);
      return { path: path, suffix: parts[1] };
    }

    async function getText(path, overrides) {
      if (overrides && Object.prototype.hasOwnProperty.call(overrides, path)) return overrides[path];
      var blob = files[path];
      if (!blob) return '';
      if (textCache.has(blob)) return textCache.get(blob);
      var t = await blob.text();
      textCache.set(blob, t);
      return t;
    }

    async function makeUrl(content, mime) {
      if (inline) {
        if (typeof content === 'string') return 'data:' + mime + ';charset=utf-8;base64,' + btoa(unescape(encodeURIComponent(content)));
        return blobToDataUrl(content);
      }
      var blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
      var url = URL.createObjectURL(blob);
      created.push(url);
      return url;
    }

    // ---- per-render context ----
    function context(overrides) {
      var inProgress = {};

      async function urlForFile(path, kind) {
        var real = kind === 'module' ? findModule(path) : findFile(path);
        if (!real) return null;
        var ext = extOf(real);
        var isCss = ext === 'css';
        var isJs = ext === 'js' || ext === 'mjs';
        var isHtml = ext === 'html' || ext === 'htm';
        if (!isCss && !isJs && !isHtml) {
          if (inline) {
            if (files[real].size > INLINE_LIMIT) return null;
            return blobToDataUrl(files[real]);
          }
          return rawUrls[real] || null;
        }
        if (inProgress[real]) return inline ? null : rawUrls[real] || null;
        inProgress[real] = true;
        try {
          var text = await getText(real, overrides);
          var out;
          if (isCss) out = await processCss(text, real);
          else if (isJs) out = await processJsImports(text, real);
          else out = await processHtml(text, real);
          if (inline) return makeUrl(out, MIME[ext] || 'text/plain');
          // Keep the URL stable when the processed output did not change (dependencies included)
          var hash = hashStr(out);
          var cached = processed[real];
          if (cached && cached.hash === hash) return cached.url;
          var url = await makeUrl(out, MIME[ext] || 'text/plain');
          if (cached) { try { URL.revokeObjectURL(cached.url); } catch (e) { /* ignore */ } }
          processed[real] = { hash: hash, url: url };
          return url;
        } finally {
          delete inProgress[real];
        }
      }

      async function mapRef(fromDir, ref, kind) {
        var r = resolveRef(fromDir, ref);
        if (!r) return null;
        var url = await urlForFile(r.path, kind);
        return url ? url + (inline ? '' : r.suffix) : null;
      }

      async function processCss(text, path) {
        var dir = dirname(path);
        text = await replaceAsync(text, /url\(\s*(['"]?)([^'")]+?)\1\s*\)/g, async function (all, q, ref) {
          var u = await mapRef(dir, ref);
          return u ? 'url("' + u + '")' : all;
        });
        text = await replaceAsync(text, /@import\s+(['"])([^'"]+)\1/g, async function (all, q, ref) {
          var u = await mapRef(dir, ref);
          return u ? '@import "' + u + '"' : all;
        });
        return text;
      }

      async function processJsImports(text, path) {
        var dir = dirname(path);
        var re = /(\b(?:import|export)\s*(?:[\w*${}\s,]+?\s*from\s*)?|\bimport\s*\(\s*)(['"])(\.{0,2}\/[^'"\n]+)\2/g;
        return replaceAsync(text, re, async function (all, head, q, ref) {
          var u = await mapRef(dir, ref, 'module');
          return u ? head + q + u + q : all;
        });
      }

      async function srcset(dir, value) {
        var items = value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        var out = await Promise.all(items.map(async function (item) {
          var bits = item.split(/\s+/);
          var u = await mapRef(dir, bits[0]);
          if (u) bits[0] = u;
          return bits.join(' ');
        }));
        return out.join(', ');
      }

      async function processHtml(text, path) {
        var dir = dirname(path);
        var doc = new DOMParser().parseFromString(text, 'text/html');

        var attrJobs = [];
        [
          ['link[href]', 'href'], ['script[src]', 'src'], ['img[src]', 'src'], ['video[src]', 'src'],
          ['video[poster]', 'poster'], ['audio[src]', 'src'], ['source[src]', 'src'], ['track[src]', 'src'],
          ['embed[src]', 'src'], ['object[data]', 'data'], ['iframe[src]', 'src'], ['input[src]', 'src'],
          ['image[href]', 'href'], ['use[href]', 'href'],
        ].forEach(function (pair) {
          doc.querySelectorAll(pair[0]).forEach(function (el) {
            attrJobs.push(async function () {
              var kind = el.tagName === 'SCRIPT' && el.getAttribute('type') === 'module' ? 'module' : undefined;
              var u = await mapRef(dir, el.getAttribute(pair[1]), kind);
              if (u) el.setAttribute(pair[1], u);
            });
          });
        });
        doc.querySelectorAll('img[srcset], source[srcset]').forEach(function (el) {
          attrJobs.push(async function () { el.setAttribute('srcset', await srcset(dir, el.getAttribute('srcset'))); });
        });
        doc.querySelectorAll('style').forEach(function (el) {
          attrJobs.push(async function () { el.textContent = await processCss(el.textContent, path); });
        });
        doc.querySelectorAll('[style*="url("]').forEach(function (el) {
          attrJobs.push(async function () { el.setAttribute('style', await processCss(el.getAttribute('style'), path)); });
        });
        doc.querySelectorAll('script[type="module"]:not([src])').forEach(function (el) {
          attrJobs.push(async function () { el.textContent = await processJsImports(el.textContent, path); });
        });
        await Promise.all(attrJobs.map(function (j) { return j(); }));

        // Opaque browser previews cannot read the parent origin's blob URLs.
        // Embed workspace files so relative fetch()/XHR also work in the sandbox.
        var map = {};
        if (!inline) Object.keys(rawUrls).forEach(function (p) { map[p] = rawUrls[p]; });
        else await Promise.all(Object.keys(files).map(async function (p) {
          var file = Object.prototype.hasOwnProperty.call(overrides, p)
            ? new Blob([overrides[p]], { type: MIME[extOf(p)] || 'text/plain' }) : files[p];
          map[p] = await blobToDataUrl(file);
        }));

        // keep the injected JSON from ever closing the <script> element or breaking the string literal
        var BS = String.fromCharCode(92);
        var cfg = JSON.stringify({ dir: dir, map: map })
          .split('<').join(BS + 'u003c')
          .split(String.fromCharCode(0x2028)).join(BS + 'u2028')
          .split(String.fromCharCode(0x2029)).join(BS + 'u2029');
        var script = doc.createElement('script');
        script.textContent = '(' + bootstrap.toString() + ')(' + cfg + ');';
        var head = doc.head || doc.documentElement.insertBefore(doc.createElement('head'), doc.documentElement.firstChild);
        head.insertBefore(script, head.firstChild);

        return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
      }

      return { processHtml: processHtml, mapRef: mapRef };
    }

    // ---- public: render ----
    function kindOf(format, entry) {
      var e = extOf(entry || '');
      if (e === 'html' || e === 'htm') return 'html';
      if (e === 'md' || e === 'markdown') return 'md';
      if (e === 'svg') return 'svg';
      if (MEDIA_EXT[e]) return 'media';
      if (format === 'html') return 'html';
      if (format === 'md') return 'md';
      return 'text';
    }

    var MD_CSS = 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.6;padding:1.25rem;color:#24292f;max-width:860px;margin:0 auto}' +
      'h1,h2{border-bottom:1px solid #eaecef;padding-bottom:.3em}pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto}' +
      'code{background:#1f23280d;padding:.2em .4em;border-radius:6px;font-family:monospace}pre code{background:none;padding:0}' +
      'blockquote{border-left:.25em solid #d0d7de;padding:0 1em;color:#656d76;margin-left:0}a{color:#0969da;text-decoration:none}' +
      'img{max-width:100%}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0d7de;padding:6px 13px}tr:nth-child(2n){background:#f6f8fa}';

    async function render(spec) {
      var overrides = Object.assign({}, spec.overrides || {});
      var entry = spec.entry || '';
      var kind = kindOf(spec.format, entry);
      if (entry && spec.text != null) overrides[entry] = spec.text;
      var text = spec.text == null ? await getText(entry, overrides) : spec.text;
      var ctx = context(overrides);
      var html;

      if (kind === 'html') {
        html = await ctx.processHtml(text, entry || 'index.html');
      } else if (kind === 'md') {
        var body = global.marked ? global.marked.parse(text) : '<pre>' + escapeText(text) + '</pre>';
        html = await ctx.processHtml('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + MD_CSS + '</style></head><body>' + body + '</body></html>', entry || 'index.md');
      } else if (kind === 'svg') {
        html = await ctx.processHtml('<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#fff}svg{max-width:100%;max-height:100%}</style></head><body>' + text + '</body></html>', entry || 'image.svg');
      } else if (kind === 'media') {
        var u = await ctx.mapRef(dirname(entry), entry.split('/').pop());
        var e = extOf(entry);
        var tag = /^(mp4|webm)$/.test(e) ? 'video controls' : /^(mp3|wav|ogg)$/.test(e) ? 'audio controls' : 'img';
        html = '<!DOCTYPE html><meta charset="utf-8"><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#222"><' + tag + ' src="' + (u || '') + '" style="max-width:100%;max-height:100%"></body>';
      } else {
        html = '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#fff;color:#222"><pre style="margin:0;padding:12px;font:13px/1.5 monospace;white-space:pre-wrap;word-break:break-word">' + (text ? escapeText(text) : '<span style="color:#999">Nothing to preview</span>') + '</pre></body>';
      }
      return { html: html, kind: kind };
    }

    function resolveNav(fromEntry, href) {
      var r = resolveRef(dirname(fromEntry || ''), href);
      if (!r) return null;
      var real = findFile(r.path) || findFile(r.path.replace(/\/$/, '') + '/index.html');
      return real ? { path: real, suffix: r.suffix } : null;
    }

    return {
      setFiles: setFiles,
      render: render,
      resolveNav: resolveNav,
      hasFile: function (p) { return !!findFile(p); },
      dispose: revokeAll,
    };
  }

  global.SanPreview = { createEngine: createEngine, extOf: extOf };
})(typeof window !== 'undefined' ? window : globalThis);
