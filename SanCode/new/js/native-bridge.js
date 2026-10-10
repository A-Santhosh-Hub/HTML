/*
 * native-bridge.js - promise API over the Android WebMessage channel (see NativeBridge.java).
 * Outside the Android app SanNativeChannel does not exist and `SanNative.available` is false, so every
 * feature falls back to normal browser behaviour.
 */
(function (global) {
  'use strict';

  var channel = global.SanNativeChannel;
  var pending = {};
  var seq = 0;

  if (channel) {
    channel.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      var p = pending[msg.id];
      if (!p) return;
      delete pending[msg.id];
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error || 'Native error'));
    };
  }

  function call(method, args, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!channel) { reject(new Error('Native bridge unavailable')); return; }
      var id = 'm' + (++seq) + '_' + Date.now().toString(36);
      var entry = { resolve: resolve, reject: reject, timer: null };
      if (timeoutMs !== 0) {
        entry.timer = setTimeout(function () {
          delete pending[id];
          reject(new Error('Native call timed out: ' + method));
        }, timeoutMs || 120000);
      }
      pending[id] = entry;
      channel.postMessage(JSON.stringify({ id: id, method: method, args: args || {} }));
    });
  }

  function fire(method, args) {
    if (channel) channel.postMessage(JSON.stringify({ id: '', method: method, args: args || {} }));
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  var SanNative = {
    available: !!channel,
    call: call,
    fetchWebText: function (url) { return call('fetchWebText', { url: url }, 90000); },
    downloadWebAsset: function (url, name, referer) {
      return call('downloadWebAsset', { url: url, name: name || 'asset', referer: referer || '' });
    },

    toast: function (message) { fire('toast', { message: String(message) }); },
    openPreview: function (html) { fire('preview', { html: String(html) }); },
    openExternal: function (url) { fire('openExternal', { url: String(url) }); },
    mediaState: function (playing, video) { fire('mediaState', { playing: !!playing, video: !!video }); },

    downloadBase64: function (data, name, mime) {
      return call('download', { data: data, name: name || 'download', mime: mime || '' });
    },
    downloadText: function (text, name, mime) {
      return call('downloadText', { text: text, name: name || 'download.txt', mime: mime || 'text/plain' });
    },
    downloadBlob: function (blob, name) {
      return blobToDataUrl(blob).then(function (dataUrl) {
        return call('download', { data: dataUrl, name: name || 'download', mime: blob.type || '' });
      });
    },
    downloadBlobUrl: function (url, name) {
      return fetch(url).then(function (r) { return r.blob(); }).then(function (b) { return SanNative.downloadBlob(b, name || 'download'); })
        .catch(function (e) { SanNative.toast('Download error: ' + e); });
    },

    alarmSync: function (alarms) { return call('alarmSync', { alarms: alarms }); },
    alarmStatus: function () { return call('alarmStatus', {}); },
    alarmTakeFired: function () { return call('alarmTakeFired', {}).then(function (r) { return r.ids || []; }); },
    requestNotifications: function () { return call('notificationPermission', {}, 0); },
    openExactAlarmSettings: function () { return call('openExactAlarmSettings', {}); },
    openBatterySettings: function () { return call('openBatterySettings', {}); },
    openNotificationSettings: function () { return call('openNotificationSettings', {}); },

    legacyData: function () { return call('legacyData', {}, 20000).then(function (r) { return r.data; }); },
    legacyDone: function () { return call('legacyDone', {}); },

    pickFolder: function () { return call('pickFolder', {}, 0); },
    restoreFolder: function () { return call('restoreFolder', {}); },
    scanFolder: function (treeUri) { return call('scanFolder', { treeUri: treeUri }); },
    readText: function (uri) { return call('readText', { uri: uri }).then(function (r) { return r.text; }); },
    readBase64: function (uri) { return call('readBase64', { uri: uri }).then(function (r) { return r.data; }); },
    writeText: function (uri, text) { return call('writeText', { uri: uri, text: text }); },
    createFile: function (parentUri, name) { return call('createFile', { parentUri: parentUri, name: name }); },
    createDir: function (parentUri, name) { return call('createDir', { parentUri: parentUri, name: name }); },
    rename: function (uri, name) { return call('rename', { uri: uri, name: name }); },
    remove: function (uri) { return call('delete', { uri: uri }); },
  };
  global.SanNative = SanNative;

  if (!SanNative.available) return;

  // window.open(): about:blank + document.write -> native preview dialog; blob -> preview; http(s) -> system browser
  var originalOpen = global.open;
  global.open = function (url, target, features) {
    if (!url || url === '' || url === 'about:blank') {
      var captured = '';
      return {
        document: {
          write: function (h) { captured += h; },
          writeln: function (h) { captured += h + '\n'; },
          close: function () { SanNative.openPreview(captured); },
        },
        close: function () {},
        focus: function () {},
      };
    }
    if (String(url).indexOf('blob:') === 0) {
      fetch(url).then(function (r) { return r.text(); }).then(function (html) { SanNative.openPreview(html); })
        .catch(function () { SanNative.toast('Could not open preview'); });
      return null;
    }
    if (/^(?:https?:|mailto:|tel:)/i.test(String(url))) {
      SanNative.openExternal(url);
      return null;
    }
    return originalOpen.call(global, url, target, features);
  };

  // <a download href="blob:|data:"> -> save to Downloads (keeps the file name, unlike WebView's DownloadListener)
  function handleDownloadAnchor(a) {
    if (!a || !a.hasAttribute('download')) return false;
    var href = a.href || '';
    var name = (a.getAttribute('download') || '').trim() || 'download';
    if (href.indexOf('blob:') === 0) {
      SanNative.downloadBlobUrl(href, name);
      return true;
    }
    if (href.indexOf('data:') === 0) {
      SanNative.downloadBase64(href, name, '').catch(function (err) { SanNative.toast('Download failed: ' + err.message); });
      return true;
    }
    return false;
  }

  document.addEventListener('click', function (e) {
    var node = e.target;
    while (node && node.tagName !== 'A') node = node.parentElement;
    if (handleDownloadAnchor(node)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Programmatic a.click() on detached anchors never reaches the document listener above
  var originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (handleDownloadAnchor(this)) return;
    return originalAnchorClick.apply(this, arguments);
  };
})(window);
