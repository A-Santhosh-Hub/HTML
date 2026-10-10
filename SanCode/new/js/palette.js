/*
 * palette.js - command palette (Ctrl+Shift+P), quick open (Ctrl+P), search in files (Ctrl+Shift+F),
 * the mobile extra-keys row, soft-keyboard detection and the Android back button.
 */

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
function editorCommand(name) { return () => { if (ed) ed.exec(name); }; }

function buildCommands() {
    const native = !!(window.SanNative && SanNative.available);
    const cmds = [
        { title: 'File: New File', keys: 'Ctrl+N', run: createNewFile },
        { title: 'File: Open File...', keys: 'Ctrl+O', run: () => $('file-input').click() },
        { title: 'File: Open Folder...', run: openFolder },
        { title: 'File: Save', keys: 'Ctrl+S', run: downloadFile },
        { title: 'File: Download a Copy', run: downloadActiveFileCopy },
        { title: 'File: Close Tab', keys: 'Alt+W', run: () => closeEditorTab(state.activeTabId) },
        { title: 'File: Download Workspace as ZIP', run: downloadWorkspaceZip },
        { title: 'Edit: Format Document', keys: 'Ctrl+Enter', run: formatContent },
        { title: 'Edit: Find / Replace', keys: 'Ctrl+F', run: editorCommand('find') },
        { title: 'Edit: Go to Line...', keys: 'Ctrl+G', run: editorCommand('gotoLine') },
        { title: 'Edit: Toggle Line Comment', keys: 'Ctrl+/', run: editorCommand('toggleComment') },
        { title: 'Edit: Select Next Occurrence (multi-cursor)', keys: 'Ctrl+D', run: editorCommand('selectNextOccurrence') },
        { title: 'Edit: Move Line Up', keys: 'Alt+Up', run: editorCommand('moveLineUp') },
        { title: 'Edit: Move Line Down', keys: 'Alt+Down', run: editorCommand('moveLineDown') },
        { title: 'Edit: Duplicate Line', keys: 'Shift+Alt+Down', run: editorCommand('copyLineDown') },
        { title: 'Edit: Delete Line', keys: 'Ctrl+Shift+K', run: editorCommand('deleteLine') },
        { title: 'Edit: Undo', keys: 'Ctrl+Z', run: editorCommand('undo') },
        { title: 'Edit: Redo', keys: 'Ctrl+Y', run: editorCommand('redo') },
        { title: 'Edit: Select All', keys: 'Ctrl+A', run: editorCommand('selectAll') },
        { title: 'Edit: Copy', run: copyToClipboard },
        { title: 'Edit: Go to Matching Bracket', keys: 'Ctrl+Shift+\\', run: editorCommand('matchingBracket') },
        { title: 'Edit: Select All Occurrences of Selection', run: editorCommand('selectAllMatches') },
        { title: 'Edit: Toggle Block Comment', run: editorCommand('toggleBlockComment') },
        { title: 'Changes: Go to Next Change', keys: 'Alt+F3', run: () => jumpToChange(1) },
        { title: 'Changes: Go to Previous Change', keys: 'Shift+Alt+F3', run: () => jumpToChange(-1) },
        { title: 'Changes: Summary Since Last Save', run: showChangeSummary },
        { title: 'Edit: Fold All', run: editorCommand('foldAll') },
        { title: 'Edit: Unfold All', run: editorCommand('unfoldAll') },
        { title: 'Lines: Sort Ascending', run: () => performLineOp('sort-asc') },
        { title: 'Lines: Sort Descending', run: () => performLineOp('sort-desc') },
        { title: 'Lines: Reverse', run: () => performLineOp('reverse') },
        { title: 'Lines: Remove Duplicates', run: () => performLineOp('unique') },
        { title: 'View: Toggle Sidebar', keys: 'Ctrl+B', run: toggleSidebar },
        { title: 'View: Toggle Word Wrap', keys: 'Alt+Z', run: toggleWordWrap },
        { title: 'View: Toggle Live Preview', keys: 'Alt+P', run: toggleHtmlPreview },
        { title: 'View: Toggle Indent Guides', run: () => toggleEditorSetting('indentGuides', 'Indent Guides', 'setGuides') },
        { title: 'View: Toggle Bracket Pair Colors', run: () => toggleEditorSetting('rainbowBrackets', 'Bracket Pair Colors', 'setRainbow') },
        { title: 'View: Toggle Render Whitespace', run: () => toggleEditorSetting('renderWhitespace', 'Render Whitespace', 'setWhitespace') },
        { title: 'Media: Play / Pause', run: () => MiniPlayer.toggle() },
        { title: 'Media: Next Track', run: () => MiniPlayer.next() },
        { title: 'Media: Previous Track', run: () => MiniPlayer.prev() },
        { title: 'Media: Stop and Close Mini Player', run: () => MiniPlayer.stop() },
        { title: 'Media: Open Media Tool', run: () => MiniPlayer.open() },
        { title: 'View: Toggle Preview Console', run: togglePreviewConsole },
        { title: 'View: Toggle Mobile / Desktop Preview', run: toggleDevicePreview },
        { title: 'View: Open Preview Full Screen', run: launchPreviewInNewTab },
        { title: 'View: Increase Font Size', keys: 'Ctrl+=', run: () => changeFontSize(1) },
        { title: 'View: Decrease Font Size', keys: 'Ctrl+-', run: () => changeFontSize(-1) },
        { title: 'View: Show Explorer', keys: 'Ctrl+Shift+E', run: () => switchSidebarTab('explorer') },
        { title: 'View: Show Tools', keys: 'Ctrl+Shift+X', run: () => switchSidebarTab('tools') },
        { title: 'Search: Find in Files', keys: 'Ctrl+Shift+F', run: () => openPalette('search') },
        { title: 'Language: Change Language Mode...', run: () => openPalette('langs') },
        { title: 'Theme: Dark+', run: () => setThemeFromPalette('theme-dark') },
        { title: 'Theme: Light+', run: () => setThemeFromPalette('theme-light') },
        { title: 'Theme: Monokai', run: () => setThemeFromPalette('theme-monokai') },
        { title: 'Indent: 2 Spaces', run: () => setIndentFromPalette('2') },
        { title: 'Indent: 4 Spaces', run: () => setIndentFromPalette('4') },
        { title: 'Indent: 8 Spaces', run: () => setIndentFromPalette('8') },
        { title: 'Indent: Tabs', run: () => setIndentFromPalette('tab') },
    ];
    if (state.workspace && state.workspace.native) cmds.push({ title: 'Workspace: Refresh Folder', run: refreshWorkspace });
    if (native) cmds.push({ title: 'File: Open External Link...', run: () => { const u = prompt('URL to open', 'https://'); if (u) SanNative.openExternal(u); } });
    return cmds;
}

function setThemeFromPalette(theme) {
    state.theme = theme;
    if (els.themeSelect) els.themeSelect.value = theme;
    applyTheme();
    saveSettings();
}

function setIndentFromPalette(size) {
    state.settings.indentSize = size;
    if (els.indentSelect) els.indentSelect.value = size;
    if (ed) ed.setIndent(size);
    updateStatusSpaces();
    saveSettings();
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const palette = { open: false, mode: 'files', items: [], index: 0, searchToken: 0, returnFocus: false };

function fuzzyScore(query, text) {
    if (!query) return 1;
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    const direct = t.indexOf(q);
    if (direct !== -1) return 1000 - direct - t.length * 0.01;
    let ti = 0;
    let score = 0;
    let last = -2;
    for (let qi = 0; qi < q.length; qi++) {
        const found = t.indexOf(q[qi], ti);
        if (found === -1) return 0;
        score += found === last + 1 ? 8 : 1;
        last = found;
        ti = found + 1;
    }
    return score;
}

function openPalette(mode) {
    const box = $('palette');
    const input = $('palette-input');
    if (!box || !input) return;
    palette.open = true;
    palette.mode = mode;
    box.classList.remove('hidden');
    box.classList.add('flex');
    input.value = mode === 'commands' ? '>' : (mode === 'search' ? '?' : (mode === 'langs' ? '@' : ''));
    input.placeholder = mode === 'search' ? 'Search in files...' : mode === 'langs' ? 'Select language mode' : 'Go to file  (type > for commands, ? to search)';
    updatePalette();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
}

function closePalette() {
    const box = $('palette');
    if (!box) return;
    palette.open = false;
    palette.searchToken++;
    box.classList.add('hidden');
    box.classList.remove('flex');
    if (ed && !isTouchDevice()) ed.focus();
}

function paletteQuery() {
    const raw = $('palette-input').value;
    const first = raw.charAt(0);
    if (first === '>') return { mode: 'commands', q: raw.slice(1).trim() };
    if (first === '?') return { mode: 'search', q: raw.slice(1) };
    if (first === '@') return { mode: 'langs', q: raw.slice(1).trim() };
    return { mode: 'files', q: raw.trim() };
}

function updatePalette() {
    const { mode, q } = paletteQuery();
    palette.mode = mode;
    palette.index = 0;
    palette.searchToken++;

    if (mode === 'commands') {
        palette.items = buildCommands()
            .map((c) => ({ c, s: fuzzyScore(q, c.title) }))
            .filter((x) => x.s > 0)
            .sort((a, b) => b.s - a.s)
            .map((x) => ({ icon: 'fa-solid fa-angle-right', label: x.c.title, hint: x.c.keys || '', run: x.c.run }));
    } else if (mode === 'langs') {
        palette.items = Object.keys(LANGS)
            .filter((k) => CODE_FORMATS.includes(k) || k === 'txt' || k === 'csv')
            .map((k) => ({ k, s: fuzzyScore(q, LANGS[k].label) }))
            .filter((x) => x.s > 0)
            .sort((a, b) => b.s - a.s)
            .map((x) => ({ icon: LANGS[x.k].icon, label: LANGS[x.k].label, hint: '.' + LANGS[x.k].ext, run: () => setLanguageMode(x.k) }));
    } else if (mode === 'search') {
        runPaletteSearch(q);
        return;
    } else {
        const files = [];
        if (state.workspace) Object.keys(state.workspace.files).forEach((p) => files.push({ path: p, open: false }));
        const openPaths = new Set(state.tabs.filter((t) => t.workspacePath).map((t) => t.workspacePath));
        files.forEach((f) => { f.open = openPaths.has(f.path); });
        palette.items = files
            .map((f) => ({ f, s: fuzzyScore(q, f.path) + (f.open ? 0.5 : 0) }))
            .filter((x) => x.s > 0)
            .sort((a, b) => b.s - a.s)
            .slice(0, 80)
            .map((x) => ({ icon: fileIcon(x.f.path.split('/').pop(), state.workspace.files[x.f.path]), label: x.f.path.split('/').pop(), hint: x.f.path, run: () => openWorkspaceFile(x.f.path) }));
        // open tabs that are not workspace files
        state.tabs.filter((t) => !t.workspacePath && fuzzyScore(q, t.name) > 0).forEach((t) => {
            palette.items.push({ icon: langInfo(t.format).icon, label: t.name, hint: 'open editor', run: () => switchEditorTab(t.id) });
        });
    }
    renderPalette();
}

function renderPalette(message) {
    const list = $('palette-list');
    if (!list) return;
    if (!palette.items.length) {
        list.innerHTML = `<div class="palette-empty">${escapeHtml(message || (palette.mode === 'files' && !state.workspace ? 'Open a folder to search its files' : 'No results'))}</div>`;
        return;
    }
    list.innerHTML = palette.items.map((it, i) => `
        <div class="palette-item${i === palette.index ? ' active' : ''}" data-i="${i}">
            <i class="${it.icon || 'fa-solid fa-file'} palette-icon"></i>
            <span class="palette-label">${escapeHtml(it.label)}</span>
            <span class="palette-hint">${escapeHtml(it.hint || '')}</span>
        </div>`).join('');
    const active = list.querySelector('.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
}

async function runPaletteSearch(q) {
    const token = palette.searchToken;
    palette.items = [];
    if (!state.workspace) { renderPalette('Open a folder to search in files'); return; }
    if (q.length < 2) { renderPalette('Type at least 2 characters'); return; }
    renderPalette('Searching...');
    await new Promise((r) => setTimeout(r, 250));
    if (token !== palette.searchToken) return;
    try {
        await searchWorkspace(q, { caseSensitive: false, regex: false }, (hit) => {
            if (token !== palette.searchToken) return;
            palette.items.push({
                icon: 'fa-solid fa-magnifying-glass',
                label: hit.text || '(blank line)',
                hint: `${hit.path}:${hit.line}`,
                run: () => openWorkspaceFile(hit.path, { line: hit.line, col: hit.col }),
            });
            if (palette.items.length % 10 === 1) renderPalette();
        }, () => token !== palette.searchToken);
        if (token === palette.searchToken) renderPalette(palette.items.length ? undefined : 'No matches');
    } catch (e) {
        renderPalette(e.message);
    }
}

function setLanguageMode(fmt) {
    const tab = activeTab();
    if (!tab || tab.isMedia) return;
    state.format = fmt;
    tab.format = fmt;
    if (els.formatSelect && [...els.formatSelect.options].some((o) => o.value === fmt)) els.formatSelect.value = fmt;
    if (ed) ed.setLanguage(fmt);
    updateUIForFormat();
    updateFileDisplay();
    renderTabs();
    persistSession();
    if (state.previewVisible) refreshPreview();
}

function runPaletteItem(i) {
    const item = palette.items[i];
    if (!item) return;
    closePalette();
    setTimeout(() => item.run(), 20);
}

document.addEventListener('DOMContentLoaded', () => {
    const input = $('palette-input');
    const list = $('palette-list');
    if (input) {
        input.addEventListener('input', updatePalette);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); palette.index = Math.min(palette.index + 1, palette.items.length - 1); renderPalette(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); palette.index = Math.max(palette.index - 1, 0); renderPalette(); }
            else if (e.key === 'Enter') { e.preventDefault(); runPaletteItem(palette.index); }
            else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
        });
    }
    if (list) {
        list.addEventListener('click', (e) => {
            const row = e.target.closest('.palette-item');
            if (row) runPaletteItem(parseInt(row.dataset.i, 10));
        });
    }
});

// ---------------------------------------------------------------------------
// Mobile extra-keys row
// ---------------------------------------------------------------------------
function ekInsert(text) { if (ed) ed.insertText(text); }
function ekPair(open, close) { if (ed) ed.insertPair(open, close); }
function ekExec(name) { if (ed) ed.exec(name); }

let maxViewportHeight = window.innerHeight;
window.addEventListener('resize', () => {
    if (window.innerHeight > maxViewportHeight) maxViewportHeight = window.innerHeight;
    const open = isTouchDevice() && maxViewportHeight - window.innerHeight > 140;
    document.body.classList.toggle('kbd-open', open);
    if (ed) {
        ed.measure();
        if (open && ed.hasFocus()) setTimeout(() => ed.scrollToCursor(), 120);
    }
});

// ---------------------------------------------------------------------------
// Android back button (called from MainActivity through window.SanApp.onBack)
// ---------------------------------------------------------------------------
function handleBackAction() {
    if (palette.open) { closePalette(); return true; }

    const confirmModal = $('confirm-modal');
    if (confirmModal && !confirmModal.classList.contains('hidden')) {
        const no = $('confirm-no');
        if (no) no.click();
        return true;
    }
    const modal = [...document.querySelectorAll('[id$="-modal"]')].find((m) => !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        return true;
    }
    if (ed && document.querySelector('.cm-search')) { ed.exec('closeFind'); return true; }

    const menu = $('mobile-hamburger-menu');
    if (menu && menu.classList.contains('show')) { closeMobileHamburger(); return true; }
    const drawer = $('mobile-tool-drawer');
    if (drawer && drawer.classList.contains('open')) { closeMobileToolDrawer(); return true; }
    if (isMobile() && state.sidebarVisible) { closeMobileSidebar(); return true; }
    if (isMobile() && state.previewVisible) { toggleHtmlPreview(); return true; }
    if ($('ws-context-menu')) { hideWorkspaceMenu(); return true; }
    return false;
}
