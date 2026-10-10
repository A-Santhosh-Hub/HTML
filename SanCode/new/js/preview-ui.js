/*
 * preview-ui.js - live preview pane. The page is rendered by js/preview-engine.js inside preview/frame.html
 * (a separate origin on Android), so previewed code can never touch the editor's data or native bridge.
 */

const PREVIEW_URL = location.hostname === 'appassets.androidplatform.net'
    ? 'https://preview.sancode.invalid/preview/frame.html'
    : 'preview/frame.html';

const PREVIEWABLE_EXT = /\.(html?|css|js|mjs|json|svg|png|jpe?g|gif|webp|ico|avif|bmp|woff2?|ttf|otf|mp3|mp4|webm|wav|ogg|txt|md|xml|csv|wasm)$/i;
const PREVIEW_FILE_LIMIT = 8 * 1024 * 1024;
const PREVIEW_TOTAL_LIMIT = 80 * 1024 * 1024;
const CONSOLE_MAX_LINES = 300;

const preview = {
    ready: false,
    pending: null,
    sentVersion: -1,
    entry: '',
    consoleLines: 0,
    errorCount: 0,
};

function initPreviewUi() {
    window.addEventListener('message', onPreviewMessage);
}

function previewFrameOrigin() {
    try { return new URL(PREVIEW_URL, location.href).origin; } catch (e) { return '*'; }
}

function postToPreviewFrame(msg) {
    const win = els.liveIframe && els.liveIframe.contentWindow;
    if (win) win.postMessage(msg, previewFrameOrigin());
}

function onPreviewMessage(e) {
    if (!els.liveIframe || e.source !== els.liveIframe.contentWindow) return;
    const m = e.data;
    if (!m || typeof m !== 'object' || !m.__san) return;

    if (m.__san === 'frame-ready') {
        preview.ready = true;
        preview.sentVersion = -1;
        if (preview.pending) {
            const p = preview.pending;
            preview.pending = null;
            sendPreviewRender(p);
        }
    } else if (m.__san === 'console') {
        appendPreviewConsole(m.level, m.args || []);
    } else if (m.__san === 'entry') {
        preview.entry = m.path || '';
        const label = $('preview-entry');
        if (label) label.textContent = preview.entry || (activeTab() ? activeTab().name : 'untitled');
        const back = $('preview-back');
        if (back) back.classList.toggle('hidden', !m.canBack);
    }
}

// ---------------------------------------------------------------------------
// Workspace files -> Blobs for the engine
// ---------------------------------------------------------------------------
async function nativeFileBlob(fileData) {
    if (fileData.previewBlob) return fileData.previewBlob;
    if (fileData.file) return fileData.file;
    if (fileData.isText) {
        const text = fileData.content != null ? fileData.content : await SanNative.readText(fileData.uri);
        fileData.previewBlob = new Blob([text], { type: fileData.type || 'text/plain' });
    } else {
        const b64 = await SanNative.readBase64(fileData.uri);
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        fileData.previewBlob = new Blob([bytes], { type: fileData.type || 'application/octet-stream' });
    }
    return fileData.previewBlob;
}

async function collectPreviewFiles() {
    const out = {};
    const ws = state.workspace;
    if (!ws) return out;
    let total = 0;
    const entries = Object.entries(ws.files).filter(([path, f]) => PREVIEWABLE_EXT.test(path) && (f.size == null || f.size <= PREVIEW_FILE_LIMIT));
    let cursor = 0;
    const worker = async () => {
        while (cursor < entries.length) {
            const [path, f] = entries[cursor++];
            if (total > PREVIEW_TOTAL_LIMIT) return;
            try {
                const blob = await nativeFileBlob(f);
                total += blob.size || 0;
                out[path] = blob;
            } catch (err) {
                /* unreadable file: the preview simply will not resolve it */
            }
        }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return out;
}

function collectPreviewOverrides() {
    const overrides = {};
    state.tabs.forEach((t) => {
        if (!t.workspacePath || t.isMedia) return;
        overrides[t.workspacePath] = tabText(t);
    });
    return overrides;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
async function sendPreviewRender(payload) {
    if (state.workspace && preview.sentVersion !== (state.workspace.version || 0)) {
        const version = state.workspace.version || 0;
        const files = await collectPreviewFiles();
        postToPreviewFrame({ __san: 'set-files', files });
        preview.sentVersion = version;
    } else if (!state.workspace && preview.sentVersion !== -2) {
        postToPreviewFrame({ __san: 'set-files', files: {} });
        preview.sentVersion = -2;
    }
    if (payload.reset) clearPreviewConsole();
    postToPreviewFrame(Object.assign({ __san: 'render' }, payload));
}

/**
 * The tab the preview is "about". Editing a CSS/JS/JSON file keeps showing (and refreshing) the page it
 * belongs to instead of replacing the page with that file's text, like VS Code's live preview.
 */
function previewSourceTab() {
    const tab = activeTab();
    if (tab && !tab.isMedia && PREVIEW_FORMATS.includes(tab.format)) {
        preview.anchorTabId = tab.id;
        return { tab, anchored: false };
    }
    const anchor = state.tabs.find((t) => t.id === preview.anchorTabId && !t.isMedia);
    return anchor ? { tab: anchor, anchored: true } : { tab, anchored: false };
}

function buildPreviewPayload(reset) {
    const { tab, anchored } = previewSourceTab();
    const sourcePath = tab && tab.workspacePath ? tab.workspacePath : '';
    const entry = (reset && !anchored) ? sourcePath : (preview.entry || sourcePath);
    return {
        format: tab ? tab.format : state.format,
        entry,
        text: entry === sourcePath ? tabText(tab) : null,
        overrides: collectPreviewOverrides(),
        reset: !!reset && !anchored,
    };
}

function refreshPreview(reset) {
    if (!state.previewVisible || !els.liveIframe) return;
    const tab = activeTab();
    if (!tab || tab.isMedia) return;
    const payload = buildPreviewPayload(reset === true);

    if (!preview.ready) {
        preview.pending = payload;
        if (!els.liveIframe.getAttribute('src')) els.liveIframe.setAttribute('src', PREVIEW_URL);
        return;
    }
    sendPreviewRender(payload);
}

let previewTimeout;
function debounceRefreshPreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(() => refreshPreview(false), 450);
}

function toggleHtmlPreview() {
    state.previewVisible = !state.previewVisible;
    if (state.previewVisible) {
        if (els.htmlPreviewPane) els.htmlPreviewPane.classList.remove('hidden');
        if (state.format === 'txt' && els.formatSelect) {
            els.formatSelect.value = 'html';
            els.formatSelect.dispatchEvent(new Event('change'));
        }
        refreshPreview(true);
    } else if (els.htmlPreviewPane) {
        els.htmlPreviewPane.classList.add('hidden');
    }
    if (ed) setTimeout(() => ed.measure(), 50);
}

function previewBack() {
    postToPreviewFrame({ __san: 'back' });
}

function toggleDevicePreview() {
    state.previewMode = state.previewMode === 'desktop' ? 'mobile' : 'desktop';
    const container = $('iframe-device-container');
    const bgWrapper = $('preview-bg-wrapper');
    const btnIcon = document.querySelector('#device-toggle-btn i');
    if (!container || !bgWrapper || !btnIcon) return;

    if (state.previewMode === 'mobile') {
        btnIcon.className = 'fa-solid fa-desktop text-xs';
        $('device-toggle-btn').title = 'Switch to Desktop View';
        container.className = 'w-[375px] h-[812px] bg-white transition-all duration-300 relative rounded-[2rem] border-[14px] border-[#1a1a1a] shadow-2xl overflow-hidden shrink-0 mx-auto my-auto';
        bgWrapper.className = 'flex-1 relative bg-vs-editor flex items-center justify-center overflow-auto p-8';
    } else {
        btnIcon.className = 'fa-solid fa-mobile-screen text-xs';
        $('device-toggle-btn').title = 'Switch to Mobile View';
        container.className = 'w-full h-full bg-white transition-all duration-300 relative shadow-2xl';
        bgWrapper.className = 'flex-1 relative bg-vs-editor flex items-center justify-center overflow-auto p-0';
    }
}

/** Full-screen preview: assets are inlined as data: URIs because it runs in a separate WebView / tab. */
async function launchPreviewInNewTab() {
    const tab = activeTab();
    if (!tab || tab.isMedia) return;
    const text = state.content;
    if (!text.trim()) {
        showToast('Editor is empty', 'error');
        return;
    }
    showToast('Preparing preview...', 'info');
    // Open during the click gesture; render the document inside an isolated child frame.
    const win = window.open('about:blank', '_blank');
    if (!win) { showToast('Popup blocked! Allow popups to preview.', 'error'); return; }
    win.opener = null;
    try {
        const engine = SanPreview.createEngine({ mode: 'inline' });
        engine.setFiles(await collectPreviewFiles());
        const result = await engine.render({
            format: state.format,
            entry: tab.workspacePath || '',
            text,
            overrides: collectPreviewOverrides(),
        });
        engine.dispose();

        win.document.title = 'SanCode Preview';
        const frame = win.document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-downloads allow-popups');
        frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;background:white';
        frame.srcdoc = result.html;
        win.document.body.replaceChildren(frame);
    } catch (err) {
        win.close();
        showToast(`Preview failed: ${err.message}`, 'error');
    }
}

// ---------------------------------------------------------------------------
// Console panel
// ---------------------------------------------------------------------------
function appendPreviewConsole(level, args) {
    const list = $('preview-console-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = `console-row console-${level}`;
    row.textContent = args.join(' ');
    list.appendChild(row);
    preview.consoleLines++;
    while (list.children.length > CONSOLE_MAX_LINES) list.removeChild(list.firstChild);
    list.scrollTop = list.scrollHeight;

    if (level === 'error') {
        preview.errorCount++;
        const badge = $('preview-console-badge');
        if (badge) {
            badge.textContent = preview.errorCount;
            badge.classList.remove('hidden');
        }
    }
}

function clearPreviewConsole() {
    const list = $('preview-console-list');
    if (list) list.innerHTML = '';
    preview.consoleLines = 0;
    preview.errorCount = 0;
    const badge = $('preview-console-badge');
    if (badge) badge.classList.add('hidden');
}

function togglePreviewConsole() {
    const panel = $('preview-console');
    if (!panel) return;
    panel.classList.toggle('hidden');
    const badge = $('preview-console-badge');
    if (badge && !panel.classList.contains('hidden')) badge.classList.add('hidden');
}
