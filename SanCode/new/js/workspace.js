/*
 * workspace.js - folder explorer.
 *  - Android app: real folders through the system file picker (SAF); edits are written back to the folder.
 *  - Browsers / drag-and-drop: files are read into memory (webkitdirectory); "Save" keeps changes in the workspace.
 * Workspace model: state.workspace = { name, native, treeUri, dirs: {path: uri}, version, openDirs: Set,
 *                                     files: { path: { file?, uri?, size, type, isText, isMedia, blobUrl, content } } }
 */

const TEXT_EXT = new Set(('txt md markdown json jsonc html htm css scss less js mjs cjs jsx ts tsx c h cpp cc cxx hpp py pyw java kt kts gradle ' +
    'xml svg yaml yml sh bash zsh sql csv tsv env gitignore gitattributes editorconfig properties ini toml lock log cfg conf bat cmd ps1 rb go rs php swift ' +
    'dart vue svelte webmanifest map pro mk cmake txt').split(/\s+/));
const TEXT_NAMES = new Set(['dockerfile', 'makefile', 'license', 'readme', 'procfile', 'gemfile', 'rakefile']);
const SKIP_PATH = /(^|\/)(node_modules|\.git)(\/|$)/;
const MIME_BY_EXT = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    ico: 'image/x-icon', bmp: 'image/bmp', avif: 'image/avif', mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
    wav: 'audio/wav', ogg: 'audio/ogg', pdf: 'application/pdf', json: 'application/json', html: 'text/html', css: 'text/css',
    js: 'text/javascript', txt: 'text/plain', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', wasm: 'application/wasm',
};
const MAX_OPEN_TEXT_BYTES = 12 * 1024 * 1024;

function fileExt(name) {
    const i = name.lastIndexOf('.');
    return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

function guessMime(name, mime) {
    if (mime && mime !== 'application/octet-stream') return mime;
    return MIME_BY_EXT[fileExt(name)] || 'application/octet-stream';
}

function isTextFile(name, mime) {
    const base = name.toLowerCase();
    if (TEXT_EXT.has(fileExt(base)) || TEXT_NAMES.has(base)) return true;
    return !!mime && (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/javascript' || mime === 'application/xml');
}

function isViewableMedia(mime) {
    return !!mime && (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/') || mime === 'application/pdf');
}

function newWorkspace(name, native, treeUri) {
    const prev = state.workspace;
    if (prev) Object.values(prev.files).forEach((f) => { if (f.blobUrl && !native) { try { URL.revokeObjectURL(f.blobUrl); } catch (e) { /* ignore */ } } });
    return { name, native: !!native, treeUri: treeUri || null, dirs: {}, files: {}, version: ((prev && prev.version) || 0) + 1, openDirs: new Set() };
}

function showWorkspaceUi() {
    $('workspace-empty-state').classList.add('hidden');
    const container = $('workspace-tree-container');
    container.classList.remove('hidden');
    container.classList.add('flex');
    $('workspace-root-name').textContent = state.workspace.name;
    renderWorkspaceTree();
    updateWorkspaceHighlight();
}

// ---------------------------------------------------------------------------
// Opening folders
// ---------------------------------------------------------------------------
async function openFolder() {
    if (!(window.SanNative && SanNative.available)) {
        $('folder-input').click();
        return;
    }
    try {
        const res = await SanNative.pickFolder();
        if (res.cancelled) return;
        showToast('Loading folder...', 'info');
        applyNativeScan(res);
        showToast(`Opened ${res.name} (${Object.keys(state.workspace.files).length} files)${res.truncated ? ' - list truncated' : ''}`, 'success');
    } catch (e) {
        showToast(`Could not open folder: ${e.message}`, 'error');
    }
}

function applyNativeScan(res) {
    const old = state.workspace && state.workspace.native && state.workspace.treeUri === res.treeUri ? state.workspace : null;
    const ws = newWorkspace(res.name, true, res.treeUri);
    res.dirs.forEach((d) => { ws.dirs[d.p] = d.u; });
    res.files.forEach((f) => {
        const name = f.p.split('/').pop();
        const type = guessMime(name, f.m);
        const prev = old && old.files[f.p];
        ws.files[f.p] = {
            uri: f.u, size: f.s, type,
            isText: isTextFile(name, type), isMedia: isViewableMedia(type),
            blobUrl: prev && prev.uri === f.u ? prev.blobUrl : null,
            content: prev && prev.uri === f.u ? prev.content : null,
        };
    });
    if (old) ws.openDirs = old.openDirs;
    state.workspace = ws;
    showWorkspaceUi();
    // keep open tabs pointing at the right documents
    state.tabs.forEach((t) => {
        if (t.workspacePath && ws.files[t.workspacePath]) t.nativeUri = ws.files[t.workspacePath].uri;
    });
}

async function refreshWorkspace() {
    const ws = state.workspace;
    if (!ws || !ws.native) return;
    try {
        applyNativeScan(await SanNative.scanFolder(ws.treeUri));
    } catch (e) {
        showToast(`Refresh failed: ${e.message}`, 'error');
    }
}

async function handleFolderSelection(files) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files).filter((f) => !SKIP_PATH.test(f.customPath || f.webkitRelativePath || f.name));
    if (fileArray.length === 0) return;

    const firstPath = fileArray[0].customPath || fileArray[0].webkitRelativePath || fileArray[0].name;
    const rootName = firstPath.includes('/') ? firstPath.split('/')[0] : 'Project';
    const ws = newWorkspace(rootName, false);

    fileArray.forEach((file) => {
        const filePath = file.customPath || file.webkitRelativePath || file.name;
        let path = filePath.startsWith(rootName + '/') ? filePath.substring(rootName.length + 1) : filePath;
        if (!path) return;
        const type = guessMime(file.name, file.type);
        ws.files[path] = {
            file, size: file.size, type,
            isText: isTextFile(file.name, type), isMedia: isViewableMedia(type),
            blobUrl: URL.createObjectURL(file), content: null,
        };
    });

    state.workspace = ws;
    showWorkspaceUi();
    showToast(`Loaded workspace: ${rootName} (${Object.keys(ws.files).length} files)`, 'success');
}

async function initWorkspace(session) {
    const tree = $('workspace-tree-content');
    if (tree) {
        tree.addEventListener('click', onTreeClick);
        tree.addEventListener('contextmenu', onTreeContextMenu);
        tree.addEventListener('toggle', onTreeToggle, true);
        tree.addEventListener('touchstart', onTreeTouchStart, { passive: true });
        tree.addEventListener('touchmove', cancelTreeLongPress, { passive: true });
        tree.addEventListener('touchend', cancelTreeLongPress, { passive: true });
    }
    document.addEventListener('click', hideWorkspaceMenu);

    if (window.SanNative && SanNative.available) {
        try {
            const res = await SanNative.restoreFolder();
            if (res && !res.none) {
                applyNativeScan(res);
                const paths = (session && session.workspaceTabs ? session.workspaceTabs : []).filter((p) => state.workspace.files[p]).slice(0, 12);
                for (const p of paths) await openWorkspaceFile(p);
                if (session && session.activeWorkspacePath && state.workspace.files[session.activeWorkspacePath]) {
                    await openWorkspaceFile(session.activeWorkspacePath);
                }
            }
        } catch (e) {
            /* no previous folder or permission revoked */
        }
    }
}

// ---------------------------------------------------------------------------
// Tree rendering
// ---------------------------------------------------------------------------
function buildTree(paths) {
    const root = { dirs: {}, files: {} };
    paths.forEach((path) => {
        const parts = path.split('/');
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
            node = node.dirs[parts[i]] || (node.dirs[parts[i]] = { dirs: {}, files: {} });
        }
        node.files[parts[parts.length - 1]] = path;
    });
    // folders created through the app that are still empty
    Object.keys(state.workspace.dirs).forEach((dir) => {
        if (!dir) return;
        let node = root;
        dir.split('/').forEach((part) => { node = node.dirs[part] || (node.dirs[part] = { dirs: {}, files: {} }); });
    });
    return root;
}

function fileIcon(name, fileObj) {
    const ext = fileExt(name);
    const fmt = EXT_TO_FORMAT[ext];
    if (fmt && fmt !== 'txt') return langInfo(fmt).icon;
    if (fileObj && fileObj.type.startsWith('image/')) return 'fa-solid fa-image text-green-400';
    if (fileObj && fileObj.type.startsWith('video/')) return 'fa-solid fa-film text-purple-400';
    if (fileObj && fileObj.type.startsWith('audio/')) return 'fa-solid fa-music text-pink-400';
    if (ext === 'pdf') return 'fa-solid fa-file-pdf text-red-400';
    return 'fa-solid fa-file-lines text-vs-textMuted';
}

function renderWorkspaceTree() {
    if (!state.workspace) return;
    const ws = state.workspace;
    const tree = buildTree(Object.keys(ws.files));

    function build(node, prefix, depth) {
        let html = '';
        Object.keys(node.dirs).sort((a, b) => a.localeCompare(b)).forEach((name) => {
            const path = prefix + name;
            const open = depth === 0 || ws.openDirs.has(path);
            html += `
                <details class="tree-node ml-2" data-dir="${escapeHtml(path)}"${open ? ' open' : ''}>
                    <summary class="ws-row hover:bg-vs-hover py-1 px-1 rounded flex items-center text-vs-textMuted hover:text-vs-text transition-colors">
                        <i class="fa-solid fa-folder text-blue-400 mx-1 text-xs"></i><span class="truncate">${escapeHtml(name)}</span>
                    </summary>
                    <div class="ml-1 border-l border-vs-border/50 pl-1">${build(node.dirs[name], path + '/', depth + 1)}</div>
                </details>`;
        });
        Object.keys(node.files).sort((a, b) => a.localeCompare(b)).forEach((name) => {
            const path = node.files[name];
            html += `
                <div class="ws-row ws-file ml-2 hover:bg-vs-hover py-1 px-1 rounded flex items-center cursor-pointer text-vs-textMuted hover:text-vs-text transition-colors truncate" data-path="${escapeHtml(path)}">
                    <i class="${fileIcon(name, ws.files[path])} mx-1 text-xs w-4 text-center"></i><span class="truncate">${escapeHtml(name)}</span>
                </div>`;
        });
        return html;
    }

    $('workspace-tree-content').innerHTML = build(tree, '', 0);
    updateWorkspaceHighlight();
}

function updateWorkspaceHighlight() {
    const container = $('workspace-tree-content');
    if (!container) return;
    const tab = activeTab();
    const active = tab && tab.workspacePath ? tab.workspacePath : null;
    container.querySelectorAll('.ws-file').forEach((el) => {
        el.classList.toggle('ws-active', el.dataset.path === active);
    });
}

function onTreeToggle(e) {
    const d = e.target;
    if (!d || !d.dataset || d.dataset.dir === undefined || !state.workspace) return;
    if (d.open) state.workspace.openDirs.add(d.dataset.dir);
    else state.workspace.openDirs.delete(d.dataset.dir);
}

let treeSuppressClick = false;
function onTreeClick(e) {
    if (treeSuppressClick) { treeSuppressClick = false; e.preventDefault(); return; }
    const row = e.target.closest('.ws-file');
    if (row) {
        openWorkspaceFile(row.dataset.path);
        if (isMobile()) closeMobileSidebar();
    }
}

// ---------------------------------------------------------------------------
// Context menu (right click / long press)
// ---------------------------------------------------------------------------
let treeLongPressTimer = null;

function onTreeTouchStart(e) {
    const t = e.touches[0];
    cancelTreeLongPress();
    treeLongPressTimer = setTimeout(() => {
        treeSuppressClick = true;
        showWorkspaceMenu(e.target, t.clientX, t.clientY);
    }, 500);
}

function cancelTreeLongPress() {
    clearTimeout(treeLongPressTimer);
    treeLongPressTimer = null;
}

function onTreeContextMenu(e) {
    e.preventDefault();
    showWorkspaceMenu(e.target, e.clientX, e.clientY);
}

function hideWorkspaceMenu() {
    const m = $('ws-context-menu');
    if (m) m.remove();
}

function showWorkspaceMenu(target, x, y) {
    hideWorkspaceMenu();
    if (!state.workspace) return;
    const fileRow = target.closest('.ws-file');
    const dirEl = target.closest('details[data-dir]');
    const path = fileRow ? fileRow.dataset.path : (dirEl ? dirEl.dataset.dir : '');
    const isFile = !!fileRow;
    const parentDir = isFile ? path.split('/').slice(0, -1).join('/') : path;
    const native = state.workspace.native;

    const items = [
        ['fa-file-circle-plus', 'New File', () => wsNewFile(parentDir)],
        native ? ['fa-folder-plus', 'New Folder', () => wsNewFolder(parentDir)] : null,
        path ? ['fa-pen', 'Rename', () => wsRename(path, isFile)] : null,
        path ? ['fa-trash', 'Delete', () => wsDelete(path, isFile)] : null,
        native ? ['fa-rotate', 'Refresh', () => refreshWorkspace()] : null,
    ].filter(Boolean);

    const menu = document.createElement('div');
    menu.id = 'ws-context-menu';
    menu.innerHTML = items.map((it, i) => `<button data-i="${i}"><i class="fa-solid ${it[0]}"></i>${it[1]}</button>`).join('');
    menu.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const b = ev.target.closest('button');
        hideWorkspaceMenu();
        if (b) items[parseInt(b.dataset.i, 10)][2]();
    });
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)) + 'px';
}

function promptName(title, value) {
    const name = (prompt(title, value || '') || '').trim();
    if (!name) return null;
    if (/[\\/:*?"<>|]/.test(name)) {
        showToast('Names cannot contain \\ / : * ? " < > |', 'error');
        return null;
    }
    return name;
}

async function wsNewFile(dir) {
    const ws = state.workspace;
    const name = promptName('New file name', 'untitled.txt');
    if (!name) return;
    const path = dir ? `${dir}/${name}` : name;
    if (ws.files[path]) { showToast('A file with that name already exists', 'error'); return; }
    try {
        const entry = { size: 0, type: guessMime(name), isText: true, isMedia: false, blobUrl: null, content: '' };
        if (ws.native) {
            const parentUri = ws.dirs[dir];
            if (!parentUri) throw new Error('Unknown folder');
            entry.uri = (await SanNative.createFile(parentUri, name)).uri;
        }
        ws.files[path] = entry;
        ws.version++;
        renderWorkspaceTree();
        await openWorkspaceFile(path);
    } catch (e) {
        showToast(`Could not create file: ${e.message}`, 'error');
    }
}

async function wsNewFolder(dir) {
    const ws = state.workspace;
    const name = promptName('New folder name', 'new-folder');
    if (!name) return;
    try {
        const parentUri = ws.dirs[dir];
        if (!parentUri) throw new Error('Unknown folder');
        await SanNative.createDir(parentUri, name);
        if (dir) ws.openDirs.add(dir);
        await refreshWorkspace();
    } catch (e) {
        showToast(`Could not create folder: ${e.message}`, 'error');
    }
}

async function wsRename(path, isFile) {
    const ws = state.workspace;
    const oldName = path.split('/').pop();
    const name = promptName('Rename to', oldName);
    if (!name || name === oldName) return;
    const parent = path.split('/').slice(0, -1).join('/');
    const newPath = parent ? `${parent}/${name}` : name;
    if (ws.files[newPath]) { showToast('That name is already used', 'error'); return; }
    try {
        if (ws.native) {
            const uri = isFile ? ws.files[path].uri : ws.dirs[path];
            await SanNative.rename(uri, name);
        }
        // remap open tabs and (for the in-memory workspace) the file table
        const prefix = path + '/';
        state.tabs.forEach((t) => {
            if (!t.workspacePath) return;
            if (isFile && t.workspacePath === path) {
                t.workspacePath = newPath;
                t.name = name;
                t.format = formatFromFilename(name);
                if (ed && ed.hasDoc(t.id)) ed.setDocLang(t.id, t.format);
            } else if (!isFile && t.workspacePath.startsWith(prefix)) t.workspacePath = newPath + '/' + t.workspacePath.slice(prefix.length);
        });
        if (!ws.native) {
            Object.keys(ws.files).forEach((p) => {
                if (p === path || p.startsWith(prefix)) {
                    ws.files[newPath + p.slice(path.length)] = ws.files[p];
                    delete ws.files[p];
                }
            });
            ws.version++;
            renderWorkspaceTree();
        } else {
            await refreshWorkspace();
        }
        const tab = activeTab();
        if (tab) { state.fileName = tab.name; state.format = tab.format; if (ed) ed.setLanguage(tab.format); }
        renderTabs();
    } catch (e) {
        showToast(`Rename failed: ${e.message}`, 'error');
    }
}

async function wsDelete(path, isFile) {
    const ws = state.workspace;
    const ok = await showConfirm(`Delete "${path}"${isFile ? '' : ' and everything inside it'}? ${ws.native ? 'This cannot be undone.' : ''}`);
    if (!ok) return;
    try {
        if (ws.native) await SanNative.remove(isFile ? ws.files[path].uri : ws.dirs[path]);
        const prefix = path + '/';
        const doomed = state.tabs.filter((t) => t.workspacePath && (t.workspacePath === path || t.workspacePath.startsWith(prefix)));
        for (const t of doomed) { t.dirty = false; await closeEditorTab(t.id); }
        if (ws.native) {
            await refreshWorkspace();
        } else {
            Object.keys(ws.files).forEach((p) => { if (p === path || p.startsWith(prefix)) delete ws.files[p]; });
            ws.version++;
            renderWorkspaceTree();
        }
    } catch (e) {
        showToast(`Delete failed: ${e.message}`, 'error');
    }
}

// ---------------------------------------------------------------------------
// Opening files
// ---------------------------------------------------------------------------
async function loadWorkspaceText(fileData) {
    if (fileData.content != null) return fileData.content;
    if (fileData.size > MAX_OPEN_TEXT_BYTES) throw new Error(`File is larger than ${MAX_OPEN_TEXT_BYTES / 1048576} MB`);
    fileData.content = fileData.file ? await fileData.file.text() : await SanNative.readText(fileData.uri);
    return fileData.content;
}

async function ensureWorkspaceBlobUrl(fileData) {
    if (fileData.blobUrl) return fileData.blobUrl;
    fileData.blobUrl = URL.createObjectURL(await nativeFileBlob(fileData));
    return fileData.blobUrl;
}

async function openWorkspaceFile(path, pos) {
    const ws = state.workspace;
    if (!ws || !ws.files[path]) return;
    const fileData = ws.files[path];

    const existing = state.tabs.find((t) => t.workspacePath === path);
    if (existing) {
        switchEditorTab(existing.id);
        if (pos && ed) ed.goTo(pos.line, pos.col || 1);
        return;
    }

    const name = path.split('/').pop();
    try {
        if (fileData.isText) {
            showToast(`Opening ${name}...`, 'info');
            const content = await loadWorkspaceText(fileData);
            openTextTab({ name, content, format: formatFromFilename(name), workspacePath: path, nativeUri: fileData.uri });
            if (pos && ed) ed.goTo(pos.line, pos.col || 1);
        } else if (fileData.isMedia) {
            const url = await ensureWorkspaceBlobUrl(fileData);
            const tab = { id: Date.now(), name, content: url, format: 'txt', workspacePath: path, isMedia: true, mediaType: fileData.type };
            state.tabs.push(tab);
            switchEditorTab(tab.id);
        } else {
            showToast(`${name} is a binary file and cannot be opened here`, 'info');
        }
    } catch (e) {
        showToast(`Could not open ${name}: ${e.message}`, 'error');
    }
}

// ---------------------------------------------------------------------------
// Search in files
// ---------------------------------------------------------------------------
async function searchWorkspace(query, opts, onResult, shouldCancel) {
    const ws = state.workspace;
    if (!ws || !query) return 0;
    let regex;
    try {
        regex = new RegExp(opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), opts.caseSensitive ? 'g' : 'gi');
    } catch (e) {
        throw new Error('Invalid regular expression');
    }
    const paths = Object.keys(ws.files).filter((p) => ws.files[p].isText && (ws.files[p].size || 0) <= 2 * 1024 * 1024);
    let found = 0;
    for (const path of paths) {
        if (shouldCancel && shouldCancel()) break;
        const f = ws.files[path];
        const open = state.tabs.find((t) => t.workspacePath === path);
        let text;
        try {
            text = open ? tabText(open) : await loadWorkspaceText(f);
        } catch (e) { continue; }
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            regex.lastIndex = 0;
            const m = regex.exec(lines[i]);
            if (m) {
                found++;
                onResult({ path, line: i + 1, col: m.index + 1, text: lines[i].trim().slice(0, 200) });
                if (found >= 500) return found;
            }
        }
    }
    return found;
}

// ---------------------------------------------------------------------------
// ZIP export
// ---------------------------------------------------------------------------
async function downloadWorkspaceZip() {
    if (!state.workspace) {
        showToast('No workspace loaded', 'error');
        return;
    }
    if (typeof JSZip === 'undefined') {
        showToast('ZIP library is not available', 'error');
        return;
    }

    syncContentFromEditor();
    showToast('Packaging workspace...', 'info');

    try {
        const zip = new JSZip();
        for (const [path, fileData] of Object.entries(state.workspace.files)) {
            if (fileData.isText && fileData.content != null) zip.file(path, fileData.content);
            else zip.file(path, await nativeFileBlob(fileData));
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const name = `${state.workspace.name}.zip`;
        if (window.SanNative && SanNative.available) await SanNative.downloadBlob(blob, name);
        else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        showToast('Workspace downloaded successfully', 'success');
    } catch (e) {
        console.error(e);
        showToast('Failed to create Workspace ZIP', 'error');
    }
}
