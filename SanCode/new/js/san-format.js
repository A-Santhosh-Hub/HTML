/*
 * san-format.js - code formatting + minifying engine.
 * Prettier (standalone) and Terser are vendored in lib/ and loaded lazily on first use.
 */
(function (global) {
  'use strict';

  var PRETTIER = 'lib/prettier/';
  var loading = {};

  function loadScript(src) {
    if (!loading[src]) {
      loading[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function () { delete loading[src]; reject(new Error('Could not load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return loading[src];
  }

  // engine language id -> prettier parser + plugin files
  var PARSERS = {
    js: { parser: 'babel', plugins: ['babel', 'estree'] },
    jsx: { parser: 'babel', plugins: ['babel', 'estree'] },
    ts: { parser: 'typescript', plugins: ['typescript', 'estree'] },
    tsx: { parser: 'typescript', plugins: ['typescript', 'estree'] },
    json: { parser: 'json', plugins: ['babel', 'estree'] },
    css: { parser: 'css', plugins: ['postcss'] },
    html: { parser: 'html', plugins: ['html', 'babel', 'estree', 'postcss'] },
    md: { parser: 'markdown', plugins: ['markdown'] },
    yaml: { parser: 'yaml', plugins: ['yaml'] },
  };

  function langId(lang) {
    return global.SanEditor ? global.SanEditor.resolveLang(lang) : lang;
  }

  function supports(lang) { return !!PARSERS[langId(lang)]; }

  async function prettify(text, lang, opts) {
    var cfg = PARSERS[langId(lang)];
    if (!cfg) throw new Error('No formatter for ' + lang);
    await loadScript(PRETTIER + 'standalone.js');
    await Promise.all(cfg.plugins.map(function (p) { return loadScript(PRETTIER + 'plugins/' + p + '.js'); }));
    var indent = opts && opts.indent;
    return global.prettier.format(text, {
      parser: cfg.parser,
      plugins: cfg.plugins.map(function (p) { return global.prettierPlugins[p]; }),
      useTabs: indent === 'tab',
      tabWidth: indent === 'tab' ? 4 : parseInt(indent, 10) || 4,
      printWidth: 100,
    });
  }

  async function format(text, lang, opts) {
    var id = langId(lang);
    if (id === 'json') {
      // Strict JSON is formatted natively (fast, lossless); JSONC / trailing commas fall back to Prettier
      try {
        var indent = opts && opts.indent === 'tab' ? '\t' : parseInt(opts && opts.indent, 10) || 4;
        return JSON.stringify(JSON.parse(text), null, indent);
      } catch (e) {
        return prettify(text, 'json', opts);
      }
    }
    return prettify(text, lang, opts);
  }

  function minifyCss(text) {
    return text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}:;,>~+])\s*/g, '$1')
      .replace(/;}/g, '}')
      .trim();
  }

  function minifyHtml(text) {
    return text
      .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  async function minify(text, lang) {
    var id = langId(lang);
    if (id === 'json') return JSON.stringify(JSON.parse(text));
    if (id === 'css') return minifyCss(text);
    if (id === 'html') return minifyHtml(text);
    if (id === 'js') {
      await loadScript('lib/terser.min.js');
      var res = await global.SanTerser.minify(text, { compress: true, mangle: true, module: false });
      if (!res || typeof res.code !== 'string') throw new Error('Minify failed');
      return res.code;
    }
    throw new Error('Minify is not available for this language');
  }

  global.SanFormat = { format: format, minify: minify, supports: supports };
})(window);
