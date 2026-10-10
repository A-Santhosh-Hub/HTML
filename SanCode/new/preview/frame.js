/*
 * Preview frame. On Android it is served from its own origin (preview.sancode.invalid), so previewed code
 * cannot touch the editor's storage or the native bridge. Protocol with the app (postMessage):
 *   app -> frame : set-files {files}, render {format,text,entry,overrides,reset}, back
 *   frame -> app : frame-ready, entry {path,canBack}, console {level,args}
 */
(function () {
  'use strict';

  var out = document.getElementById('out');
  // Data URLs keep workspace CSS, scripts and module imports readable in the opaque sandbox.
  var engine = SanPreview.createEngine({ mode: 'inline' });
  var history = [];
  var currentUrl = null;
  var last = null;

  function post(msg) { parent.postMessage(msg, '*'); }

  async function show(spec, hash) {
    last = spec;
    var result;
    try {
      result = await engine.render(spec);
    } catch (e) {
      post({ __san: 'console', level: 'error', args: ['Preview failed: ' + (e && e.message ? e.message : e)] });
      return;
    }
    var url = URL.createObjectURL(new Blob([result.html], { type: 'text/html' }));
    var previous = currentUrl;
    currentUrl = url;
    out.onload = function () {
      if (previous) { try { URL.revokeObjectURL(previous); } catch (e) { /* ignore */ } }
    };
    out.src = url + (hash || '');
    post({ __san: 'entry', path: spec.entry || '', canBack: history.length > 0 });
  }

  function navigate(href) {
    if (!last) return;
    var target = engine.resolveNav(last.entry, href);
    if (!target) {
      post({ __san: 'console', level: 'warn', args: ['Preview: "' + href + '" was not found in the workspace'] });
      return;
    }
    history.push(last);
    show({
      format: '',
      entry: target.path,
      text: null,
      overrides: last.overrides,
    }, target.suffix.charAt(0) === '#' ? target.suffix : '');
  }

  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || typeof m !== 'object' || !m.__san) return;

    if (e.source === parent) {
      if (m.__san === 'set-files') {
        engine.setFiles(m.files || {});
      } else if (m.__san === 'render') {
        if (m.reset) history = [];
        show({ format: m.format, text: m.text, entry: m.entry, overrides: m.overrides || {} });
      } else if (m.__san === 'back') {
        var prev = history.pop();
        if (prev) show(prev);
      }
    } else if (e.source === out.contentWindow) {
      if (m.__san === 'nav') navigate(String(m.href || ''));
      else if (m.__san === 'console') post(m);
    }
  });

  post({ __san: 'frame-ready' });
})();
