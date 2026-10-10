/*
 * core.js - application state, language table, editor-engine glue, tabs, session restore,
 * formatting, saving, settings and keyboard shortcuts.
 * The editor itself is lib/san-editor.js (CodeMirror 6); everything here talks to it through `ed`.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function $(id) { return document.getElementById(id); }

function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loadJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function saveJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        return false;
    }
}

function debounce(fn, ms) {
    let timer = null;
    const wrapped = (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { timer = null; fn(...args); }, ms);
    };
    wrapped.cancel = () => { clearTimeout(timer); timer = null; };
    return wrapped;
}

function isTouchDevice() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

// ---------------------------------------------------------------------------
// Languages / formats
// ---------------------------------------------------------------------------
const LANGS = {
    txt: { label: 'Plain Text', ext: 'txt', icon: 'fa-solid fa-file-lines text-vs-textMuted' },
    md: { label: 'Markdown', ext: 'md', icon: 'fa-brands fa-markdown text-blue-400' },
    json: { label: 'JSON', ext: 'json', icon: 'fa-solid fa-code text-yellow-500' },
    html: { label: 'HTML', ext: 'html', icon: 'fa-brands fa-html5 text-orange-500' },
    css: { label: 'CSS', ext: 'css', icon: 'fa-brands fa-css3-alt text-blue-400' },
    js: { label: 'JavaScript', ext: 'js', icon: 'fa-brands fa-js text-yellow-400' },
    jsx: { label: 'JavaScript React', ext: 'jsx', icon: 'fa-brands fa-react text-cyan-400' },
    ts: { label: 'TypeScript', ext: 'ts', icon: 'fa-solid fa-code text-blue-500' },
    tsx: { label: 'TypeScript React', ext: 'tsx', icon: 'fa-brands fa-react text-blue-400' },
    c: { label: 'C / C++', ext: 'c', icon: 'fa-solid fa-c text-blue-600' },
    py: { label: 'Python', ext: 'py', icon: 'fa-brands fa-python text-blue-500' },
    java: { label: 'Java', ext: 'java', icon: 'fa-brands fa-java text-red-400' },
    kt: { label: 'Kotlin', ext: 'kt', icon: 'fa-solid fa-code text-purple-400' },
    sql: { label: 'SQL', ext: 'sql', icon: 'fa-solid fa-database text-sky-400' },
    xml: { label: 'XML / SVG', ext: 'xml', icon: 'fa-solid fa-code text-orange-400' },
    yaml: { label: 'YAML', ext: 'yaml', icon: 'fa-solid fa-file-code text-pink-400' },
    sh: { label: 'Shell', ext: 'sh', icon: 'fa-solid fa-terminal text-green-400' },
    csv: { label: 'CSV', ext: 'csv', icon: 'fa-solid fa-file-csv text-green-500' },
    // text-tool modes: stored in the editor as plain text
    passage: { label: 'Text Passage', ext: 'txt', icon: 'fa-solid fa-file-lines text-vs-textMuted' },
    youtube: { label: 'YouTube Title', ext: 'txt', icon: 'fa-solid fa-file-lines text-vs-textMuted' },
    hashtag: { label: 'Hashtags', ext: 'txt', icon: 'fa-solid fa-file-lines text-vs-textMuted' },
    'base64-enc': { label: 'Base64 Encoded', ext: 'txt', icon: 'fa-solid fa-file-lines text-vs-textMuted' },
    'base64-dec': { label: 'Base64 Decoded', ext: 'txt', icon: 'fa-solid fa-file-lines text-vs-textMuted' },
    'url-enc': { label: 'URL Encoded', ext: 'txt', icon: 'fa-solid fa-file-lines text-vs-textMuted' },
    'url-dec': { label: 'URL Decoded', ext: 'txt', icon: 'fa-solid fa-file-lines text-vs-textMuted' },
};

const EXT_TO_FORMAT = {
    txt: 'txt', text: 'txt', log: 'txt', env: 'txt', md: 'md', markdown: 'md',
    json: 'json', jsonc: 'json', webmanifest: 'json',
    html: 'html', htm: 'html', css: 'css', scss: 'css', less: 'css',
    js: 'js', mjs: 'js', cjs: 'js', jsx: 'jsx', ts: 'ts', tsx: 'tsx',
    c: 'c', h: 'c', cpp: 'c', cc: 'c', cxx: 'c', hpp: 'c',
    py: 'py', java: 'java', gradle: 'java', kt: 'kt', kts: 'kt',
    sql: 'sql', xml: 'xml', svg: 'xml', yaml: 'yaml', yml: 'yaml',
    sh: 'sh', bash: 'sh', csv: 'csv',
};

const CODE_FORMATS = ['json', 'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'c', 'py', 'java', 'kt', 'sql', 'xml', 'yaml', 'sh', 'md'];
const PREVIEW_FORMATS = ['html', 'md', 'xml'];

function langInfo(fmt) { return LANGS[fmt] || LANGS.txt; }
function extForFormat(fmt) { return langInfo(fmt).ext; }

function formatFromFilename(name) {
    const base = String(name || '').split('/').pop().toLowerCase();
    if (base === 'dockerfile' || base === 'makefile') return 'sh';
    const dot = base.lastIndexOf('.');
    return dot === -1 ? 'txt' : (EXT_TO_FORMAT[base.slice(dot + 1)] || 'txt');
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
    theme: 'theme-dark',
    tabs: [], // { id, name, content, format, isMedia, mediaType, workspacePath, nativeUri, dirty }
    activeTabId: null,
    format: 'txt',
    fileName: 'untitled',
    sidebarTab: 'workspace',
    sidebarVisible: true,
    sidebarWidth: 256,
    previewVisible: false,
    previewMode: 'desktop',
    excelVisible: false,
    wordVisible: false,
    workspace: null, // { name, native, treeUri, dirs, files: { path: { file, uri, isText, isMedia, type, blobUrl, content } } }
    settings: {
        indentSize: '4',
        minify: false,
        trim: true,
        removeSpaces: false,
        removeLines: false,
        wordWrap: false,
        fontSize: 14,
        indentGuides: true,
        rainbowBrackets: true,
        renderWhitespace: false,
    },
};

// `state.content` is a live view of the active editor document
Object.defineProperty(state, 'content', {
    enumerable: false,
    get() { return getEditorText(); },
    set(value) { setEditorText(value); },
});

const HISTORY_KEY = 'vscode_sanstudio_history';
const SETTINGS_KEY = 'sanstudio_vscode_config';
const SESSION_KEY = 'sancode_session_v1';

const initialId = Date.now();
state.tabs.push({ id: initialId, name: 'untitled', content: '', format: 'txt', isMedia: false });
state.activeTabId = initialId;

const els = {
    sidebar: $('sidebar'),
    htmlPreviewPane: $('html-preview-pane'),
    liveIframe: $('live-iframe'),
    editorHost: $('editor-host'),
    textEditorWrapper: $('text-editor-wrapper'),
    excelEditorWrapper: $('excel-editor-wrapper'),
    wordEditorWrapper: $('word-editor-wrapper'),
    wordCanvas: $('word-canvas'),
    mediaViewerWrapper: $('media-viewer-wrapper'),
    mediaPreviewImg: $('media-preview-img'),
    mediaPreviewVideo: $('media-preview-video'),
    mediaPreviewPdf: $('media-preview-pdf'),
    mediaPreviewInfo: $('media-preview-info'),
    extraKeys: $('extra-keys'),

    fileNameDisplays: [$('window-title'), $('breadcrumb-name')],
    breadcrumbFormat: $('breadcrumb-format'),
    statusLanguage: $('status-language'),
    statusSpaces: $('status-spaces'),
    statusLn: $('status-ln'),
    statusCol: $('status-col'),
    statusSel: $('status-sel'),
    statusErrors: $('status-errors'),
    statusWarnings: $('status-warnings'),
    charCount: $('char-count'),
    wordCount: $('word-count'),

    themeSelect: $('theme-select'),
    formatSelect: $('format-select'),
    caseSelect: $('case-select'),
    indentSelect: $('indent-size'),
    chkMinify: $('chk-minify'),
    chkTrim: $('chk-trim'),
    chkSpaces: $('chk-spaces'),
    chkLines: $('chk-lines'),

    optCode: $('opt-code'),
    optPassage: $('opt-passage'),
};

// ---------------------------------------------------------------------------
// Editor engine glue
// ---------------------------------------------------------------------------
let ed = null;

function activeTab() {
    return state.tabs.find((t) => t.id === state.activeTabId) || null;
}

/** True when the engine's live document is this tab's document (false before the first activation). */
function engineOwns(tab) {
    return !!(ed && tab && ed.activeId === tab.id);
}

function getEditorText() {
    const tab = activeTab();
    if (!tab || tab.isMedia) return '';
    return engineOwns(tab) ? ed.getValue() : (tab.content || '');
}

function setEditorText(value) {
    const tab = activeTab();
    if (!tab || tab.isMedia) return;
    if (ed) ed.setValue(String(value));
    else tab.content = String(value);
}

function initEditor() {
    if (!els.editorHost) return;
    if (!window.SanEditor) {
        els.editorHost.innerHTML = '<div class="p-6 text-sm text-red-400">The editor engine failed to load (lib/san-editor.js).</div>';
        return;
    }
    ed = SanEditor.create(els.editorHost, {
        placeholder: 'Type, paste, or drop your code here...',
        onChange: onEditorChange,
        onCursor: onEditorCursor,
        onFocus: onEditorFocus,
        onFormat: () => formatContent(),
        onDiagnostics: onEditorDiagnostics,
        onFontSize: (size) => { state.settings.fontSize = size; saveSettings(); },
    });
    applyEditorSettings();
}

function applyEditorSettings() {
    if (!ed) return;
    ed.setWordWrap(state.settings.wordWrap);
    ed.setIndent(state.settings.indentSize);
    ed.setFontSize(state.settings.fontSize || 14);
    ed.setGuides(state.settings.indentGuides !== false);
    ed.setRainbow(state.settings.rainbowBrackets !== false);
    ed.setWhitespace(!!state.settings.renderWhitespace);
    ed.setDark(state.theme !== 'theme-light');
}

function activateDoc(tab) {
    if (!ed || tab.isMedia) return;
    if (!ed.hasDoc(tab.id)) ed.createDoc(tab.id, tab.content || '', tab.format);
    ed.switchDoc(tab.id);
}

/** Live text of any text tab (the editor engine owns it; tab.content can lag behind). */
function tabText(tab) {
    if (!tab || tab.isMedia) return '';
    if (engineOwns(tab)) return ed.getValue();
    if (ed && ed.hasDoc(tab.id)) return ed.getDocValue(tab.id);
    return tab.content || '';
}

/** Copy the live editor text of the active tab back into the tab / workspace model. */
function syncContentFromEditor() {
    const tab = activeTab();
    if (!tab || tab.isMedia || !engineOwns(tab)) return;
    tab.content = ed.getValue();
    if (tab.workspacePath && state.workspace && state.workspace.files[tab.workspacePath]) {
        state.workspace.files[tab.workspacePath].content = tab.content;
    }
}

const afterEdit = debounce(() => {
    syncContentFromEditor();
    updateStats();
    persistSession();
}, 300);

function onEditorChange(info) {
    const tab = activeTab();
    if (!tab || tab.isMedia) return;
    if (!tab.dirty) {
        tab.dirty = true;
        renderTabs();
    }
    if (els.charCount) els.charCount.textContent = `${info.length.toLocaleString()} Chars`;
    afterEdit();
    if (state.previewVisible) debounceRefreshPreview();
}

function onEditorCursor(info) {
    if (state.wordVisible) return;
    if (els.statusLn) els.statusLn.textContent = info.line;
    if (els.statusCol) els.statusCol.textContent = info.col;
    if (els.statusSel) {
        const parts = [];
        if (info.selected) parts.push(`(${info.selected} selected)`);
        if (info.cursors > 1) parts.push(`${info.cursors} cursors`);
        els.statusSel.textContent = parts.join(' ');
    }
}

function onEditorFocus(focused) {
    if (els.extraKeys) els.extraKeys.classList.toggle('visible', focused && isTouchDevice());
}

function onEditorDiagnostics(d) {
    if (els.statusErrors) els.statusErrors.textContent = d.errors;
    if (els.statusWarnings) els.statusWarnings.textContent = d.warnings;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function syncActiveTab() {
    const tab = activeTab();
    if (tab) {
        syncContentFromEditor();
        tab.format = state.format;
        tab.name = state.fileName;
    }
    renderTabs();
}

function renderTabs() {
    const container = $('editor-tabs-container');
    const sidebarContainer = $('sidebar-open-editors');
    if (!container || !sidebarContainer) return;

    let tabsHtml = '';
    let sidebarHtml = '';

    state.tabs.forEach((tab) => {
        const isActive = tab.id === state.activeTabId;
        let iconClass = langInfo(tab.format).icon;
        if (tab.isMedia && tab.mediaType && tab.mediaType.startsWith('image/')) iconClass = 'fa-solid fa-image text-green-400';
        if (tab.isMedia && tab.mediaType && tab.mediaType.startsWith('video/')) iconClass = 'fa-solid fa-film text-purple-400';
        const name = escapeHtml(tab.name);
        const dirtyClass = tab.dirty ? ' is-dirty' : '';

        tabsHtml += `
            <div onclick="switchEditorTab(${tab.id})" data-active="${isActive ? 1 : 0}" class="flex items-center h-full px-3 min-w-[120px] max-w-[200px] ${isActive ? 'bg-vs-editor border-t border-vs-accent text-vs-activityActive' : 'bg-vs-tabInactive border-t border-transparent text-vs-textMuted hover:bg-vs-editor/50'} cursor-pointer border-r border-vs-border group${dirtyClass}">
                <i class="${iconClass} text-sm mr-2 ${isActive ? '' : 'opacity-70'}"></i>
                <span class="text-[13px] truncate flex-1 ${isActive ? 'italic' : ''}" title="${name}">${name}</span>
                <button onclick="closeEditorTab(${tab.id}, event)" aria-label="Close tab" class="tab-close flex items-center justify-center w-5 h-5 rounded ml-1 ${isActive ? 'text-vs-text' : 'text-vs-textMuted'} hover:bg-vs-hover hover:text-white transition-all">
                    <i class="fa-solid fa-xmark close-x"></i><i class="fa-solid fa-circle dirty-dot"></i>
                </button>
            </div>`;

        sidebarHtml += `
            <div onclick="switchEditorTab(${tab.id}); if (isMobile()) closeMobileSidebar();" class="open-file-row flex items-center px-6 py-1 ${isActive ? 'bg-vs-selection text-vs-text' : 'text-vs-textMuted hover:bg-vs-hover hover:text-vs-text'} cursor-pointer text-sm group relative">
                <i class="${iconClass} mr-2 text-xs"></i>
                <span class="truncate flex-1">${name}${tab.dirty ? ' <span class="opacity-70">&#9679;</span>' : ''}</span>
                <button onclick="closeEditorTab(${tab.id}, event)" aria-label="Close tab" class="flex items-center justify-center w-5 h-5 rounded absolute right-2 opacity-0 group-hover:opacity-100 hover:bg-vs-hover hover:text-white transition-all"><i class="fa-solid fa-xmark"></i></button>
            </div>`;
    });

    container.innerHTML = tabsHtml;
    sidebarContainer.innerHTML = sidebarHtml;
    const activeEl = container.querySelector('[data-active="1"]');
    if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    updateFileDisplay();
}

function switchEditorTab(id) {
    const target = state.tabs.find((t) => t.id === id);
    if (!target) return;

    syncContentFromEditor();

    state.activeTabId = id;
    state.format = target.format || 'txt';
    state.fileName = target.name;

    if (els.formatSelect && !target.isMedia && [...els.formatSelect.options].some((o) => o.value === state.format)) {
        els.formatSelect.value = state.format;
    }

    if (state.excelVisible) toggleSpreadsheetView(false);
    if (state.wordVisible) toggleWordView(false);
    if (state.assetExplorerVisible) toggleAssetExplorerView(false);

    if (target.isMedia) {
        toggleMediaView(true, target.mediaType, target.content);
    } else {
        toggleMediaView(false);
        activateDoc(target);
        if (ed) {
            ed.measure();
            onEditorCursor(ed.cursor());
            if (!isTouchDevice()) ed.focus();
        }
    }

    updateUIForFormat();
    updateStats();
    updateFileDisplay();
    renderTabs();
    persistSession();

    if (state.previewVisible && !target.isMedia) refreshPreview(true);
}

async function closeEditorTab(id, e) {
    if (e) e.stopPropagation();
    const index = state.tabs.findIndex((t) => t.id === id);
    if (index === -1) return;
    const tab = state.tabs[index];

    if (id === state.activeTabId) syncContentFromEditor();
    const hasContent = !tab.isMedia && (tab.content || '').trim() !== '';
    if (tab.dirty && hasContent) {
        const proceed = await showConfirm(`"${tab.name}" has unsaved changes. Close it anyway?`);
        if (!proceed) return;
    }

    if (ed) ed.closeDoc(id);

    if (state.tabs.length === 1) {
        state.tabs[0] = { id: Date.now(), name: 'untitled', content: '', format: 'txt', isMedia: false };
        switchEditorTab(state.tabs[0].id);
        return;
    }

    state.tabs.splice(index, 1);
    if (state.activeTabId === id) {
        switchEditorTab(state.tabs[index > 0 ? index - 1 : 0].id);
    } else {
        renderTabs();
        persistSession();
    }
}

async function createNewFile() {
    if (state.wordVisible) toggleWordView(false);
    if (state.excelVisible) toggleSpreadsheetView(false);
    toggleMediaView(false);

    const newId = Date.now();
    state.tabs.push({ id: newId, name: 'untitled', content: '', format: 'txt', isMedia: false });
    switchEditorTab(newId);
    showToast('Created new tab', 'info');
}

/** Open (or focus) a text tab. Returns the tab. */
function openTextTab({ name, content, format, workspacePath, nativeUri }) {
    if (workspacePath) {
        const existing = state.tabs.find((t) => t.workspacePath === workspacePath);
        if (existing) { switchEditorTab(existing.id); return existing; }
    }
    const tab = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name, content: content || '', format: format || formatFromFilename(name), isMedia: false,
        workspacePath: workspacePath || undefined, nativeUri: nativeUri || undefined,
    };
    state.tabs.push(tab);
    switchEditorTab(tab.id);
    return tab;
}

// ---------------------------------------------------------------------------
// Session restore (Android can kill the WebView at any time)
// ---------------------------------------------------------------------------
const SESSION_MAX_CHARS = 3 * 1024 * 1024;

function persistSession() {
    try {
        let budget = SESSION_MAX_CHARS;
        const saved = [];
        state.tabs.forEach((t) => {
            if (t.isMedia || t.workspacePath || t.nativeUri) return;
            const content = tabText(t);
            if (content.length > budget) return;
            budget -= content.length;
            saved.push({ id: t.id, name: t.name, format: t.format, content, dirty: !!t.dirty });
        });
        const active = activeTab();
        saveJson(SESSION_KEY, {
            tabs: saved,
            active: active && saved.some((s) => s.id === active.id) ? active.id : (saved[0] ? saved[0].id : null),
            workspaceTabs: state.tabs.filter((t) => t.workspacePath).map((t) => t.workspacePath),
            activeWorkspacePath: active && active.workspacePath ? active.workspacePath : null,
        });
    } catch (e) {
        /* storage full or unavailable: session restore is best effort */
    }
}

function restoreSession() {
    const s = loadJson(SESSION_KEY, null);
    if (!s || !Array.isArray(s.tabs) || s.tabs.length === 0) return null;
    state.tabs = s.tabs.map((t) => ({
        id: t.id, name: String(t.name || 'untitled'), content: String(t.content || ''),
        format: LANGS[t.format] ? t.format : 'txt', isMedia: false, dirty: !!t.dirty,
    }));
    state.activeTabId = state.tabs.some((t) => t.id === s.active) ? s.active : state.tabs[0].id;
    return s;
}

window.addEventListener('pagehide', () => { syncContentFromEditor(); persistSession(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { syncContentFromEditor(); persistSession(); } });

// ---------------------------------------------------------------------------
// Status / display
// ---------------------------------------------------------------------------
function updateStatusSpaces() {
    if (els.statusSpaces) els.statusSpaces.textContent = state.settings.indentSize === 'tab' ? 'Tab' : state.settings.indentSize;
}

function updateFileDisplay() {
    const tab = activeTab();
    let fullName = tab ? tab.name : `${state.fileName}.${extForFormat(state.format)}`;
    if (state.excelVisible) fullName = 'spreadsheet.csv';
    if (state.wordVisible) fullName = 'document.html';

    if (els.fileNameDisplays[0]) els.fileNameDisplays[0].textContent = fullName;
    if (els.breadcrumbFormat) {
        els.breadcrumbFormat.textContent = state.wordVisible ? 'html' : (state.excelVisible ? 'csv' : (tab && tab.isMedia ? 'media' : state.format));
    }
    if (els.fileNameDisplays[1]) els.fileNameDisplays[1].textContent = fullName;
    if (els.statusLanguage) {
        els.statusLanguage.textContent = state.wordVisible ? 'Rich Text' : (state.excelVisible ? 'CSV Spreadsheet' : (tab && tab.isMedia ? 'Media File' : langInfo(state.format).label));
    }
}

function updateUIForFormat() {
    const isCode = CODE_FORMATS.includes(state.format);
    const isPassage = state.format === 'passage';

    if (els.optCode) els.optCode.classList.add('hidden');
    if (els.optPassage) els.optPassage.classList.add('hidden');

    if (isCode && els.optCode) {
        els.optCode.classList.remove('hidden');
        els.optCode.classList.add('flex');
    } else if (isPassage && els.optPassage) {
        els.optPassage.classList.remove('hidden');
        els.optPassage.classList.add('flex');
    }
}

function updateStats() {
    const text = state.wordVisible ? (els.wordCanvas ? els.wordCanvas.innerText || '' : '') : getEditorText();
    const trimmed = text.trim();
    if (els.charCount) els.charCount.textContent = `${text.length.toLocaleString()} Chars`;
    if (els.wordCount) els.wordCount.textContent = `${trimmed === '' ? 0 : trimmed.split(/\s+/).length.toLocaleString()} Words`;
}

// ---------------------------------------------------------------------------
// Formatting (Prettier / Terser via js/san-format.js) and text transforms
// ---------------------------------------------------------------------------
function cleanText(text) {
    let res = text;
    if (state.settings.removeLines) res = res.replace(/^\s*[\r\n]/gm, '');
    if (state.settings.removeSpaces) res = res.replace(/[ \t]+/g, ' ');
    if (state.settings.trim) res = res.split('\n').map((l) => l.trim()).join('\n');
    return res;
}

function trimTrailingWhitespace(text) {
    return text.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\s*$/, '\n');
}

function formatPassage(text) {
    if (!els.caseSelect) return text;
    const caseType = els.caseSelect.value;
    if (caseType === 'upper') return text.toUpperCase();
    if (caseType === 'lower') return text.toLowerCase();
    if (caseType === 'title') return text.toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());
    if (caseType === 'sentence') return text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());
    return text;
}

function formatHashtag(text) {
    return text.split(/[\s,]+/)
        .filter((p) => p.trim().length > 0)
        .map((p) => '#' + p.trim().toLowerCase().replace(/[^\w]/g, ''))
        .join(' ');
}

async function formatCodeAsync(text, fmt) {
    if (state.settings.minify) return SanFormat.minify(text, fmt);
    if (SanFormat.supports(fmt)) return SanFormat.format(text, fmt, { indent: state.settings.indentSize });
    return trimTrailingWhitespace(text);
}

async function formatContent() {
    const tab = activeTab();
    if (!ed || !tab || tab.isMedia) return;
    const text = state.content;
    if (!text.trim()) {
        showToast('Editor is empty', 'error');
        return;
    }

    const fmt = state.format;
    let formatted = text;
    try {
        if (CODE_FORMATS.includes(fmt)) {
            showToast('Formatting...', 'info');
            formatted = await formatCodeAsync(text, fmt);
        } else if (fmt === 'passage') {
            formatted = cleanText(formatPassage(text));
        } else if (fmt === 'hashtag') {
            formatted = formatHashtag(text);
        } else if (fmt === 'base64-enc') {
            formatted = btoa(unescape(encodeURIComponent(text)));
        } else if (fmt === 'base64-dec') {
            formatted = decodeURIComponent(escape(atob(text)));
        } else if (fmt === 'url-enc') {
            formatted = encodeURIComponent(text);
        } else if (fmt === 'url-dec') {
            formatted = decodeURIComponent(text);
        } else {
            formatted = cleanText(text);
        }
    } catch (err) {
        reportFormatError(err, fmt);
        return;
    }

    if (formatted === text) {
        showToast('Already formatted', 'info');
        return;
    }
    ed.setValue(formatted);
    syncContentFromEditor();
    saveToHistory(formatted, fmt, `Formatted ${state.fileName}`);
    updateStats();
    if (state.previewVisible) refreshPreview();
    showToast('Formatting successful', 'success');
}

function reportFormatError(err, fmt) {
    if (fmt === 'base64-dec') { showToast('Invalid Base64 string', 'error'); return; }
    if (fmt === 'url-dec') { showToast('Invalid URL encoded string', 'error'); return; }
    const msg = String(err && err.message ? err.message : err).split('\n')[0].replace(/\s*\(\d+:\d+\)\s*$/, '');
    const loc = err && (err.loc && err.loc.start ? err.loc.start : null);
    if (loc && ed) ed.goTo(loc.line, loc.column);
    else if (err instanceof SyntaxError && fmt === 'json') {
        const m = /position (\d+)/.exec(err.message);
        if (m && ed) {
            const before = state.content.slice(0, parseInt(m[1], 10)).split('\n');
            ed.goTo(before.length, before[before.length - 1].length + 1);
        }
    }
    showToast(`${fmt === 'json' ? 'Invalid JSON' : 'Syntax error'}: ${msg}`.slice(0, 160), 'error');
}

function performLineOp(op) {
    if (!ed) return;
    const text = state.content;
    if (!text.trim()) return;

    let lines = text.split('\n');
    if (op === 'sort-asc') lines.sort((a, b) => a.localeCompare(b));
    else if (op === 'sort-desc') lines.sort((a, b) => b.localeCompare(a));
    else if (op === 'reverse') lines.reverse();
    else if (op === 'unique') lines = [...new Set(lines)];

    ed.setValue(lines.join('\n'));
    showToast('Line operation applied (Ctrl+Z to undo)', 'success');
    saveToHistory(state.content, state.format, `Line Op: ${op}`);
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
function markTabSaved(tab) {
    if (!tab) return;
    tab.dirty = false;
    if (ed && ed.hasDoc(tab.id) && !tab.isMedia) ed.markSaved(tab.id);
    renderTabs();
    persistSession();
}

async function downloadFile() {
    const tab = activeTab();
    if (tab && !tab.isMedia) syncContentFromEditor();

    if (tab && tab.nativeUri && window.SanNative && SanNative.available) {
        try {
            await SanNative.writeText(tab.nativeUri, tab.content);
            markTabSaved(tab);
            showToast(`Saved ${tab.name}`, 'success');
        } catch (e) {
            showToast(`Save failed: ${e.message}`, 'error');
        }
        return;
    }
    if (tab && tab.workspacePath && state.workspace) {
        markTabSaved(tab);
        showToast(`Saved ${tab.name} to the workspace (use "Download Workspace ZIP" to export)`, 'success');
        return;
    }
    await downloadActiveFileCopy();
}

async function downloadActiveFileCopy() {
    const tab = activeTab();
    if (!tab || tab.isMedia) return;
    const content = state.content;
    if (!content) {
        showToast('Editor is empty', 'error');
        return;
    }
    let baseName = tab.name.includes('.') ? tab.name.split('.').slice(0, -1).join('.') : tab.name;
    if (baseName === 'untitled') baseName = 'formatted_code';
    const finalName = tab.name.includes('.') ? tab.name : `${baseName}.${extForFormat(state.format)}`;

    saveToHistory(content, state.format, `Saved ${finalName}`);
    await saveTextFile(content, finalName, 'text/plain');
    markTabSaved(tab);
}

/** Save a text file: native Downloads on Android, an <a download> everywhere else. */
async function saveTextFile(text, fileName, mime) {
    if (window.SanNative && SanNative.available) {
        try {
            await SanNative.downloadText(text, fileName, mime || 'text/plain');
        } catch (e) {
            showToast(`Save failed: ${e.message}`, 'error');
        }
        return;
    }
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Saved ${fileName}`, 'info');
}

// ---------------------------------------------------------------------------
// Settings / theme / wrap
// ---------------------------------------------------------------------------
function saveSettings() {
    if (typeof syncWorkbenchSettings === 'function') syncWorkbenchSettings();
    saveJson(SETTINGS_KEY, {
        theme: state.theme,
        format: state.format,
        sidebarWidth: state.sidebarWidth,
        settings: state.settings,
    });
}

function loadSettings() {
    const parsed = loadJson(SETTINGS_KEY, null);
    if (!parsed || typeof parsed !== 'object') {
        if (window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches) state.settings.wordWrap = true;
        return;
    }
    state.theme = ['theme-dark', 'theme-light', 'theme-monokai'].includes(parsed.theme) ? parsed.theme : 'theme-dark';
    if (els.themeSelect) els.themeSelect.value = state.theme;
    if (parsed.sidebarWidth) state.sidebarWidth = parsed.sidebarWidth;

    if (parsed.settings && typeof parsed.settings === 'object') {
        state.settings = Object.assign({}, state.settings, parsed.settings);
        if (els.indentSelect) els.indentSelect.value = state.settings.indentSize || '4';
        if (els.chkMinify) els.chkMinify.checked = !!state.settings.minify;
        if (els.chkTrim) els.chkTrim.checked = !!state.settings.trim;
        if (els.chkSpaces) els.chkSpaces.checked = !!state.settings.removeSpaces;
        if (els.chkLines) els.chkLines.checked = !!state.settings.removeLines;
    }
    updateStatusSpaces();
}

function applyTheme() {
    if (els.themeSelect) els.themeSelect.value = state.theme;
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-monokai');
    document.body.classList.add(state.theme);
    document.documentElement.classList.toggle('dark', state.theme !== 'theme-light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.theme === 'theme-light' ? '#f0f4f2' : (state.theme === 'theme-monokai' ? '#272822' : '#202322'));
    if (ed) ed.setDark(state.theme !== 'theme-light');
}

function toggleWordWrap() {
    state.settings.wordWrap = !state.settings.wordWrap;
    applyWordWrap();
    saveSettings();
    showToast(`Word Wrap: ${state.settings.wordWrap ? 'ON' : 'OFF'}`, 'info');
}

function applyWordWrap() {
    if (ed) ed.setWordWrap(state.settings.wordWrap);
    const wrapStatus = $('status-word-wrap');
    if (wrapStatus) wrapStatus.textContent = `Wrap: ${state.settings.wordWrap ? 'On' : 'Off'}`;
}

function toggleEditorSetting(key, label, apply) {
    state.settings[key] = !state.settings[key];
    if (ed) ed[apply](state.settings[key]);
    saveSettings();
    showToast(`${label}: ${state.settings[key] ? 'ON' : 'OFF'}`, 'info');
}

function jumpToChange(dir) {
    if (!ed) return;
    if (!ed.changeStep(dir)) showToast('No changes since last save', 'info');
}

function showChangeSummary() {
    if (!ed) return;
    const d = ed.diffInfo();
    showToast(d.hunks ? `${d.hunks} change${d.hunks === 1 ? '' : 's'} since save: +${d.added} ~${d.modified} -${d.removed} lines` : 'No changes since last save', 'info');
}

function changeFontSize(delta) {
    if (!ed) return;
    ed.setFontSize(ed.getFontSize() + delta);
}

async function copyToClipboard() {
    if (state.wordVisible) {
        showToast('Use standard copy (Ctrl+C) for rich text', 'info');
        return;
    }
    const text = (ed && ed.getSelection()) || state.content;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
    } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showToast('Copied to clipboard!', 'success');
        } catch (e2) {
            showToast('Failed to copy', 'error');
        }
        document.body.removeChild(ta);
    }
}

function showToast(message, type = 'info') {
    const container = $('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const colors = {
        success: 'bg-vs-sidebar border-green-500 text-vs-text',
        error: 'bg-vs-sidebar border-red-500 text-vs-text',
        info: 'bg-vs-sidebar border-vs-accent text-vs-text',
    };
    const icons = {
        success: 'fa-check text-green-500',
        error: 'fa-bug text-red-500',
        info: 'fa-info-circle text-vs-accent',
    };
    const kind = colors[type] ? type : 'info';

    toast.className = `flex items-center gap-3 px-4 py-2 rounded shadow-lg border-l-4 transform translate-y-10 opacity-0 transition-all duration-200 text-xs ${colors[kind]} z-[9999]`;
    const icon = document.createElement('i');
    icon.className = `fa-solid ${icons[kind]}`;
    const span = document.createElement('span');
    span.textContent = message;
    toast.append(icon, span);

    while (container.children.length >= 2) container.firstElementChild.remove();
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-10', 'opacity-0'));

    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, type === 'error' ? 4500 : 3000);
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------
function textEditorActive() {
    return !state.wordVisible && !state.excelVisible && !state.assetExplorerVisible;
}

function handleGlobalKeydown(e) {
    const mod = e.ctrlKey || e.metaKey;
    const key = (e.key || '').toLowerCase();

    if (mod && e.shiftKey && key === 'p' || key === 'f1') {
        e.preventDefault();
        openPalette('commands');
    } else if (mod && !e.shiftKey && key === 'p') {
        e.preventDefault();
        openPalette('files');
    } else if (mod && e.shiftKey && key === 'f') {
        e.preventDefault();
        openPalette('search');
    } else if (mod && e.shiftKey && key === 'e') {
        e.preventDefault();
        switchSidebarTab('explorer');
    } else if (mod && e.shiftKey && key === 'x') {
        e.preventDefault();
        switchSidebarTab('tools');
    } else if (mod && key === 's') {
        e.preventDefault();
        if (state.wordVisible) exportWordHtml();
        else if (state.excelVisible) exportSheetCSV();
        else downloadFile();
    } else if (mod && key === 'n') {
        e.preventDefault();
        if (state.wordVisible) clearWordDoc();
        else if (state.excelVisible) initSpreadsheet();
        else createNewFile();
    } else if (mod && key === 'o') {
        e.preventDefault();
        $('file-input').click();
    } else if (mod && key === 'b') {
        e.preventDefault();
        toggleSidebar();
    } else if (mod && key === 'f' && !e.shiftKey && ed && textEditorActive()) {
        e.preventDefault();
        ed.exec('find');
    } else if (e.altKey && key === 'w') {
        e.preventDefault();
        closeEditorTab(state.activeTabId);
    } else if (e.altKey && key === 'z') {
        e.preventDefault();
        toggleWordWrap();
    } else if (e.altKey && key === 'p') {
        e.preventDefault();
        toggleHtmlPreview();
    } else if (mod && (key === '=' || key === '+')) {
        e.preventDefault();
        changeFontSize(1);
    } else if (mod && key === '-') {
        e.preventDefault();
        changeFontSize(-1);
    } else if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        if (state.tabs[idx]) switchEditorTab(state.tabs[idx].id);
    }
}

// ---------------------------------------------------------------------------
// One-time import of data saved by builds before 2.0 (they ran from file://, a different storage origin)
// ---------------------------------------------------------------------------
const LEGACY_FLAG = 'sancode_legacy_import_done';
const LEGACY_KEYS = [
    'vscode_sanstudio_history', 'sanstudio_vscode_config', 'wa_templates',
    'vscode_sanstudio_keep_notes', 'vscode_sanstudio_todo_tasks', 'pwa_modal_dismissed',
];

/** Returns how many entries were imported. Existing data in the new storage is never overwritten. */
function importLegacyData(json) {
    let data;
    try { data = JSON.parse(json); } catch (e) { return 0; }
    if (!data || typeof data !== 'object') return 0;
    let imported = 0;
    LEGACY_KEYS.forEach((key) => {
        const value = data[key];
        if (typeof value !== 'string' || value === '') return;
        try {
            if (localStorage.getItem(key) === null) {
                JSON.parse(value); // every migrated value is JSON except the PWA flag
                localStorage.setItem(key, value);
                imported++;
            }
        } catch (e) {
            if (key === 'pwa_modal_dismissed' && localStorage.getItem(key) === null) localStorage.setItem(key, value);
        }
    });
    return imported;
}

async function migrateLegacyStorage() {
    if (!(window.SanNative && SanNative.available)) return;
    try {
        if (localStorage.getItem(LEGACY_FLAG) === '1') return;
        const json = await SanNative.legacyData();
        const count = json ? importLegacyData(json) : 0;
        localStorage.setItem(LEGACY_FLAG, '1');
        if (json) await SanNative.legacyDone();
        if (count > 0) {
            // app.js read the templates at load time, before this import
            msgTemplates = loadJson('wa_templates', null) || msgTemplates;
            setTimeout(() => showToast(`Restored ${count} saved item${count === 1 ? '' : 's'} from the previous version`, 'success'), 800);
        }
    } catch (e) {
        /* try again on the next launch */
    }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    await migrateLegacyStorage();
    loadSettings();
    applyTheme();
    initEditor();

    const session = restoreSession();
    applyWordWrap();
    updateStatusSpaces();

    renderTabs();
    switchEditorTab(state.activeTabId);

    loadHistoryToSidebar();
    initSpreadsheet();
    renderKeepNotes();
    initTodoTasks();
    initSignaturePad();
    switchSidebarTab('workspace');
    initMobile();

    document.addEventListener('keydown', handleGlobalKeydown);

    const videoPlayer = $('mini-video-player');
    const visualizerBars = $('visualizer-bars');
    if (videoPlayer) {
        videoPlayer.addEventListener('ended', () => {
            if (currentVideoIndex !== -1 && currentVideoIndex + 1 < videoQueue.length) playVideo(currentVideoIndex + 1);
        });
        videoPlayer.addEventListener('play', () => { if (visualizerBars) visualizerBars.classList.remove('paused'); });
        videoPlayer.addEventListener('pause', () => { if (visualizerBars) visualizerBars.classList.add('paused'); });
    }

    if (els.formatSelect) {
        els.formatSelect.addEventListener('change', (e) => {
            state.format = e.target.value;
            const tab = activeTab();
            if (tab) tab.format = state.format;
            if (ed) ed.setLanguage(state.format);
            updateUIForFormat();
            saveSettings();
            updateStats();
            updateFileDisplay();
            renderTabs();
            persistSession();
            if (state.previewVisible) refreshPreview();
        });
    }

    if (els.themeSelect) {
        els.themeSelect.addEventListener('change', (e) => {
            state.theme = e.target.value;
            applyTheme();
            saveSettings();
        });
    }

    if (els.wordCanvas) {
        els.wordCanvas.addEventListener('input', () => { if (state.wordVisible) updateStats(); });
    }

    if (els.indentSelect) els.indentSelect.addEventListener('change', (e) => { state.settings.indentSize = e.target.value; if (ed) ed.setIndent(e.target.value); updateStatusSpaces(); saveSettings(); });
    if (els.chkMinify) els.chkMinify.addEventListener('change', (e) => { state.settings.minify = e.target.checked; saveSettings(); });
    if (els.chkTrim) els.chkTrim.addEventListener('change', (e) => { state.settings.trim = e.target.checked; saveSettings(); });
    if (els.chkSpaces) els.chkSpaces.addEventListener('change', (e) => { state.settings.removeSpaces = e.target.checked; saveSettings(); });
    if (els.chkLines) els.chkLines.addEventListener('change', (e) => { state.settings.removeLines = e.target.checked; saveSettings(); });

    setupGlobalDragAndDrop();
    initSidebarResizer();
    if (typeof initWorkspace === 'function') initWorkspace(session);
    if (typeof initPreviewUi === 'function') initPreviewUi();
});

// Entry points for the Android host (MainActivity)
window.SanApp = {
    persist() { syncContentFromEditor(); persistSession(); },
    onBack() { return typeof handleBackAction === 'function' ? handleBackAction() : false; },
};
