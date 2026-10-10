/*
 * mini-player.js - the persistent mini media player.
 *
 * The player element (#mini-player) is never moved or removed, so playback is never interrupted. It is laid out as
 *   docked  : exactly over #player-slot while the Media tool is on screen,
 *   float   : a small draggable video window over the whole app when you switch tools,
 *   pill    : a one-line bar (audio tracks, or a minimised video),
 *   pip     : fills the window while Android Picture-in-Picture is active (see MainActivity).
 * Playback itself is still driven by playVideo() / videoQueue / ytPlayer in app.js; this file only controls and shows it.
 */
(function () {
    'use strict';

    var PREF_KEY = 'sancode.miniPlayer';
    var SIZES = { s: 200, m: 264, l: 340 };
    var BAR_H = 34;
    var PROG_H = 8;

    function $(id) { return document.getElementById(id); }

    var prefs = { size: 'm', collapsed: false, r: null, b: null };
    try {
        var saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
        if (saved && typeof saved === 'object') {
            if (SIZES[saved.size]) prefs.size = saved.size;
            prefs.collapsed = !!saved.collapsed;
            if (typeof saved.r === 'number' && typeof saved.b === 'number') { prefs.r = saved.r; prefs.b = saved.b; }
        }
    } catch (e) { /* storage unavailable: defaults */ }
    function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ } }

    var el, slot, video, bar;
    var pipActive = false;
    var raf = 0;
    var ticker = 0;
    var lastApplied = '';
    var lastNative = '';
    var lastTitle = null;
    var sessionReady = false;

    // ---------------------------------------------------------------- what is playing

    function queueLength() { return typeof videoQueue !== 'undefined' ? videoQueue.length : 0; }
    function currentIndex() { return typeof currentVideoIndex !== 'undefined' ? currentVideoIndex : -1; }
    function current() {
        var i = currentIndex();
        return i >= 0 && i < queueLength() ? videoQueue[i] : null;
    }
    function isYT(c) { return !!c && c.type === 'youtube'; }
    function isVideoItem(c) { return !!c && !c.isAudio; }
    function ytReady() { return typeof ytPlayer !== 'undefined' && ytPlayer && typeof ytPlayer.getPlayerState === 'function'; }

    function isPlaying() {
        var c = current();
        if (!c) return false;
        if (isYT(c)) {
            if (!ytReady()) return false;
            var st = ytPlayer.getPlayerState();
            return st === 1 || st === 3;
        }
        return !!video && !video.paused && !video.ended;
    }

    function timing() {
        var c = current();
        try {
            if (isYT(c)) {
                if (!ytReady() || typeof ytPlayer.getDuration !== 'function') return { t: 0, d: 0 };
                return { t: ytPlayer.getCurrentTime() || 0, d: ytPlayer.getDuration() || 0 };
            }
            if (video && isFinite(video.duration)) return { t: video.currentTime || 0, d: video.duration || 0 };
        } catch (e) { /* player not ready */ }
        return { t: 0, d: 0 };
    }

    // ---------------------------------------------------------------- controls

    function toggle() {
        var c = current();
        if (!c) return;
        if (isYT(c)) {
            if (!ytReady()) return;
            if (isPlaying()) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
        } else if (video) {
            if (video.paused) video.play().catch(function () { /* needs a gesture: the user just tapped */ }); else video.pause();
        }
        setTimeout(update, 60);
    }

    function next() {
        if (currentIndex() + 1 < queueLength()) playVideo(currentIndex() + 1);
    }

    function prev() {
        var c = current();
        if (!c) return;
        var t = timing().t;
        if (t > 3 || currentIndex() <= 0) { seek(0); return; }
        playVideo(currentIndex() - 1);
    }

    function stop() {
        if (video) video.pause();
        if (typeof playVideo === 'function') playVideo(-1);
        update();
    }

    function seek(frac) {
        var c = current();
        var d = timing().d;
        if (!c || !d) return;
        frac = Math.max(0, Math.min(1, frac));
        try {
            if (isYT(c)) ytPlayer.seekTo(frac * d, true);
            else video.currentTime = frac * d;
        } catch (e) { /* ignore */ }
        setTimeout(update, 60);
    }

    function openTool() {
        if (typeof switchSidebarTab === 'function') switchSidebarTab('video');
        if (typeof isMobile === 'function' && isMobile() && typeof openMobileSidebar === 'function') openMobileSidebar();
        else if (typeof state !== 'undefined' && !state.sidebarVisible && typeof toggleSidebar === 'function') toggleSidebar();
        setTimeout(layout, 50);
    }

    // ---------------------------------------------------------------- layout

    /** Rectangle of the empty box in the Media tool when that box is actually on screen, otherwise null. */
    function slotRect() {
        if (!slot || !slot.getClientRects().length) return null;
        var r = slot.getBoundingClientRect();
        if (r.width < 20 || r.right < 8 || r.left > window.innerWidth - 8 || r.bottom < 0 || r.top > window.innerHeight) return null;
        return r;
    }

    function bottomLimit() {
        var limit = window.innerHeight - 4;
        var f = document.querySelector('footer');
        if (f && f.getClientRects().length) limit = Math.min(limit, f.getBoundingClientRect().top - 4);
        var nav = $('mobile-bottom-nav');
        if (nav && nav.getClientRects().length) limit = Math.min(limit, nav.getBoundingClientRect().top - 4);
        return limit;
    }

    function floatGeometry(mode) {
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var w = mode === 'float' ? Math.min(SIZES[prefs.size], vw - 8) : Math.min(300, vw - 8);
        var h = BAR_H + (mode === 'float' ? Math.round(w * 9 / 16) : 0) + PROG_H;
        var limit = bottomLimit();
        var left;
        var top;
        if (prefs.r === null) {
            left = vw - w - 12;
            top = limit - h - 8;
        } else {
            left = vw - prefs.r - w;
            top = vh - prefs.b - h;
        }
        left = Math.max(4, Math.min(left, vw - w - 4));
        top = Math.max(4, Math.min(top, limit - h));
        return { left: Math.round(left), top: Math.round(top), w: Math.round(w), h: h };
    }

    var rafLoop = function () {
        raf = 0;
        if (el && el.classList.contains('mp-docked') && !el.hidden) {
            layout();
            raf = requestAnimationFrame(rafLoop);
        }
    };

    function layout() {
        if (!el) return;
        var c = current();
        var mode;
        var rect = null;
        if (pipActive) {
            mode = 'pip';
        } else {
            rect = slotRect();
            if (rect) mode = 'docked';
            else if (c) mode = (!isVideoItem(c) || prefs.collapsed) ? 'pill' : 'float';
            else mode = 'none';
        }

        var geo = null;
        var key;
        if (mode === 'docked') key = 'd:' + Math.round(rect.left) + ',' + Math.round(rect.top) + ',' + Math.round(rect.width) + ',' + Math.round(rect.height);
        else if (mode === 'float' || mode === 'pill') { geo = floatGeometry(mode); key = mode + ':' + geo.left + ',' + geo.top + ',' + geo.w + ',' + geo.h; }
        else key = mode;
        key += ':' + prefs.size;
        if (key === lastApplied) return;
        lastApplied = key;

        el.hidden = mode === 'none';
        el.classList.toggle('mp-docked', mode === 'docked');
        el.classList.toggle('mp-float', mode === 'float');
        el.classList.toggle('mp-pill', mode === 'pill');
        el.classList.toggle('mp-s', prefs.size === 's' || (window.innerWidth - 8) < SIZES.m);
        document.body.classList.toggle('mp-pip', mode === 'pip');

        if (mode === 'docked') {
            el.style.left = rect.left + 'px';
            el.style.top = rect.top + 'px';
            el.style.width = rect.width + 'px';
            el.style.height = rect.height + 'px';
            if (!raf) raf = requestAnimationFrame(rafLoop);
        } else if (geo) {
            el.style.left = geo.left + 'px';
            el.style.top = geo.top + 'px';
            el.style.width = geo.w + 'px';
            el.style.height = geo.h + 'px';
        } else {
            el.style.left = el.style.top = el.style.width = el.style.height = '';
        }
    }

    // ---------------------------------------------------------------- state -> UI

    function setIcon(btn, cls) {
        var i = btn && btn.firstElementChild;
        if (i) i.className = 'fa-solid ' + cls;
    }

    function update() {
        if (!el) return;
        var c = current();
        var playing = isPlaying();
        var title = c ? c.name : 'Nothing playing';

        el.classList.toggle('mp-playing', playing);
        el.classList.toggle('mp-idle', !c);
        el.classList.toggle('mp-audio', !!c && !isVideoItem(c));
        el.classList.toggle('mp-single', queueLength() <= 1);
        if (title !== lastTitle) { $('mp-title').textContent = title; $('mp-title').title = title; }
        setIcon($('mp-play'), playing ? 'fa-pause' : 'fa-play');
        setIcon($('mp-collapse'), prefs.collapsed ? 'fa-window-maximize' : 'fa-window-minimize');
        $('mp-collapse').title = prefs.collapsed ? 'Show video' : 'Minimize to bar';
        $('mp-next').disabled = currentIndex() + 1 >= queueLength();
        $('mp-play').disabled = !c;

        var dot = $('activity-video-dot');
        if (dot) {
            dot.hidden = !c;
            dot.classList.toggle('playing', playing);
            dot.title = c ? (playing ? 'Playing: ' : 'Paused: ') + title : '';
        }

        // Android: lets the app enter Picture-in-Picture and keep playing when you go to the home screen
        var nativeKey = (playing ? 1 : 0) + ':' + (isVideoItem(c) ? 1 : 0);
        if (nativeKey !== lastNative && window.SanNative && SanNative.available && SanNative.mediaState) {
            lastNative = nativeKey;
            SanNative.mediaState(playing, isVideoItem(c));
        }

        updateSession(c, playing, title);
        manageTicker(!!c);
        lastTitle = title;
        lastApplied = '';
        layout();
        paintProgress();
    }

    function paintProgress() {
        var fill = $('mp-progress-fill');
        if (!fill) return;
        var t = timing();
        fill.style.width = t.d ? Math.min(100, (t.t / t.d) * 100).toFixed(1) + '%' : '0%';
    }

    var lastPlaying = null;
    function manageTicker(on) {
        if (on && !ticker) {
            ticker = setInterval(function () {
                var p = isPlaying();
                if (p !== lastPlaying) { lastPlaying = p; update(); return; }
                paintProgress();
                var c = current();
                // YouTube reports the real title once the video has loaded
                if (isYT(c) && ytReady() && c.name.indexOf('YouTube Video (') === 0 && typeof ytPlayer.getVideoData === 'function') {
                    var data = ytPlayer.getVideoData();
                    if (data && data.title) { c.name = data.title; if (typeof renderVideoQueue === 'function') renderVideoQueue(); }
                }
            }, 500);
        } else if (!on && ticker) {
            clearInterval(ticker);
            ticker = 0;
            lastPlaying = null;
        }
    }

    function updateSession(c, playing, title) {
        if (!('mediaSession' in navigator)) return;
        try {
            if (!sessionReady) {
                sessionReady = true;
                var ms = navigator.mediaSession;
                ms.setActionHandler('play', function () { if (!isPlaying()) toggle(); });
                ms.setActionHandler('pause', function () { if (isPlaying()) toggle(); });
                ms.setActionHandler('previoustrack', prev);
                ms.setActionHandler('nexttrack', next);
                ms.setActionHandler('stop', stop);
            }
            if (title !== lastTitle) {
                navigator.mediaSession.metadata = c && window.MediaMetadata ? new MediaMetadata({ title: title, artist: 'SanCode' }) : null;
            }
            navigator.mediaSession.playbackState = c ? (playing ? 'playing' : 'paused') : 'none';
        } catch (e) { /* unsupported action */ }
    }

    // ---------------------------------------------------------------- dragging

    function initDrag() {
        var drag = null;
        bar.addEventListener('pointerdown', function (e) {
            if (e.button > 0 || e.target.closest('button')) return;
            var r = el.getBoundingClientRect();
            drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
            el.classList.add('mp-dragging');
            try { bar.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            e.preventDefault();
        });
        bar.addEventListener('pointermove', function (e) {
            if (!drag) return;
            var left = e.clientX - drag.dx;
            var top = e.clientY - drag.dy;
            prefs.r = Math.max(0, window.innerWidth - (left + drag.w));
            prefs.b = Math.max(0, window.innerHeight - (top + drag.h));
            lastApplied = '';
            layout();
        });
        var end = function () {
            if (!drag) return;
            drag = null;
            el.classList.remove('mp-dragging');
            savePrefs();
        };
        bar.addEventListener('pointerup', end);
        bar.addEventListener('pointercancel', end);
    }

    function initProgress() {
        var track = $('mp-progress');
        var seeking = false;
        function at(e) {
            var r = track.getBoundingClientRect();
            seek((e.clientX - r.left) / r.width);
        }
        track.addEventListener('pointerdown', function (e) {
            seeking = true;
            try { track.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            at(e);
        });
        track.addEventListener('pointermove', function (e) { if (seeking) at(e); });
        track.addEventListener('pointerup', function () { seeking = false; });
        track.addEventListener('pointercancel', function () { seeking = false; });
    }

    // ---------------------------------------------------------------- init

    function init() {
        el = $('mini-player');
        slot = $('player-slot');
        video = $('mini-video-player');
        bar = $('mp-bar');
        if (!el || !slot || !video) return;

        $('mp-play').addEventListener('click', toggle);
        $('mp-next').addEventListener('click', next);
        $('mp-prev').addEventListener('click', prev);
        $('mp-close').addEventListener('click', stop);
        $('mp-open').addEventListener('click', openTool);
        $('mp-collapse').addEventListener('click', function () { prefs.collapsed = !prefs.collapsed; savePrefs(); update(); });
        $('mp-size').addEventListener('click', function () {
            prefs.size = prefs.size === 's' ? 'm' : prefs.size === 'm' ? 'l' : 's';
            savePrefs();
            update();
        });
        initDrag();
        initProgress();

        ['play', 'pause', 'ended', 'emptied', 'loadedmetadata', 'seeked'].forEach(function (name) { video.addEventListener(name, update); });
        window.addEventListener('resize', function () { lastApplied = ''; layout(); });
        // the Media tool being shown/hidden or the sidebar sliding in/out
        var sidebar = $('sidebar');
        if (window.MutationObserver && sidebar) {
            var mo = new MutationObserver(function () { layout(); });
            mo.observe(sidebar, { attributes: true, attributeFilter: ['class', 'style'] });
            var panel = $('sidebar-video');
            if (panel) mo.observe(panel, { attributes: true, attributeFilter: ['class'] });
        }
        setInterval(layout, 400);
        update();
    }

    window.MiniPlayer = { update: update, layout: layout, toggle: toggle, next: next, prev: prev, stop: stop, open: openTool, isPlaying: isPlaying };

    // Called by MainActivity
    window.SanMini = {
        pip: function (on) { pipActive = !!on; lastApplied = ''; layout(); },
        pipClosed: function () {
            // the user dismissed the little PiP window: stop playing, like any video app
            pipActive = false;
            if (isPlaying()) toggle();
            lastApplied = '';
            layout();
        },
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
