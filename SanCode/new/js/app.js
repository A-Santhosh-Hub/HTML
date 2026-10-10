// Video Player State
let videoQueue = [];
let currentVideoIndex = -1;
let ytPlayerReady = false;
let ytPlayer = null;

// YouTube API Ready Callback
window.onYouTubeIframeAPIReady = function () {
    ytPlayerReady = true;
};

// --- Media Viewer Tab Logic ---

function toggleMediaView(show, type = '', url = '') {
    if (show) {
        els.textEditorWrapper.classList.add('hidden');
        els.mediaViewerWrapper.classList.remove('hidden');
        els.mediaViewerWrapper.classList.add('flex');

        els.mediaPreviewImg.classList.add('hidden');
        els.mediaPreviewVideo.classList.add('hidden');
        if (els.mediaPreviewPdf) els.mediaPreviewPdf.classList.add('hidden');

        els.mediaPreviewVideo.pause();

        if (type.startsWith('image/')) {
            els.mediaPreviewImg.src = url;
            els.mediaPreviewImg.classList.remove('hidden');
        } else if (type.startsWith('video/') || type.startsWith('audio/')) {
            els.mediaPreviewVideo.src = url;
            els.mediaPreviewVideo.classList.remove('hidden');
        } else if (type === 'application/pdf' || type === 'pdf') {
            if (els.mediaPreviewPdf) {
                els.mediaPreviewPdf.src = url;
                els.mediaPreviewPdf.classList.remove('hidden');
            }
        }

        els.mediaPreviewInfo.textContent = `${state.fileName} (${type})`;
    } else {
        els.mediaViewerWrapper.classList.add('hidden');
        els.mediaViewerWrapper.classList.remove('flex');
        els.textEditorWrapper.classList.remove('hidden');
        els.mediaPreviewVideo.pause();
        if (els.mediaPreviewPdf) els.mediaPreviewPdf.src = 'about:blank';
    }
}

// --- Mini Media Player Logic ---

function handleVideoSelection(files) {
    if (!files || files.length === 0) return;

    const newMedia = Array.from(files).filter(f =>
        f.type.startsWith('video/') ||
        f.type.startsWith('audio/') ||
        f.name.match(/\.(mp4|webm|ogg|mov|mkv|avi|mp3|wav|flac|m4a|aac)$/i)
    );

    if (newMedia.length === 0) {
        showToast('Please select valid video or audio files', 'error');
        return;
    }

    newMedia.forEach(file => {
        videoQueue.push({
            type: 'local',
            file: file,
            url: URL.createObjectURL(file),
            name: file.name,
            isAudio: file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)
        });
    });

    renderVideoQueue();

    if (currentVideoIndex === -1 && videoQueue.length > 0) {
        playVideo(videoQueue.length - newMedia.length);
    } else if (currentVideoIndex === -1) {
        playVideo(0);
    }
    showToast(`Added ${newMedia.length} media file(s) to queue`, 'success');
}

function addYouTubeVideo() {
    const input = document.getElementById('yt-url-input');
    if (!input) return;
    const url = input.value.trim();
    if (!url) {
        showToast('Please paste a YouTube link', 'error');
        return;
    }

    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(ytRegex);

    if (match && match[1]) {
        const videoId = match[1];
        videoQueue.push({
            type: 'youtube',
            ytId: videoId,
            name: `YouTube Video (${videoId})`,
            isAudio: false
        });

        input.value = '';
        renderVideoQueue();

        if (currentVideoIndex === -1) {
            playVideo(videoQueue.length - 1);
        }
        showToast('Added YouTube video to queue', 'success');
    } else {
        showToast('Invalid YouTube URL', 'error');
    }
}

function renderVideoQueue() {
    const listEl = document.getElementById('video-queue-list');
    if (!listEl) return;

    if (videoQueue.length === 0) {
        listEl.innerHTML = `<div class="text-[10px] text-vs-textMuted italic p-2 text-center bg-vs-editor/50 rounded">Queue is empty</div>`;
        if (window.MiniPlayer) MiniPlayer.update();
        return;
    }

    listEl.innerHTML = videoQueue.map((media, idx) => {
        const isActive = idx === currentVideoIndex;
        let icon = media.isAudio ? '<i class="fa-solid fa-music"></i>' : '<i class="fa-solid fa-film"></i>';
        if (media.type === 'youtube') icon = '<i class="fa-brands fa-youtube text-red-500"></i>';

        return `
            <div class="flex items-center justify-between p-2 rounded text-[10px] ${isActive ? 'bg-vs-selection text-white border border-vs-accent' : 'bg-vs-editor text-vs-textMuted hover:bg-vs-hover cursor-pointer border border-vs-border'}" onclick="playVideo(${idx})">
                <div class="flex items-center gap-2 truncate flex-1 pr-2">
                    ${isActive ? '<i class="fa-solid fa-play text-vs-accent"></i>' : `<span class="opacity-50 w-3 text-center">${icon}</span>`}
                    <span class="truncate" title="${escapeHtml(media.name)}">${escapeHtml(media.name)}</span>
                </div>
                <button onclick="removeVideo(${idx}, event)" class="w-5 h-5 flex items-center justify-center hover:text-red-400 hover:bg-black/20 rounded transition-colors shrink-0">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    }).join('');
    if (window.MiniPlayer) MiniPlayer.update();
}

function playVideo(index) {
    const player = document.getElementById('mini-video-player');
    const ytWrapper = document.getElementById('yt-player-wrapper');
    const placeholder = document.getElementById('video-placeholder');
    const visualizer = document.getElementById('audio-visualizer');

    if (!player || !placeholder || !visualizer || !ytWrapper) return;

    if (index < 0 || index >= videoQueue.length) {
        player.src = '';
        if (ytPlayer && typeof ytPlayer.stopVideo === 'function') ytPlayer.stopVideo();

        placeholder.classList.remove('hidden');
        visualizer.classList.add('hidden');
        visualizer.classList.remove('flex');
        player.classList.remove('hidden');
        ytWrapper.classList.add('hidden');

        player.style.backgroundColor = 'black';
        player.style.height = '100%';

        currentVideoIndex = -1;
        renderVideoQueue();
        return;
    }

    currentVideoIndex = index;
    const currentMedia = videoQueue[index];
    placeholder.classList.add('hidden');

    if (currentMedia.type === 'youtube') {
        player.pause();
        player.classList.add('hidden');
        visualizer.classList.add('hidden');
        visualizer.classList.remove('flex');
        ytWrapper.classList.remove('hidden');

        if (!ytPlayer && !ytPlayerReady) {
            showToast('The YouTube player could not load - check your internet connection', 'error');
        }
        if (!ytPlayer && ytPlayerReady) {
            ytPlayer = new YT.Player('youtube-player', {
                height: '100%',
                width: '100%',
                videoId: currentMedia.ytId,
                playerVars: { 'autoplay': 1, 'controls': 1, 'playsinline': 1, 'origin': location.origin },
                events: {
                    'onReady': function () { if (window.MiniPlayer) MiniPlayer.update(); },
                    'onStateChange': function (event) {
                        if (window.MiniPlayer) MiniPlayer.update();
                        if (event.data == YT.PlayerState.ENDED) {
                            if (currentVideoIndex !== -1 && currentVideoIndex + 1 < videoQueue.length) {
                                playVideo(currentVideoIndex + 1);
                            }
                        }
                    }
                }
            });
        } else if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(currentMedia.ytId);
        }
    } else {
        if (ytPlayer && typeof ytPlayer.stopVideo === 'function') ytPlayer.stopVideo();
        ytWrapper.classList.add('hidden');
        player.classList.remove('hidden');

        player.src = currentMedia.url;

        if (currentMedia.isAudio) {
            visualizer.classList.remove('hidden');
            visualizer.classList.add('flex');
            player.style.height = '40px';
            player.style.marginTop = 'auto';
            player.style.backgroundColor = 'transparent';
        } else {
            visualizer.classList.add('hidden');
            visualizer.classList.remove('flex');
            player.style.height = '100%';
            player.style.marginTop = '0';
            player.style.backgroundColor = 'black';
        }

        player.play().catch(e => console.error("Autoplay prevented:", e));
    }
    renderVideoQueue();
}

function removeVideo(index, event) {
    if (event) event.stopPropagation();
    if (videoQueue[index].type === 'local') URL.revokeObjectURL(videoQueue[index].url);
    videoQueue.splice(index, 1);

    if (index === currentVideoIndex) {
        playVideo(index < videoQueue.length ? index : -1);
    } else if (index < currentVideoIndex) {
        currentVideoIndex--;
    }
    renderVideoQueue();
}

function clearVideoQueue() {
    videoQueue.forEach(v => {
        if (v.type === 'local') URL.revokeObjectURL(v.url);
    });
    videoQueue = [];
    playVideo(-1);
    showToast('Media queue cleared', 'info');
}

// --- Layout & Resize UI Interactions ---

function initSidebarResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    if (!resizer || !els.sidebar) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        let newWidth = e.clientX - els.sidebar.getBoundingClientRect().left;
        if (newWidth < 160) newWidth = 160;
        if (newWidth > 600) newWidth = 600;
        els.sidebar.style.width = newWidth + 'px';
        state.sidebarWidth = newWidth;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            saveSettings();
        }
    });

    if (state.sidebarVisible) {
        els.sidebar.style.width = state.sidebarWidth + 'px';
    }
}

function isMobile() {
    return window.innerWidth < 768;
}

function toggleSidebar() {
    // On mobile, use overlay behavior
    if (isMobile()) {
        if (state.sidebarVisible) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
        return;
    }

    state.sidebarVisible = !state.sidebarVisible;
    const titleContainer = document.getElementById('sidebar-title')?.parentElement;
    const resizer = document.getElementById('sidebar-resizer');

    if (state.sidebarVisible) {
        if (els.sidebar) els.sidebar.style.width = state.sidebarWidth + 'px';
        if (els.sidebar) els.sidebar.classList.add('border-r');
        if (resizer) resizer.style.display = 'block';
        if (titleContainer) titleContainer.style.display = 'flex';
    } else {
        if (els.sidebar) els.sidebar.style.width = '0px';
        if (els.sidebar) els.sidebar.classList.remove('border-r');
        if (resizer) resizer.style.display = 'none';
        if (titleContainer) titleContainer.style.display = 'none';

        ['workspace', 'explorer', 'tools', 'word', 'snippets', 'devkit', 'extractor', 'formatter', 'contact-links', 'drive-extractor', 'qr-generator', 'todo', 'doc-tools', 'excel', 'video', 'settings', 'templates'].forEach(id => {
            const btn = document.getElementById(`activity-${id}`);
            const border = document.getElementById(`activity-${id}-border`);
            if (btn && btn.classList) btn.classList.replace('text-vs-activityActive', 'text-vs-activityInactive');
            if (border && border.classList) border.classList.replace('bg-vs-accent', 'bg-transparent');
        });
    }
}

function switchSidebarTab(tab) {
    // On mobile: always show sidebar as overlay
    if (isMobile()) {
        state.sidebarTab = tab;
        openMobileSidebar();
    } else {
        if (state.sidebarTab === tab && state.sidebarVisible) {
            toggleSidebar();
            return;
        }
        if (!state.sidebarVisible) toggleSidebar();
    }

    state.sidebarTab = tab;

    const tabs = ['workspace', 'explorer', 'tools', 'word', 'snippets', 'devkit', 'extractor', 'formatter', 'contact-links', 'drive-extractor', 'qr-generator', 'yt-thumbnail', 'keep-notes', 'asset-explorer', 'todo', 'doc-tools', 'excel', 'video', 'settings', 'templates'];
    const titles = {
        'workspace': 'Files',
        'explorer': 'Explorer',
        'tools': 'Format Tools & Settings',
        'word': 'Word Processor',
        'snippets': 'Code Snippets',
        'devkit': 'Developer Kit',
        'extractor': 'Pro Web Extractor',
        'formatter': 'IN Number Formatter',
        'contact-links': 'Contact Link Generator',
        'drive-extractor': 'Google Drive ID Extractor',
        'qr-generator': 'QR Code Generator',
        'yt-thumbnail': 'Pro YouTube & Web Downloader',
        'keep-notes': 'Notes',
        'asset-explorer': 'Web Asset Explorer',
        'todo': 'Tasks',
        'doc-tools': 'Document Tools Suite',
        'excel': 'Excel Sheet Workspace',
        'video': 'Mini Media Player',
        'settings': 'Settings',
        'templates': 'Message Templates'
    };

    tabs.forEach(t => {
        const btn = document.getElementById(`activity-${t}`);
        const border = document.getElementById(`activity-${t}-border`);
        const panel = document.getElementById(`sidebar-${t}`);

        if (btn && btn.classList) btn.classList.replace('text-vs-activityActive', 'text-vs-activityInactive');
        if (border && border.classList) border.classList.replace('bg-vs-accent', 'bg-transparent');
        if (panel && panel.classList) panel.classList.add('hidden');
    });

    const targetBtn = document.getElementById(`activity-${tab}`);
    const targetBorder = document.getElementById(`activity-${tab}-border`);
    const targetPanel = document.getElementById(`sidebar-${tab}`);
    const titleEl = document.getElementById('sidebar-title');

    if (targetBtn && targetBtn.classList) targetBtn.classList.replace('text-vs-activityInactive', 'text-vs-activityActive');
    if (targetBorder && targetBorder.classList) targetBorder.classList.replace('bg-transparent', 'bg-vs-accent');
    if (targetPanel && targetPanel.classList) targetPanel.classList.remove('hidden');
    if (titleEl) titleEl.textContent = titles[tab] || tab;
    if (els.sidebar) els.sidebar.scrollTop = 0;
    document.getElementById('files-segments').hidden = !['workspace', 'explorer'].includes(tab);
    document.getElementById('notes-segments').hidden = !['keep-notes', 'todo'].includes(tab);
    document.querySelectorAll('.workspace-segments button').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.panel === tab));
    });
    if (isMobile()) setMobileDestination(tab === 'settings' ? 'settings' : tab === 'workspace' || tab === 'explorer' ? 'files' : tab === 'keep-notes' || tab === 'todo' ? 'notes' : 'tools');
}

function toggleAccordion(id) {
    const content = document.getElementById(id);
    const icon = document.getElementById('icon-' + id);
    if (content && content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        if (icon) icon.classList.add('-rotate-90');
    } else if (content) {
        content.classList.add('expanded');
        if (icon) icon.classList.remove('-rotate-90');
    }
}

// ===== MOBILE FUNCTIONS =====

function openMobileSidebar() {
    if (!els.sidebar) return;
    const titleContainer = document.getElementById('sidebar-title')?.parentElement;
    if (titleContainer) titleContainer.style.display = '';
    state.sidebarVisible = true;
    els.sidebar.classList.remove('mobile-hidden');
    els.sidebar.classList.add('mobile-visible');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    if (backdrop) backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    if (!els.sidebar) return;
    state.sidebarVisible = false;
    els.sidebar.classList.remove('mobile-visible');
    els.sidebar.classList.add('mobile-hidden');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    if (backdrop) backdrop.classList.remove('show');
    document.body.style.overflow = '';
    setMobileDestination('editor');
}

function setMobileDestination(target) {
    document.querySelectorAll('#mobile-bottom-nav button').forEach(btn => {
        const active = btn.id === 'mob-nav-' + target;
        btn.classList.toggle('active', active);
        if (active) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
    });
}

function filterToolCatalog(query) {
    renderToolCatalog(query);
}

function mobileNavSwitch(target) {
    closeMobileToolDrawer();
    closeMobileHamburger();
    // Update active state on bottom nav buttons
    const navBtns = document.querySelectorAll('#mobile-bottom-nav button');
    navBtns.forEach(btn => btn.classList.remove('active'));

    const targetBtn = document.getElementById('mob-nav-' + target);
    if (targetBtn) targetBtn.classList.add('active');

    switch (target) {
        case 'editor':
            closeMobileSidebar();
            break;
        case 'tools':
            closeMobileSidebar();
            toggleMobileToolDrawer();
            break;
        case 'files':
            switchSidebarTab('workspace');
            break;
        case 'notes':
            switchSidebarTab('keep-notes');
            break;
        case 'more':
            toggleMobileToolDrawer();
            break;
    }
}

function toggleMobileToolDrawer() {
    const drawer = document.getElementById('mobile-tool-drawer');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    if (!drawer) return;

    if (drawer.classList.contains('open')) {
        closeMobileToolDrawer();
    } else {
        // First show the element, then trigger the animation
        drawer.style.display = 'flex';
        backdrop.classList.add('show');
        // Force reflow before adding open class for animation
        drawer.offsetHeight;
        drawer.classList.add('open');
        setMobileDestination('tools');
        document.body.style.overflow = 'hidden';
        openCatalogFocus();
    }
}

function closeMobileToolDrawer() {
    const drawer = document.getElementById('mobile-tool-drawer');
    const backdrop = document.getElementById('mobile-drawer-backdrop');
    if (!drawer) return;

    if (drawer.classList.contains('open')) closeCatalogFocus();
    drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
    document.body.style.overflow = '';

    setMobileDestination(state.sidebarVisible ? (state.sidebarTab === 'workspace' || state.sidebarTab === 'explorer' ? 'files' : state.sidebarTab === 'keep-notes' || state.sidebarTab === 'todo' ? 'notes' : 'tools') : 'editor');

    // Hide after animation completes
    setTimeout(() => {
        if (!drawer.classList.contains('open')) {
            drawer.style.display = 'none';
        }
    }, 350);
}

function mobileOpenTool(toolName) {
    rememberTool(toolName);
    closeMobileToolDrawer();
    switchSidebarTab(toolName);
}

function toggleMobileHamburger() {
    const menu = document.getElementById('mobile-hamburger-menu');
    const backdrop = document.getElementById('mobile-hamburger-backdrop');
    if (!menu) return;

    if (menu.classList.contains('show')) {
        closeMobileHamburger();
    } else {
        menu.classList.add('show');
        if (backdrop) backdrop.style.display = 'block';
    }
}

function closeMobileHamburger() {
    const menu = document.getElementById('mobile-hamburger-menu');
    const backdrop = document.getElementById('mobile-hamburger-backdrop');
    if (menu) menu.classList.remove('show');
    if (backdrop) backdrop.style.display = 'none';
}

// Initialize mobile state on load
function initMobile() {
    // switchSidebarTab() opens the overlay on phones; start with the editor visible instead
    if (isMobile() && els.sidebar) closeMobileSidebar();
}

// Re-check on resize (e.g. rotating device)
window.addEventListener('resize', () => {
    if (isMobile()) {
        if (!state.sidebarVisible) {
            els.sidebar?.classList.add('mobile-hidden');
            els.sidebar?.classList.remove('mobile-visible');
        }
    } else {
        // Switching back to desktop: remove mobile classes
        els.sidebar?.classList.remove('mobile-hidden', 'mobile-visible');
        const backdrop = document.getElementById('mobile-sidebar-backdrop');
        if (backdrop) backdrop.classList.remove('show');
        document.body.style.overflow = '';

        // Restore sidebar width
        if (state.sidebarVisible && els.sidebar) {
            els.sidebar.style.width = state.sidebarWidth + 'px';
        }
    }
});

// --- History Logic ---

function saveToHistory(content, format, label = null) {
    if (!content || content.trim() === '' || content.length > 400000) return;

    let history = loadJson(HISTORY_KEY, []);
    if (!Array.isArray(history)) history = [];

    const newItem = {
        id: Date.now(),
        content: content,
        format: format,
        timestamp: new Date().toLocaleString(),
        label: label || `${format.toUpperCase()} Snippet`
    };

    history = history.filter(item => item.content !== content);
    history.unshift(newItem);
    if (history.length > 15) history.pop();

    // Drop the oldest entries until the history fits in storage
    while (history.length && !saveJson(HISTORY_KEY, history)) history.pop();
    loadHistoryToSidebar();
}

function loadHistoryToSidebar() {
    const stored = loadJson(HISTORY_KEY, []);
    const history = Array.isArray(stored) ? stored : [];
    const listContainer = document.getElementById('history-list');
    if (!listContainer) return;

    if (history.length === 0) {
        listContainer.innerHTML = `<div class="px-4 py-2 text-xs text-vs-textMuted opacity-50 italic">No timeline history.</div>`;
    } else {
        listContainer.innerHTML = history.map(item => `
            <div onclick='loadHistoryItem(${item.id})' class="flex items-center px-4 py-1.5 cursor-pointer hover:bg-vs-hover group relative">
                <i class="fa-solid fa-clock-rotate-left text-[10px] text-vs-textMuted mr-2"></i>
                <div class="flex flex-col flex-1 min-w-0">
                    <span class="text-xs text-vs-text truncate">${escapeHtml(item.label)}</span>
                    <span class="text-[9px] text-vs-textMuted truncate">${escapeHtml(item.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }
}

function loadHistoryItem(id) {
    const history = loadJson(HISTORY_KEY, []);
    const item = Array.isArray(history) ? history.find(i => i.id === id) : null;

    if (item) {
        let baseName = item.label.replace('Formatted ', '').replace('Saved ', '').replace('Opened ', '').replace(' Snippet', '').toLowerCase().replace(/\s+/g, '_');
        if (baseName === '') baseName = 'restored_file';

        openTextTab({ name: baseName, content: item.content, format: LANGS[item.format] ? item.format : 'txt' });
        showToast(`Restored to new tab: ${item.label}`, 'success');
    }
}

// Custom Confirm Logic
function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const btnYes = document.getElementById('confirm-yes');
        const btnNo = document.getElementById('confirm-no');

        if (!modal || !msgEl || !btnYes || !btnNo) {
            resolve(confirm(message));
            return;
        }

        msgEl.textContent = message;
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const cleanup = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            btnYes.onclick = null;
            btnNo.onclick = null;
        };

        btnYes.onclick = () => {
            cleanup();
            resolve(true);
        };

        btnNo.onclick = () => {
            cleanup();
            resolve(false);
        };
    });
}

async function clearHistory() {
    const proceed = await showConfirm('Clear all timeline history?');
    if (proceed) {
        localStorage.removeItem(HISTORY_KEY);
        loadHistoryToSidebar();
        showToast('Timeline cleared', 'info');
    }
}

// --- Snippets & DevKit Logic ---

const codeSnippets = {
    html5: `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Document</title>\n</head>\n<body>\n    \n</body>\n</html>`,
    tailwind: `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Tailwind Starter</title>\n    <script src="https://cdn.tailwindcss.com"><\/script>\n</head>\n<body class="bg-gray-100 text-gray-900 flex items-center justify-center h-screen">\n    <h1 class="text-4xl font-bold text-blue-600">Hello Tailwind!</h1>\n</body>\n</html>`,
    fetch: `// Async Fetch API Example\nasync function fetchData() {\n    try {\n        const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');\n        if (!response.ok) {\n            throw new Error('Network response was not ok');\n        }\n        const data = await response.json();\n        console.log(data);\n    } catch (error) {\n        console.error('Fetch error:', error);\n    }\n}\n\nfetchData();`,
    express: `const express = require('express');\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\n// Middleware\napp.use(express.json());\n\n// Basic Route\napp.get('/', (req, res) => {\n    res.json({ message: 'Hello World from Express!' });\n});\n\n// Start Server\napp.listen(PORT, () => {\n    console.log(\`Server is running on http://localhost:\${PORT}\`);\n});`,
    json: `[\n    {\n        "id": 1,\n        "name": "Item One",\n        "active": true\n    },\n    {\n        "id": 2,\n        "name": "Item Two",\n        "active": false\n    }\n]`
};

let msgTemplates = loadJson('wa_templates', null) || {
    consultation: `Hello!\nThank you for contacting ALP Astrology Teaching Company.\n\nHere are the details for our Astrology Consultation:\n- Detailed Horoscope Analysis\n- Career, Marriage, & Financial Guidance\n- Remedies for Doshas\n\nPlease reply with your Date, Time, and Place of Birth to book an appointment.\n\nContact our office at [Office Number] for more info.`,
    course: `Hello!\nThank you for your interest in the ALP Astrology Teaching Company.\n\nHere are the details for our Astrology Course:\n- Comprehensive curriculum covering basics to advanced predictive astrology.\n- Live online sessions.\n- Course Materials and Certification provided.\n\nNext batch starts soon! Reply here or call our office at [Office Number] to register.`,
    whyfeature: `Why do you need this feature?\n\nThis "Message Templates" feature allows you to quickly reply to common customer inquiries with standardized responses. You don't have to type out the same details repeatedly. Just click a template, and it inserts the full, professional response directly into your editor so you can customize and send it instantly!`
};

function insertTemplate(type) {
    const newId = Date.now();
    const format = 'txt';
    state.tabs.push({ id: newId, name: `template_${type}`, content: msgTemplates[type], format: format });
    switchEditorTab(newId);

    saveToHistory(msgTemplates[type], format, `Inserted ${type} template`);
    showToast('Template inserted into new tab', 'success');
}

function openTemplateEditor(key) {
    const modal = document.getElementById('template-edit-modal');
    document.getElementById('edit-template-key').value = key;
    document.getElementById('edit-template-content').value = msgTemplates[key];
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modal.classList.add('opacity-100');
}

function closeTemplateEditor() {
    const modal = document.getElementById('template-edit-modal');
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }, 300);
}

function saveTemplateEdit() {
    const key = document.getElementById('edit-template-key').value;
    const newContent = document.getElementById('edit-template-content').value;
    
    msgTemplates[key] = newContent;
    const saved = saveJson('wa_templates', msgTemplates);

    closeTemplateEditor();
    showToast(saved ? 'Template saved locally!' : 'Could not save template (storage full)', saved ? 'success' : 'error');
}

function sendToWhatsApp() {
    const number = document.getElementById('wa-number').value.replace(/[^0-9]/g, '');
    const message = document.getElementById('wa-message').value;

    if (!number) {
        showToast('Please enter a phone number', 'error');
        return;
    }
    if (!message) {
        showToast('Please enter a message to send', 'error');
        return;
    }

    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    showToast('Opening WhatsApp...', 'success');
}

function insertSnippet(type) {
    const newId = Date.now();
    let format = 'txt';
    if (type === 'html5' || type === 'tailwind') format = 'html';
    else if (type === 'fetch' || type === 'express') format = 'js';
    else if (type === 'json') format = 'json';

    state.tabs.push({ id: newId, name: `${type}_snippet`, content: codeSnippets[type], format: format });
    switchEditorTab(newId);

    saveToHistory(codeSnippets[type], format, `Inserted ${type} snippet`);
    showToast('Snippet inserted into new tab', 'success');
}

function generateDevKit(type) {
    let result = '';
    let formatTarget = 'txt';
    let label = '';

    if (type === 'uuid') {
        result = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        formatTarget = 'txt';
        label = 'uuid';
    }
    else if (type === 'lorem') {
        result = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nCurabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi. Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque.";
        formatTarget = 'passage';
        label = 'lorem_ipsum';
    }
    else if (type === 'mockUsers') {
        const users = [];
        const firstNames = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda"];
        const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];
        const domains = ["gmail.com", "yahoo.com", "outlook.com", "example.com"];

        for (let i = 1; i <= 5; i++) {
            const fname = firstNames[Math.floor(Math.random() * firstNames.length)];
            const lname = lastNames[Math.floor(Math.random() * lastNames.length)];
            const domain = domains[Math.floor(Math.random() * domains.length)];

            users.push({
                id: 1000 + i,
                uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }),
                name: `${fname} ${lname}`,
                email: `${fname.toLowerCase()}.${lname.toLowerCase()}@${domain}`,
                role: i === 1 ? "admin" : "user",
                isActive: Math.random() > 0.2
            });
        }
        result = JSON.stringify(users, null, 4);
        formatTarget = 'json';
        label = 'mock_users';
    }

    const newId = Date.now();
    state.tabs.push({ id: newId, name: label, content: result, format: formatTarget });
    switchEditorTab(newId);

    saveToHistory(result, formatTarget, `Generated ${label}`);
    showToast(`Generated ${label} into new tab`, 'success');
}

// --- File I/O ---

async function extractWebsite() {
    const urlInput = document.getElementById('website-url');
    const proxyToggle = document.getElementById('cors-bypass');
    const btnText = document.getElementById('extract-text');
    const btnIcon = document.getElementById('extract-icon');

    if (!urlInput || !btnText || !btnIcon || !proxyToggle || !ed) return;
    if (document.getElementById('extract-btn').disabled) return;

    let url = urlInput.value.trim();
    if (!url) return showToast("Enter a URL first", "error");
    try { url = SanWeb.normalizeUrl(url); } catch (error) { return showToast(error.message, 'error'); }
    urlInput.value = url;

    btnText.textContent = "Extracting...";
    btnIcon.className = "fa-solid fa-circle-notch fa-spin";
    document.getElementById('extract-btn').disabled = true;
    document.getElementById('extract-status').textContent = 'Fetching original page source…';

    try {
        const response = await SanWeb.fetchText(url, { html: true, allowProxy: proxyToggle.checked });
        const parsedHTML = response.text;
        url = response.url;
        if (parsedHTML) {

            let safeName = 'extracted_source';
            try {
                const host = new URL(url).hostname;
                safeName = host.replace('www.', '');
            } catch (e) { }

            const newId = Date.now();
            state.tabs.push({ id: newId, name: safeName + '.html', content: parsedHTML, format: 'html' });
            if (state.assetExplorerVisible) toggleAssetExplorerView(false);
            if (state.wordVisible) toggleWordView(false);
            if (state.excelVisible) toggleSpreadsheetView(false);
            toggleMediaView(false);
            if (state.previewVisible) toggleHtmlPreview();
            switchEditorTab(newId);

            saveToHistory(parsedHTML, 'html', `Extracted ${safeName}`);
            showToast(`Extracted source from ${url}`, "success");

            document.getElementById('extract-status').textContent = `Source opened in ${safeName}.html · ${response.transport} · HTTP ${response.status}`;
            if (isMobile()) closeMobileSidebar();

        } else {
            throw new Error("Unable to retrieve source. Site may block automated traffic.");
        }
    } catch (err) {
        document.getElementById('extract-status').textContent = err.message;
        showToast(err.message === "Failed to fetch" ? "Proxy Unavailable/Blocked" : err.message, "error");
    } finally {
        btnText.textContent = "Extract to Editor";
        btnIcon.className = "fa-solid fa-cloud-arrow-down";
        document.getElementById('extract-btn').disabled = false;
    }
}

function handleFileUpload(file, inputEl) {
    if (!file) return;
    if (inputEl) inputEl.value = ''; // allow picking the same file again

    const mime = file.type || '';
    if (isViewableMedia(mime)) {
        const tab = { id: Date.now(), name: file.name, content: URL.createObjectURL(file), format: 'txt', isMedia: true, mediaType: mime };
        state.tabs.push(tab);
        switchEditorTab(tab.id);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const formatTarget = formatFromFilename(file.name);
        openTextTab({ name: file.name, content: e.target.result, format: formatTarget });
        saveToHistory(e.target.result, formatTarget, `Opened ${file.name}`);

        if ((formatTarget === 'html' || formatTarget === 'md') && !state.previewVisible) toggleHtmlPreview();
        showToast(`Opened ${file.name}`, 'success');
    };
    reader.onerror = () => showToast(`Could not read ${file.name}`, 'error');
    reader.readAsText(file);
}

// --- IN Number Formatter Logic ---

function formatIndianNumbers() {
    const rawInput = document.getElementById('num-input');
    const addPrefix = document.getElementById('add-91-prefix');
    const outputEl = document.getElementById('num-output');
    const countEl = document.getElementById('num-count');

    if (!rawInput || !addPrefix || !outputEl || !countEl) return;

    if (!rawInput.value.trim()) {
        showToast('Please paste some numbers first', 'error');
        return;
    }

    const rawList = rawInput.value.split(/[\n,\s]+/);
    let cleanedNumbers = [];

    rawList.forEach(item => {
        let digitsOnly = item.replace(/\D/g, '');
        if (!digitsOnly) return;
        if (digitsOnly.startsWith('91') && digitsOnly.length === 12) digitsOnly = digitsOnly.substring(2);
        if (digitsOnly.startsWith('0') && digitsOnly.length === 11) digitsOnly = digitsOnly.substring(1);
        if (digitsOnly.length === 10) cleanedNumbers.push(digitsOnly);
    });

    cleanedNumbers = [...new Set(cleanedNumbers)];
    if (addPrefix.checked) cleanedNumbers = cleanedNumbers.map(num => '+91' + num);

    outputEl.value = cleanedNumbers.join('\n');
    countEl.textContent = `${cleanedNumbers.length} valid number${cleanedNumbers.length !== 1 ? 's' : ''}`;
    showToast(`Cleaned ${cleanedNumbers.length} unique numbers`, 'success');
}

function copyNumberOutput() {
    const outputEl = document.getElementById('num-output');
    if (!outputEl || !outputEl.value) {
        showToast('Nothing to copy', 'error');
        return;
    }
    outputEl.select();
    try {
        document.execCommand('copy');
        showToast('Copied numbers to clipboard!', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
    window.getSelection().removeAllRanges();
}

// --- Google Drive ID Extractor Logic ---

function extractDriveIDs() {
    const eventNameInput = document.getElementById('drive-event-name');
    const linksInput = document.getElementById('drive-links-input');
    const outputEl = document.getElementById('drive-output');

    if (!eventNameInput || !linksInput || !outputEl) return;

    const evName = eventNameInput.value.trim() || 'Event';
    const linksValue = linksInput.value.trim();

    if (!linksValue) {
        showToast('Please paste Google Drive links first', 'error');
        return;
    }

    const lines = linksValue.split(/[\n,\s]+/);
    const extractedData = [];
    let count = 1;

    const idRegex = /(?:\/d\/|id=)([-\w]{25,})/;

    lines.forEach(line => {
        const url = line.trim();
        if (!url) return;

        const match = url.match(idRegex);
        if (match && match[1]) {
            const paddedCount = count.toString().padStart(2, '0');
            extractedData.push(`{ id: "${match[1]}", name: "${evName} ${paddedCount}" }`);
            count++;
        }
    });

    if (extractedData.length === 0) {
        showToast('No valid Google Drive IDs found', 'error');
        outputEl.value = '';
        return;
    }

    outputEl.value = extractedData.join(',\n');
    showToast(`Extracted ${extractedData.length} IDs successfully`, 'success');
}

function copyDriveOutput() {
    const outputEl = document.getElementById('drive-output');
    if (!outputEl || !outputEl.value) {
        showToast('Nothing to copy', 'error');
        return;
    }
    outputEl.select();
    try {
        document.execCommand('copy');
        showToast('Copied Drive IDs to clipboard!', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
    window.getSelection().removeAllRanges();
}

function downloadDriveOutput(type) {
    const outputEl = document.getElementById('drive-output');
    const eventNameEl = document.getElementById('drive-event-name');
    if (!outputEl || !eventNameEl) return;

    const eventName = eventNameEl.value.trim() || 'gdrive_data';

    if (!outputEl.value) {
        showToast('No data to download', 'error');
        return;
    }

    let content = outputEl.value;
    let ext = 'js';

    if (type === 'json') {
        content = `[\n${content}\n]`.replace(/\{ id:/g, '{ "id":').replace(/, name:/g, ', "name":');
        ext = 'json';
    } else {
        content = `const data = [\n${content}\n];`;
    }

    const safeFileName = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const finalName = `${safeFileName}_data.${ext}`;

    const blob = new Blob([content], { type: type === 'json' ? 'application/json' : 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Downloaded ${finalName}`, 'success');
}

// --- Contact Link Generator Logic ---

function generateContactLinks() {
    const rawInputEl = document.getElementById('contact-numbers-input');
    const waMsgEl = document.getElementById('contact-wa-msg');
    const remove91El = document.getElementById('contact-remove-91');
    const outputEl = document.getElementById('contact-links-output');

    if (!rawInputEl || !waMsgEl || !remove91El || !outputEl) return;

    const rawInput = rawInputEl.value;
    const waMsg = waMsgEl.value.trim();
    const remove91 = remove91El.checked;

    if (!rawInput.trim()) {
        showToast('Please paste phone numbers first', 'error');
        return;
    }

    const rawList = rawInput.split(/[\n,\s]+/);
    let cleanedNumbers = [];

    rawList.forEach(item => {
        let digitsOnly = item.replace(/\D/g, '');
        if (!digitsOnly) return;
        if (remove91) {
            if (digitsOnly.startsWith('91') && digitsOnly.length === 12) digitsOnly = digitsOnly.substring(2);
            if (digitsOnly.startsWith('0') && digitsOnly.length === 11) digitsOnly = digitsOnly.substring(1);
        }
        if (digitsOnly.length === 10) cleanedNumbers.push(digitsOnly);
    });

    cleanedNumbers = [...new Set(cleanedNumbers)];

    if (cleanedNumbers.length === 0) {
        showToast('No valid 10-digit numbers found', 'error');
        outputEl.value = '';
        return;
    }

    let result = '';
    cleanedNumbers.forEach(num => {
        result += `${num}\n`;
        let waUrl = `https://wa.me/${num}`;
        if (waMsg) waUrl += `?text=${encodeURIComponent(waMsg)}`;
        result += `WhatsApp → ${waUrl}\n`;
        result += `Call → tel:${num}\n`;
        result += `Telegram → https://t.me/+${num}\n\n`;
    });

    outputEl.value = result.trim();
    showToast(`Generated links for ${cleanedNumbers.length} numbers`, 'success');
}

function copyContactLinks() {
    const outputEl = document.getElementById('contact-links-output');
    if (!outputEl || !outputEl.value) {
        showToast('Nothing to copy', 'error');
        return;
    }
    outputEl.select();
    try {
        document.execCommand('copy');
        showToast('Copied all links to clipboard!', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
    window.getSelection().removeAllRanges();
}

function downloadContactLinks() {
    const outputEl = document.getElementById('contact-links-output');
    if (!outputEl || !outputEl.value) {
        showToast('No links to download', 'error');
        return;
    }

    const blob = new Blob([outputEl.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'contact_links.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Downloaded contact_links.txt', 'success');
}

// --- QR Code Generator Logic ---

let currentQrLogo = null;
let activeQrCodes = [];

function handleQrLogoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentQrLogo = e.target.result;
            showToast('Logo loaded. Click Generate to apply.', 'info');
        };
        reader.readAsDataURL(file);
    } else {
        currentQrLogo = null;
    }
}

function generateQRCode() {
    const inputEl = document.getElementById('qr-input-text');
    const isBulkWaEl = document.getElementById('qr-bulk-whatsapp');
    const fgColorEl = document.getElementById('qr-color-fg');
    const bgColorEl = document.getElementById('qr-color-bg');
    const sizeEl = document.getElementById('qr-size');
    const previewContainer = document.getElementById('qr-preview-container');

    if (!inputEl || !isBulkWaEl || !fgColorEl || !bgColorEl || !sizeEl || !previewContainer) return;

    const input = inputEl.value;
    const isBulkWa = isBulkWaEl.checked;
    const fgColor = fgColorEl.value;
    const bgColor = bgColorEl.value;
    const size = parseInt(sizeEl.value);

    if (!input.trim()) {
        showToast('Please enter text or numbers', 'error');
        return;
    }

    previewContainer.innerHTML = '';
    activeQrCodes = [];
    let items = [];

    if (isBulkWa) {
        const rawList = input.split(/[\n,\s]+/);
        rawList.forEach(item => {
            let digitsOnly = item.replace(/\D/g, '');
            if (!digitsOnly) return;
            if (digitsOnly.startsWith('91') && digitsOnly.length === 12) digitsOnly = digitsOnly.substring(2);
            if (digitsOnly.startsWith('0') && digitsOnly.length === 11) digitsOnly = digitsOnly.substring(1);
            if (digitsOnly.length === 10) items.push(`https://wa.me/91${digitsOnly}`);
        });
        items = [...new Set(items)];
        if (items.length === 0) {
            showToast('No valid 10-digit numbers found for bulk WA', 'error');
            previewContainer.innerHTML = '<span class="text-vs-textMuted text-xs my-auto italic">Preview will appear here</span>';
            return;
        }
    } else {
        items.push(input.trim());
    }

    items.forEach((dataStr, index) => {
        const qrCode = new QRCodeStyling({
            width: size,
            height: size,
            data: dataStr,
            margin: 10,
            qrOptions: { typeNumber: 0, mode: "Byte", errorCorrectionLevel: "H" },
            imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 5 },
            dotsOptions: { type: "rounded", color: fgColor },
            backgroundOptions: { color: bgColor },
            image: currentQrLogo || undefined,
            cornersSquareOptions: { type: "extra-rounded", color: fgColor },
            cornersDotOptions: { type: "dot", color: fgColor }
        });

        activeQrCodes.push({ instance: qrCode, data: dataStr, index: index });

        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-center bg-white p-2 rounded shadow-md w-full';

        qrCode.append(wrapper);

        setTimeout(() => {
            const canvas = wrapper.querySelector('canvas') || wrapper.querySelector('svg');
            if (canvas) {
                canvas.style.width = '100%';
                canvas.style.height = 'auto';
                canvas.style.maxWidth = '180px';
                canvas.style.borderRadius = '8px';
            }
        }, 50);

        if (isBulkWa) {
            const label = document.createElement('span');
            label.className = 'text-vs-text text-[10px] mt-2 break-all text-center px-1 bg-vs-editor w-full rounded py-1';
            label.textContent = dataStr;
            wrapper.appendChild(label);
        }
        previewContainer.appendChild(wrapper);
    });

    showToast(`Generated ${items.length} QR Code(s)`, 'success');
}

async function downloadQRCodes(format) {
    if (activeQrCodes.length === 0) {
        showToast('Generate a QR code first', 'error');
        return;
    }

    if (activeQrCodes.length === 1) {
        activeQrCodes[0].instance.download({ name: "qr_code", extension: format });
        showToast(`Downloaded as ${format.toUpperCase()}`, 'success');
    } else {
        if (typeof JSZip === 'undefined') {
            showToast('ZIP library is missing', 'error');
            return;
        }
        const zip = new JSZip();
        showToast('Preparing ZIP file...', 'info');

        try {
            const promises = activeQrCodes.map(async (qrObj) => {
                const blob = await qrObj.instance.getRawData(format);
                const cleanName = qrObj.data.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
                zip.file(`qr_${cleanName}_${qrObj.index + 1}.${format}`, blob);
            });

            await Promise.all(promises);
            const content = await zip.generateAsync({ type: "blob" });

            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bulk_qr_codes.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('Downloaded Bulk ZIP Archive', 'success');
        } catch (e) {
            console.error(e);
            showToast('Error generating ZIP', 'error');
        }
    }
}

async function copyQRCode() {
    if (activeQrCodes.length === 0) {
        showToast('Generate a QR code first', 'error');
        return;
    }
    if (activeQrCodes.length > 1) {
        showToast('Cannot copy bulk QRs. Download ZIP instead.', 'error');
        return;
    }

    try {
        const blob = await activeQrCodes[0].instance.getRawData("png");
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        showToast('Copied QR Image to clipboard!', 'success');
    } catch (e) {
        console.error(e);
        showToast('Clipboard API failed. Try downloading instead.', 'error');
    }
}

// --- Spreadsheet Logic ---

let sheetData = [];
const defaultRows = 100;
const defaultCols = 26;

function toggleSpreadsheetView(showExcel) {
    state.excelVisible = showExcel;
    state.wordVisible = false;
    toggleMediaView(false);

    const textEditor = document.getElementById('text-editor-wrapper');
    const excelEditor = document.getElementById('excel-editor-wrapper');
    const wordEditor = document.getElementById('word-editor-wrapper');

    if (!textEditor || !excelEditor || !wordEditor) return;

    if (showExcel) {
        textEditor.classList.add('hidden');
        wordEditor.classList.add('hidden');
        wordEditor.classList.remove('flex');
        excelEditor.classList.remove('hidden');
        excelEditor.classList.add('flex');
    } else {
        textEditor.classList.remove('hidden');
        excelEditor.classList.add('hidden');
        excelEditor.classList.remove('flex');
        wordEditor.classList.add('hidden');
        wordEditor.classList.remove('flex');
    }
    updateFileDisplay();
}

function initSpreadsheet(rows = defaultRows, cols = defaultCols) {
    const container = document.getElementById('spreadsheet-container');
    if (!container) return;

    sheetData = Array.from({ length: rows }, () => Array(cols).fill(''));

    let html = '<table class="spreadsheet-table"><thead><tr><th class="spreadsheet-th spreadsheet-th-corner"></th>';
    for (let c = 0; c < cols; c++) html += `<th class="spreadsheet-th">${String.fromCharCode(65 + c)}</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
        html += `<tr><th class="spreadsheet-th spreadsheet-th-row">${r + 1}</th>`;
        for (let c = 0; c < cols; c++) {
            html += `<td class="spreadsheet-td"><input type="text" class="spreadsheet-input" data-row="${r}" data-col="${c}" value="" oninput="updateSheetData(${r}, ${c}, this.value)"></td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
    showToast('Spreadsheet grid initialized', 'info');
}

function updateSheetData(r, c, val) { sheetData[r][c] = val; }

function getCleanSheetData() {
    let maxRow = -1;
    let maxCol = -1;
    for (let r = 0; r < sheetData.length; r++) {
        for (let c = 0; c < sheetData[r].length; c++) {
            if (sheetData[r][c].trim() !== '') {
                if (r > maxRow) maxRow = r;
                if (c > maxCol) maxCol = c;
            }
        }
    }
    if (maxRow === -1) return [];
    let clean = [];
    for (let r = 0; r <= maxRow; r++) clean.push(sheetData[r].slice(0, maxCol + 1));
    return clean;
}

function exportSheetCSV() {
    const cleanData = getCleanSheetData();
    if (cleanData.length === 0) {
        showToast('Spreadsheet is empty', 'error');
        return;
    }
    let csv = cleanData.map(row =>
        row.map(cell => {
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
        }).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spreadsheet.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded spreadsheet.csv', 'success');
}

function copySheetToEditor() {
    const cleanData = getCleanSheetData();
    if (cleanData.length === 0) {
        showToast('Spreadsheet is empty', 'error');
        return;
    }
    let csv = cleanData.map(row =>
        row.map(cell => {
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
        }).join(',')
    ).join('\n');

    const newId = Date.now();
    state.tabs.push({ id: newId, name: 'spreadsheet_data', content: csv, format: 'txt' });
    switchEditorTab(newId);

    showToast('Data exported to new code editor tab successfully', 'success');
}

document.addEventListener('keydown', function (e) {
    if (state.excelVisible && e.target.classList.contains('spreadsheet-input')) {
        let r = parseInt(e.target.dataset.row);
        let c = parseInt(e.target.dataset.col);
        let nextInput;

        if (e.key === 'ArrowDown') nextInput = document.querySelector(`.spreadsheet-input[data-row="${r + 1}"][data-col="${c}"]`);
        else if (e.key === 'ArrowUp') nextInput = document.querySelector(`.spreadsheet-input[data-row="${r - 1}"][data-col="${c}"]`);
        else if (e.key === 'ArrowRight' && e.target.selectionEnd === e.target.value.length) nextInput = document.querySelector(`.spreadsheet-input[data-row="${r}"][data-col="${c + 1}"]`);
        else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) nextInput = document.querySelector(`.spreadsheet-input[data-row="${r}"][data-col="${c - 1}"]`);

        if (nextInput) {
            e.preventDefault();
            nextInput.focus();
        }
    }
});

// --- Word Processor Logic ---

function toggleWordView(showWord) {
    state.wordVisible = showWord;
    state.excelVisible = false;
    toggleMediaView(false);

    const textEditor = document.getElementById('text-editor-wrapper');
    const excelEditor = document.getElementById('excel-editor-wrapper');
    const wordEditor = document.getElementById('word-editor-wrapper');

    if (!textEditor || !wordEditor) return;

    if (showWord) {
        textEditor.classList.add('hidden');
        if (excelEditor) {
            excelEditor.classList.add('hidden');
            excelEditor.classList.remove('flex');
        }
        wordEditor.classList.remove('hidden');
        wordEditor.classList.add('flex');
    } else {
        textEditor.classList.remove('hidden');
        wordEditor.classList.add('hidden');
        wordEditor.classList.remove('flex');
        if (excelEditor) {
            excelEditor.classList.add('hidden');
            excelEditor.classList.remove('flex');
        }
    }
    updateFileDisplay();
}

function formatDoc(cmd, value = null) {
    if (els.wordCanvas) {
        els.wordCanvas.focus();
        document.execCommand(cmd, false, value);
    }
}

async function clearWordDoc() {
    if (els.wordCanvas && els.wordCanvas.innerHTML.trim() !== '') {
        const proceed = await showConfirm('Clear document? Unsaved changes will be lost.');
        if (proceed) {
            els.wordCanvas.innerHTML = '';
            updateStats();
            showToast('Document cleared', 'info');
        }
    }
}

function exportWordHtml() {
    if (!els.wordCanvas) return;
    const content = els.wordCanvas.innerHTML;
    if (!content.trim()) {
        showToast('Document is empty', 'error');
        return;
    }

    const html = `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>Document</title>\n<style>\n    body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; max-width: 210mm; margin: 0 auto; padding: 25.4mm; }\n    ul { list-style-type: disc; padding-left: 20px; }\n    ol { list-style-type: decimal; padding-left: 20px; }\n    h1 { font-size: 24pt; font-weight: bold; margin-bottom: 12pt; }\n    h2 { font-size: 18pt; font-weight: bold; margin-bottom: 10pt; }\n    h3 { font-size: 14pt; font-weight: bold; margin-bottom: 8pt; }\n</style>\n</head>\n<body>\n${content}\n</body>\n</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded document.html', 'success');
}

// --- Common Export Logic ---

async function downloadZip() {
    if (!state.content && !state.workspace) {
        showToast('Editor is empty', 'error');
        return;
    }
    if (typeof JSZip === 'undefined') {
        showToast('ZIP library is loading...', 'error');
        return;
    }

    const extMap = { 'txt': 'txt', 'md': 'md', 'json': 'json', 'html': 'html', 'css': 'css', 'js': 'js', 'c': 'c', 'py': 'py', 'passage': 'txt', 'youtube': 'txt', 'hashtag': 'txt', 'base64-enc': 'txt', 'base64-dec': 'txt', 'url-enc': 'txt', 'url-dec': 'txt' };
    const ext = extMap[state.format] || 'txt';

    let baseName = state.fileName.includes('.') ? state.fileName.split('.').slice(0, -1).join('.') : state.fileName;
    if (baseName === 'untitled') baseName = 'formatted_code';
    const finalName = `${baseName}.${ext}`;

    try {
        const zip = new JSZip();
        zip.file(finalName, state.content);
        zip.file("README.md", `# ${baseName} Project\n\nGenerated via Text to All Text VS Code Edition by SanStudio.\n\nEnjoy your code!`);
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_project.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Downloaded ${baseName}_project.zip`, 'success');
    } catch (e) {
        console.error(e);
        showToast('Failed to create ZIP file', 'error');
    }
}

// --- Drag & Drop ---

// Recursive folder reading logic for Drag and Drop
async function scanFiles(item, path = '') {
    return new Promise((resolve) => {
        if (item.isFile) {
            item.file(file => {
                // Inject a custom path property to track its folder hierarchy
                Object.defineProperty(file, 'customPath', { value: path + file.name });
                resolve([file]);
            });
        } else if (item.isDirectory) {
            const dirReader = item.createReader();
            const readAllEntries = async (reader) => {
                let allEntries = [];
                let readEntries = async () => {
                    return new Promise((resolveRead) => {
                        reader.readEntries(entries => {
                            if (entries.length > 0) {
                                allEntries = allEntries.concat(entries);
                                resolveRead(readEntries());
                            } else {
                                resolveRead(allEntries);
                            }
                        });
                    });
                };
                return readEntries();
            };

            readAllEntries(dirReader).then(async entries => {
                let files = [];
                for (let i = 0; i < entries.length; i++) {
                    const subFiles = await scanFiles(entries[i], path + item.name + '/');
                    files = files.concat(subFiles);
                }
                resolve(files);
            });
        } else {
            resolve([]);
        }
    });
}

function setupGlobalDragAndDrop() {
    const overlay = document.getElementById('drag-overlay');
    if (!overlay) return;
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault(); dragCounter++; overlay.classList.remove('hidden'); overlay.classList.add('flex');
    });
    window.addEventListener('dragleave', (e) => {
        e.preventDefault(); dragCounter--;
        if (dragCounter === 0) { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
        e.preventDefault(); dragCounter = 0; overlay.classList.add('hidden'); overlay.classList.remove('flex');

        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            let allFiles = [];
            let isFolderDrop = false;

            // Parse all dropped items
            for (let i = 0; i < e.dataTransfer.items.length; i++) {
                const item = e.dataTransfer.items[i].webkitGetAsEntry();
                if (item) {
                    if (item.isDirectory) {
                        isFolderDrop = true;
                    }
                    const files = await scanFiles(item, '');
                    allFiles = allFiles.concat(files);
                }
            }

            if (isFolderDrop) {
                // Handle as full workspace folder
                handleFolderSelection(allFiles);
                if (!state.sidebarVisible || state.sidebarTab !== 'workspace') switchSidebarTab('workspace');
            } else {
                // Standard multiple file drop
                const mediaFiles = allFiles.filter(f => f.type.startsWith('video/') || f.type.startsWith('audio/') || f.name.match(/\.(mp4|webm|ogg|mov|mkv|avi|mp3|wav|flac|m4a|aac)$/i));
                const others = allFiles.filter(f => !mediaFiles.includes(f));

                if (mediaFiles.length > 0) {
                    handleVideoSelection(mediaFiles);
                    if (!state.sidebarVisible || state.sidebarTab !== 'video') switchSidebarTab('video');
                }
                if (others.length > 0) {
                    handleFileUpload(others[0]);
                }
            }
        } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // Fallback for older browsers
            const files = Array.from(e.dataTransfer.files);
            const mediaFiles = files.filter(f => f.type.startsWith('video/') || f.type.startsWith('audio/') || f.name.match(/\.(mp4|webm|ogg|mov|mkv|avi|mp3|wav|flac|m4a|aac)$/i));
            const others = files.filter(f => !mediaFiles.includes(f));

            if (mediaFiles.length > 0) {
                handleVideoSelection(mediaFiles);
                if (!state.sidebarVisible || state.sidebarTab !== 'video') switchSidebarTab('video');
            }
            if (others.length > 0) {
                handleFileUpload(others[0]);
            }
        }
    });
}

// --- Settings / Toast ---

function openAboutModal() {
    const modal = document.getElementById('about-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    void modal.offsetWidth;

    modal.classList.remove('opacity-0');
    modal.classList.add('opacity-100');
}

function closeAboutModal(e) {
    if (e) e.stopPropagation();
    const modal = document.getElementById('about-modal');
    if (!modal) return;
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

// --- YouTube Thumbnail Downloader ---
function extractYouTubeVideoId(url) {
    if (!url) return null;
    url = url.trim();
    // Handle youtu.be short URLs
    let match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    // Handle youtube.com/watch?v=
    match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    // Handle youtube.com/embed/
    match = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    // Handle youtube.com/shorts/
    match = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    // Handle youtube.com/live/
    match = url.match(/\/live\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    return null;
}

function getYouTubeThumbnails() {
    const urlInput = document.getElementById('yt-thumb-url');
    const resultsDiv = document.getElementById('yt-thumb-results');
    const listDiv = document.getElementById('yt-thumb-list');
    const btn = document.getElementById('yt-thumb-btn');
    const btnText = document.getElementById('yt-thumb-btn-text');
    const btnIcon = document.getElementById('yt-thumb-icon');

    if (!urlInput || !resultsDiv || !listDiv) return;

    const url = urlInput.value.trim();
    if (!url) {
        showToast('Please paste a YouTube video URL.', 'error');
        return;
    }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
        showToast('Invalid YouTube URL. Please check and try again.', 'error');
        return;
    }

    // Show loading state
    btnText.textContent = 'Fetching...';
    btnIcon.className = 'fa-solid fa-spinner fa-spin';
    btn.disabled = true;

    // Thumbnail qualities from highest to lowest
    const qualities = [
        { key: 'maxresdefault', label: 'Max Resolution', size: '1280×720' },
        { key: 'sddefault', label: 'Standard', size: '640×480' },
        { key: 'hqdefault', label: 'High Quality', size: '480×360' },
        { key: 'mqdefault', label: 'Medium Quality', size: '320×180' },
        { key: 'default', label: 'Default', size: '120×90' }
    ];

    listDiv.innerHTML = '';
    resultsDiv.style.display = 'flex';

    let loadedCount = 0;

    qualities.forEach((q, index) => {
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/${q.key}.jpg`;
        const card = document.createElement('div');
        card.className = 'rounded overflow-hidden border border-vs-border bg-vs-editor shadow-sm';
        card.style.opacity = '0';
        card.style.transform = 'translateY(8px)';
        card.style.transition = `opacity 0.3s ease ${index * 0.08}s, transform 0.3s ease ${index * 0.08}s`;

        card.innerHTML = `
            <div class="relative group cursor-pointer" onclick="window.open('${thumbUrl}', '_blank')">
                <img src="${thumbUrl}" alt="${q.label} thumbnail" class="w-full block" style="min-height:60px; background:var(--vs-sidebar);" onerror="this.parentElement.parentElement.style.display='none'">
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <i class="fa-solid fa-expand text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity"></i>
                </div>
            </div>
            <div class="flex items-center justify-between px-3 py-2">
                <div>
                    <p class="text-[11px] font-semibold text-vs-text">${q.label}</p>
                    <p class="text-[9px] text-vs-textMuted font-mono">${q.size} • JPG</p>
                </div>
                <button onclick="downloadYtThumbnail('${thumbUrl}', '${videoId}_${q.key}.jpg')" class="bg-vs-accent hover:bg-vs-accentHover text-white text-[10px] px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors shadow-sm" title="Download ${q.label}">
                    <i class="fa-solid fa-download"></i> Save
                </button>
            </div>
        `;

        listDiv.appendChild(card);

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            });
        });
    });

    // Reset button
    setTimeout(() => {
        btnText.textContent = 'Get Thumbnails';
        btnIcon.className = 'fa-solid fa-images';
        btn.disabled = false;
    }, 500);

    showToast(`Thumbnails loaded for video: ${videoId}`, 'success');
}

function downloadYtThumbnail(imageUrl, filename) {
    // Use canvas approach to bypass CORS for download
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(function (blob) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            showToast(`Downloaded: ${filename}`, 'success');
        }, 'image/jpeg');
    };
    img.onerror = function () {
        // Fallback: open in new tab for manual save
        window.open(imageUrl, '_blank');
        showToast('Opened in new tab. Right-click → Save Image As...', 'info');
    };
    img.src = imageUrl;
}

// --- PWA (Standalone Web App) & Service Worker Logic ---
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Prompt user to add to home screen after 3.5 seconds
    setTimeout(() => {
        if (!localStorage.getItem('pwa_modal_dismissed')) {
            openPwaModal();
        }
    }, 3500);
});

// Offline caching for the website / PWA. Inside the Android app every file is already local.
if ('serviceWorker' in navigator && !(window.SanNative && SanNative.available) && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('PWA Service Worker registered:', reg.scope))
            .catch(err => console.log('SW registration note:', err));
    });
}

function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function installPWA() {
    if (deferredPrompt) {
        triggerPwaInstall();
    } else {
        openPwaModal();
    }
}

function openPwaModal() {
    const modal = document.getElementById('pwa-install-modal');
    const iosInst = document.getElementById('pwa-ios-instructions');
    const mainBtn = document.getElementById('pwa-main-install-btn');

    if (!modal) return;

    if (isIOSDevice()) {
        if (iosInst) iosInst.classList.remove('hidden');
        if (mainBtn) mainBtn.style.display = 'none';
    } else {
        if (iosInst) iosInst.classList.add('hidden');
        if (mainBtn) mainBtn.style.display = 'flex';
    }

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });
}

function closePwaModal() {
    const modal = document.getElementById('pwa-install-modal');
    if (!modal) return;
    modal.style.opacity = '0';
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }, 300);
    localStorage.setItem('pwa_modal_dismissed', 'true');
}

function triggerPwaInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                showToast('App added to Home Screen successfully!', 'success');
            }
            deferredPrompt = null;
            closePwaModal();
        });
    } else {
        // Browser fallback prompt
        showToast('Tap browser menu (⋮) -> "Install app" or "Add to Home screen"', 'info');
        closePwaModal();
    }
}

function sendYtToPlayer() {
    const urlInput = document.getElementById('yt-thumb-url');
    if (!urlInput || !urlInput.value.trim()) {
        showToast('Please paste a YouTube URL first.', 'error');
        return;
    }
    const videoId = extractYouTubeVideoId(urlInput.value.trim());
    if (!videoId) {
        showToast('Invalid YouTube URL', 'error');
        return;
    }
    const ytInput = document.getElementById('yt-url-input');
    if (ytInput) {
        ytInput.value = urlInput.value.trim();
        switchSidebarTab('video');
        addYouTubeVideo();
        showToast('Loaded in Mini Media Player!', 'success');
    }
}

function copyYtEmbedCode() {
    const urlInput = document.getElementById('yt-thumb-url');
    if (!urlInput || !urlInput.value.trim()) {
        showToast('Please paste a YouTube URL first.', 'error');
        return;
    }
    const videoId = extractYouTubeVideoId(urlInput.value.trim());
    if (!videoId) {
        showToast('Invalid YouTube URL', 'error');
        return;
    }
    const embedCode = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(embedCode);
    showToast('YouTube Embed HTML copied!', 'success');
}

function openYtDirectLink() {
    const urlInput = document.getElementById('yt-thumb-url');
    if (!urlInput || !urlInput.value.trim()) {
        showToast('Please paste a YouTube URL first.', 'error');
        return;
    }
    window.open(urlInput.value.trim(), '_blank');
}

// --- Keep Notes (Google Keep Style) ---
const KEEP_NOTES_KEY = 'vscode_sanstudio_keep_notes';
let keepNoteColor = '#1e1e1e';

function getKeepNotes() {
    const notes = loadJson(KEEP_NOTES_KEY, []);
    return Array.isArray(notes) ? notes : [];
}

function saveKeepNotes(notes) {
    if (!saveJson(KEEP_NOTES_KEY, notes)) showToast('Could not save notes (storage full)', 'error');
}

function setKeepNoteColor(color) {
    keepNoteColor = color;
    // Update visual selection
    const picker = document.getElementById('keep-color-picker');
    if (picker) {
        picker.querySelectorAll('button').forEach(btn => {
            const btnColor = btn.style.backgroundColor;
            // Convert hex to match
            const temp = document.createElement('div');
            temp.style.color = color;
            document.body.appendChild(temp);
            const computed = getComputedStyle(temp).color;
            document.body.removeChild(temp);
            temp.style.color = btnColor;
            // Simple approach: check border
            btn.classList.remove('border-vs-text');
            btn.classList.add('border-transparent');
        });
        // Highlight the clicked one via event
        event.target.classList.remove('border-transparent');
        event.target.classList.add('border-vs-text');
    }
}

function addKeepNote() {
    const titleEl = document.getElementById('keep-note-title');
    const contentEl = document.getElementById('keep-note-content');
    if (!titleEl || !contentEl) return;

    const title = titleEl.value.trim();
    const content = contentEl.value.trim();

    if (!title && !content) {
        showToast('Please enter a title or content.', 'error');
        return;
    }

    const notes = getKeepNotes();
    const note = {
        id: Date.now(),
        title: title || 'Untitled',
        content: content,
        color: keepNoteColor,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    notes.unshift(note);
    saveKeepNotes(notes);

    titleEl.value = '';
    contentEl.value = '';
    keepNoteColor = '#1e1e1e';
    // Reset color picker
    const picker = document.getElementById('keep-color-picker');
    if (picker) {
        picker.querySelectorAll('button').forEach((btn, i) => {
            btn.classList.remove('border-vs-text');
            btn.classList.add(i === 0 ? 'border-vs-textMuted/30' : 'border-transparent');
        });
    }

    renderKeepNotes();
    showToast('Note added!', 'success');
}

function togglePinNote(noteId) {
    const notes = getKeepNotes();
    const note = notes.find(n => n.id === noteId);
    if (note) {
        note.pinned = !note.pinned;
        saveKeepNotes(notes);
        renderKeepNotes();
    }
}

function deleteKeepNote(noteId) {
    let notes = getKeepNotes();
    notes = notes.filter(n => n.id !== noteId);
    saveKeepNotes(notes);
    renderKeepNotes();
    showToast('Note deleted.', 'info');
}

function openNoteInEditor(noteId) {
    const notes = getKeepNotes();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    if (isMobile()) closeMobileSidebar();

    // Check if this note is already open in a tab
    const existingTab = state.tabs.find(t => t.keepNoteId === noteId);
    if (existingTab) {
        switchEditorTab(existingTab.id);
        return;
    }

    // Close excel/word views if open
    if (state.wordVisible) toggleWordView(false);
    if (state.excelVisible) toggleSpreadsheetView(false);
    toggleMediaView(false);

    // Build the content with title as a header
    let editorContent = '';
    if (note.title && note.title !== 'Untitled') {
        editorContent = '# ' + note.title + '\n\n' + note.content;
    } else {
        editorContent = note.content;
    }

    const newId = Date.now();
    state.tabs.push({
        id: newId,
        name: (note.title || 'Untitled') + '.md',
        content: editorContent,
        format: 'md',
        isMedia: false,
        keepNoteId: noteId
    });
    switchEditorTab(newId);
    showToast(`Opened note: ${note.title}`, 'info');
}

function updateKeepNoteFromEditor(noteId) {
    const notes = getKeepNotes();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const tab = state.tabs.find(t => t.keepNoteId === noteId);
    if (!tab) return;

    // Parse the editor content - first line starting with # is title
    const text = tabText(tab);
    const lines = text.split('\n');
    let title = note.title;
    let content = text;

    if (lines[0] && lines[0].startsWith('# ')) {
        title = lines[0].substring(2).trim();
        content = lines.slice(1).join('\n').trim();
    }

    note.title = title || 'Untitled';
    note.content = content;
    note.updatedAt = new Date().toISOString();
    saveKeepNotes(notes);
    renderKeepNotes();
    showToast('Note saved!', 'success');
}

function renderKeepNotes() {
    const pinnedList = document.getElementById('keep-pinned-list');
    const othersList = document.getElementById('keep-others-list');
    const pinnedSection = document.getElementById('keep-pinned-section');
    const othersLabel = document.getElementById('keep-others-label');
    const emptyState = document.getElementById('keep-empty-state');
    const searchInput = document.getElementById('keep-search');

    if (!pinnedList || !othersList) return;

    const notes = getKeepNotes();
    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();

    // Filter by search
    const filtered = searchTerm
        ? notes.filter(n => (n.title + ' ' + n.content).toLowerCase().includes(searchTerm))
        : notes;

    const pinned = filtered.filter(n => n.pinned);
    const others = filtered.filter(n => !n.pinned);

    // Show/hide sections
    if (pinnedSection) pinnedSection.style.display = pinned.length ? 'flex' : 'none';
    if (othersLabel) othersLabel.style.display = (pinned.length && others.length) ? 'flex' : 'none';
    if (emptyState) emptyState.style.display = filtered.length === 0 ? 'flex' : 'none';

    pinnedList.innerHTML = pinned.map(n => buildNoteCard(n)).join('');
    othersList.innerHTML = others.map(n => buildNoteCard(n)).join('');
}

function buildNoteCard(note) {
    const bgColor = 'var(--vs-editor)';
    const borderColor = /^#[0-9a-f]{6}$/i.test(note.color || '') && note.color !== '#1e1e1e' ? note.color : 'var(--vs-border)';
    const preview = note.content.length > 120 ? note.content.substring(0, 120) + '...' : note.content;
    const timeAgo = getTimeAgo(note.updatedAt || note.createdAt);

    // Check if this note is open in editor
    const isOpenInEditor = state.tabs.some(t => t.keepNoteId === note.id);

    return `
        <div class="note-card rounded-lg border overflow-hidden cursor-pointer group transition-all duration-200 hover:shadow-md hover:shadow-black/20" style="background:${bgColor}; border-top:4px solid ${borderColor};" onclick="openNoteInEditor(${note.id})">
            <div class="px-3 pt-3 pb-1">
                <div class="flex items-start justify-between gap-2">
                    <h4 class="text-[12px] font-bold text-vs-text leading-tight flex-1 ${note.title === 'Untitled' ? 'opacity-40 italic' : ''}">${escapeHtml(note.title)}</h4>
                    <button onclick="togglePinNote(${note.id}); event.stopPropagation();" class="w-5 h-5 flex items-center justify-center rounded-full ${note.pinned ? 'text-vs-accent' : 'text-vs-textMuted/40 opacity-0 group-hover:opacity-100'} hover:text-vs-accent hover:bg-vs-hover transition-all shrink-0" title="${note.pinned ? 'Unpin' : 'Pin'}">
                        <i class="fa-solid fa-thumbtack text-[10px] ${note.pinned ? '' : 'rotate-45'}"></i>
                    </button>
                </div>
                <p class="text-[10px] text-vs-textMuted leading-relaxed mt-1 whitespace-pre-line break-words">${escapeHtml(preview)}</p>
            </div>
            <div class="flex items-center justify-between px-3 py-1.5 mt-1">
                <span class="text-[9px] text-vs-textMuted/50 font-mono">${timeAgo}</span>
                <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    ${isOpenInEditor ? `<button onclick="updateKeepNoteFromEditor(${note.id}); event.stopPropagation();" class="w-6 h-6 flex items-center justify-center rounded hover:bg-vs-hover text-green-400 hover:text-green-300 transition-colors" title="Save from Editor"><i class="fa-solid fa-floppy-disk text-[10px]"></i></button>` : ''}
                    <button onclick="duplicateKeepNote(${note.id}); event.stopPropagation();" class="w-6 h-6 flex items-center justify-center rounded hover:bg-vs-hover text-vs-textMuted hover:text-vs-text transition-colors" title="Duplicate">
                        <i class="fa-regular fa-copy text-[10px]"></i>
                    </button>
                    <button onclick="deleteKeepNote(${note.id}); event.stopPropagation();" class="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-vs-textMuted hover:text-red-400 transition-colors" title="Delete">
                        <i class="fa-solid fa-trash-can text-[10px]"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function duplicateKeepNote(noteId) {
    const notes = getKeepNotes();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const dup = {
        ...note,
        id: Date.now(),
        title: note.title + ' (Copy)',
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    notes.unshift(dup);
    saveKeepNotes(notes);
    renderKeepNotes();
    showToast('Note duplicated!', 'success');
}

// --- To-Do List & Task Alarm Reminder Logic ---
const TODO_TASKS_KEY = 'vscode_sanstudio_todo_tasks';
let currentTodoFilter = 'all';

function getTodoTasks() {
    const tasks = loadJson(TODO_TASKS_KEY, []);
    return Array.isArray(tasks) ? tasks : [];
}

function saveTodoTasks(tasks) {
    if (!saveJson(TODO_TASKS_KEY, tasks)) showToast('Could not save tasks (storage full)', 'error');
}

function initTodoTasks() {
    const dtInput = document.getElementById('todo-datetime-input');
    if (dtInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dtInput.value = now.toISOString().slice(0, 16);
    }
    updateTodoNotifStatus();
    renderTodoTasks();
    // In-app alarms (chime + toast) while the page is open: checks every 10 seconds
    setInterval(checkTodoAlarms, 10000);

    // Android: alarms are also scheduled natively so they fire with the app closed
    if (nativeAlarmsAvailable()) {
        refreshNativeAlarmStatus().then(absorbFiredAlarms).then(syncNativeAlarms);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) refreshNativeAlarmStatus().then(absorbFiredAlarms).then(syncNativeAlarms);
        });
    }
}

// ---- native (Android) alarms ----
let nativeAlarmStatus = null; // { notifications, exact, sdk }
let notifPermissionAsked = false;

function nativeAlarmsAvailable() {
    return !!(window.SanNative && SanNative.available);
}

async function refreshNativeAlarmStatus() {
    try {
        nativeAlarmStatus = await SanNative.alarmStatus();
    } catch (e) {
        nativeAlarmStatus = null;
    }
    updateTodoNotifStatus();
}

/** Alarms that already notified while the app was closed: mark them done without chiming again. */
async function absorbFiredAlarms() {
    try {
        const ids = await SanNative.alarmTakeFired();
        if (!ids.length) return;
        const tasks = getTodoTasks();
        let changed = false;
        tasks.forEach((t) => { if (ids.includes(t.id) && !t.notified) { t.notified = true; changed = true; } });
        if (changed) { saveTodoTasks(tasks); renderTodoTasks(); }
    } catch (e) { /* bridge unavailable */ }
}

function pendingNativeAlarms() {
    const now = Date.now();
    return getTodoTasks()
        .filter((t) => !t.completed && !t.notified)
        .map((t) => {
            const due = new Date(t.datetime);
            const offset = Number(t.alarmOffset) || 0;
            const when = due.getTime() - offset * 60000;
            const time = due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return { id: t.id, title: t.title, body: offset === 0 ? `Due now (${time})` : `Due at ${time} - ${offset} min reminder`, when };
        })
        .filter((a) => Number.isFinite(a.when) && a.when > now);
}

/** Tell Android about every pending alarm (replaces its schedule). Safe to call after any task change. */
const syncNativeAlarms = debounce(async () => {
    if (!nativeAlarmsAvailable()) return;
    try {
        const res = await SanNative.alarmSync(pendingNativeAlarms());
        nativeAlarmStatus = { ...(nativeAlarmStatus || {}), notifications: res.notifications, exact: res.exact };
        updateTodoNotifStatus();
    } catch (e) {
        console.warn('Could not schedule native alarms', e);
    }
}, 300);

async function requestTodoNotificationPermission() {
    if (nativeAlarmsAvailable()) {
        try {
            if (nativeAlarmStatus && !nativeAlarmStatus.notifications && notifPermissionAsked) {
                // Android shows the permission dialog only a couple of times: after that it is a settings switch
                SanNative.openNotificationSettings();
                return;
            }
            nativeAlarmStatus = await SanNative.requestNotifications();
            notifPermissionAsked = true;
            updateTodoNotifStatus();
            if (nativeAlarmStatus.notifications) {
                showToast('Task alarms enabled - they will ring even when the app is closed', 'success');
                syncNativeAlarms();
            } else {
                showToast('Notifications are off. Tap Enable again to open the settings.', 'warning');
            }
        } catch (e) {
            showToast('Could not enable alarms: ' + e.message, 'error');
        }
        return;
    }
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            updateTodoNotifStatus();
            if (permission === 'granted') {
                showToast('Browser notifications enabled for task alarms!', 'success');
            } else {
                showToast('Notifications permission not granted', 'warning');
            }
        });
    } else {
        showToast('Browser does not support desktop notifications', 'info');
    }
}

function updateTodoNotifStatus() {
    const statusEl = document.getElementById('todo-notif-status');
    const btnEl = document.getElementById('todo-notif-btn');
    if (!statusEl || !btnEl) return;

    const hint = document.getElementById('todo-alarm-hint');
    const native = nativeAlarmsAvailable();
    if (hint) hint.classList.toggle('hidden', !(native && nativeAlarmStatus && nativeAlarmStatus.notifications && !nativeAlarmStatus.exact));
    const batteryHint = document.getElementById('todo-battery-hint');
    if (batteryHint) batteryHint.classList.toggle('hidden', !(native && nativeAlarmStatus && nativeAlarmStatus.notifications && nativeAlarmStatus.battery === false));
    const active = native
        ? !!(nativeAlarmStatus && nativeAlarmStatus.notifications)
        : ('Notification' in window && Notification.permission === 'granted');

    if (active) {
        statusEl.textContent = 'Notifications Active 🔔';
        statusEl.className = 'text-[10px] text-green-400 truncate font-semibold';
        btnEl.textContent = 'Active ✓';
        btnEl.className = 'bg-green-600 text-white text-[9px] px-2 py-1 rounded cursor-default';
        btnEl.disabled = true;
    } else {
        statusEl.textContent = 'Notifications Disabled';
        statusEl.className = 'text-[10px] text-vs-textMuted truncate';
        btnEl.textContent = 'Enable';
        btnEl.className = 'bg-vs-accent hover:bg-vs-accentHover text-white text-[9px] px-2 py-1 rounded transition-colors font-medium';
        btnEl.disabled = false;
    }
}

function playAlarmSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        
        const playBeep = (freq, startTime, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        playBeep(880, now, 0.15);           // A5
        playBeep(1046.5, now + 0.18, 0.15); // C6
        playBeep(1318.5, now + 0.36, 0.3);  // E6
    } catch(e) {
        console.log('Audio chime error:', e);
    }
}

function testAlarmSound() {
    playAlarmSound();
    showToast('⏰ Testing Alarm Sound Chime!', 'info');
}

function addTodoTask() {
    const titleInput = document.getElementById('todo-title-input');
    const dtInput = document.getElementById('todo-datetime-input');
    const offsetInput = document.getElementById('todo-alarm-offset');
    const priorityInput = document.getElementById('todo-priority-input');

    if (!titleInput || !dtInput) return;

    const title = titleInput.value.trim();
    const datetimeStr = dtInput.value;

    if (!title) {
        showToast('Please enter a task title', 'error');
        return;
    }

    if (!datetimeStr) {
        showToast('Please select date & time for the task', 'error');
        return;
    }

    const alarmOffset = parseInt(offsetInput?.value || '0', 10);
    const priority = priorityInput?.value || 'medium';

    const newTask = {
        id: Date.now(),
        title: title,
        datetime: new Date(datetimeStr).toISOString(),
        alarmOffset: alarmOffset,
        priority: priority,
        completed: false,
        notified: false,
        createdAt: new Date().toISOString()
    };

    const tasks = getTodoTasks();
    tasks.unshift(newTask);
    saveTodoTasks(tasks);
    syncNativeAlarms();

    titleInput.value = '';
    renderTodoTasks();

    const timeFormatted = new Date(datetimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    showToast(`Added Task: "${title}" (${timeFormatted})`, 'success');
}

function toggleTodoTask(id) {
    const tasks = getTodoTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        saveTodoTasks(tasks);
        syncNativeAlarms();
        renderTodoTasks();
    }
}

function deleteTodoTask(id) {
    let tasks = getTodoTasks();
    tasks = tasks.filter(t => t.id !== id);
    saveTodoTasks(tasks);
    syncNativeAlarms();
    renderTodoTasks();
    showToast('Task deleted', 'info');
}

function filterTodoTasks(filter) {
    currentTodoFilter = filter;
    ['all', 'today', 'upcoming', 'done'].forEach(f => {
        const btn = document.getElementById('todo-filter-' + f);
        if (btn) {
            btn.setAttribute('aria-pressed', String(f === filter));
            if (f === filter) {
                btn.className = 'flex-1 text-[10px] py-1 rounded bg-vs-accent text-white font-medium transition-colors';
            } else {
                btn.className = 'flex-1 text-[10px] py-1 rounded text-vs-textMuted hover:text-vs-text transition-colors';
            }
        }
    });
    renderTodoTasks();
}

function renderTodoTasks() {
    const listContainer = document.getElementById('todo-task-list');
    if (!listContainer) return;

    const tasks = getTodoTasks();
    const now = new Date();
    const todayStr = now.toDateString();

    let filtered = tasks.filter(t => {
        const taskDate = new Date(t.datetime);
        if (currentTodoFilter === 'today') {
            return taskDate.toDateString() === todayStr && !t.completed;
        } else if (currentTodoFilter === 'upcoming') {
            return taskDate > now && !t.completed;
        } else if (currentTodoFilter === 'done') {
            return t.completed;
        }
        return true;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="py-8 flex flex-col items-center justify-center text-vs-textMuted text-center">
                <i class="fa-solid fa-clipboard-check text-3xl mb-2 opacity-30"></i>
                <p class="text-xs font-medium">No tasks found</p>
                <p class="text-[10px] opacity-60">Add a task above to set alarms & reminders.</p>
            </div>
        `;
        return;
    }

    let html = '';
    filtered.forEach(t => {
        const taskDate = new Date(t.datetime);
        const isOverdue = taskDate < now && !t.completed;
        const dateFormatted = taskDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const timeFormatted = taskDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let priorityClass = 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        if (t.priority === 'high') priorityClass = 'bg-red-500/20 text-red-400 border-red-500/40 font-bold';
        else if (t.priority === 'medium') priorityClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';

        let offsetText = t.alarmOffset === 0 ? 'Exact time' : `${t.alarmOffset}m before`;

        html += `
            <div class="task-card p-3 rounded-lg bg-vs-editor border ${isOverdue ? 'border-red-500/50 bg-red-950/10' : 'border-vs-border'} flex flex-col gap-2 shadow-sm transition-all">
                <div class="flex items-start justify-between gap-2">
                    <label class="flex items-start gap-2.5 cursor-pointer group flex-1 min-w-0">
                        <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTodoTask(${t.id})" class="w-4 h-4 mt-0.5 accent-vs-accent bg-vs-sidebar border-vs-border rounded shrink-0 cursor-pointer">
                        <div class="flex flex-col min-w-0">
                            <span class="text-xs font-semibold text-vs-text truncate ${t.completed ? 'line-through text-vs-textMuted/60' : ''}">${escapeHtml(t.title)}</span>
                            <div class="flex items-center gap-2 mt-1 flex-wrap text-[10px]">
                                <span class="text-vs-accent font-mono"><i class="fa-regular fa-clock mr-1"></i>${dateFormatted}, ${timeFormatted}</span>
                                <span class="px-1.5 py-0.5 rounded border ${priorityClass} uppercase tracking-wider text-[8px]">${escapeHtml(t.priority)}</span>
                            </div>
                        </div>
                    </label>
                    <button onclick="deleteTodoTask(${t.id})" class="text-vs-textMuted hover:text-red-400 p-1 transition-colors shrink-0" title="Delete Task">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
                <div class="flex items-center justify-between pt-1 border-t border-vs-border/40 text-[9px] text-vs-textMuted">
                    <span class="flex items-center gap-1"><i class="fa-solid fa-bell ${t.notified ? 'text-green-400' : 'text-yellow-400'}"></i> Alarm: ${offsetText}</span>
                    <span>${t.completed ? '✓ Completed' : isOverdue ? '⚠️ Overdue' : '⏳ Pending'}</span>
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;
}

function checkTodoAlarms() {
    const tasks = getTodoTasks();
    const now = new Date();
    let updated = false;

    tasks.forEach(t => {
        if (t.completed || t.notified) return;

        const taskTime = new Date(t.datetime).getTime();
        const alarmTriggerTime = taskTime - (t.alarmOffset * 60 * 1000);

        if (now.getTime() >= alarmTriggerTime) {
            t.notified = true;
            updated = true;

            playAlarmSound();
            showToast(`⏰ ALARM: ${t.title} (${t.alarmOffset === 0 ? 'Due Now' : t.alarmOffset + 'm reminder'})`, 'warning');

            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification(`⏰ Task Alarm: ${t.title}`, {
                        body: `Reminder for task scheduled at ${new Date(t.datetime).toLocaleTimeString()}`,
                        icon: 'https://sanstudio2026.neocities.org/San.png'
                    });
                } catch(e) {}
            }
        }
    });

    if (updated) {
        saveTodoTasks(tasks);
        renderTodoTasks();
        syncNativeAlarms();
    }
}

// --- Document Tools Suite Logic ---

function docGeneratePdf() {
    try {
        const jsPDF = window.jspdf ? window.jspdf.jsPDF : (window.jsPDF || null);
        if (!jsPDF) {
            showToast('PDF library still loading. Please try again in a moment.', 'warning');
            return;
        }
        const doc = new jsPDF();
        const activeTab = state.tabs.find(t => t.id === state.activeTabId);
        const text = activeTab ? tabText(activeTab) : '';

        if (!text || !text.trim()) {
            showToast('Editor is empty! Type something to generate PDF.', 'error');
            return;
        }

        showToast('Generating PDF document...', 'info');
        const splitText = doc.splitTextToSize(text, 180);
        doc.text(splitText, 10, 10);
        const filename = (activeTab ? activeTab.name.replace(/\.[^/.]+$/, "") : "document") + ".pdf";
        doc.save(filename);
        showToast(`Generated: ${filename}`, 'success');
    } catch(err) {
        console.error("jsPDF error:", err);
        showToast('Failed to generate PDF: ' + err.message, 'error');
    }
}

function docViewPdf(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const url = URL.createObjectURL(file);

    // Create media tab for embedded workspace PDF viewing
    const newId = Date.now();
    state.tabs.push({
        id: newId,
        name: file.name,
        content: url,
        format: 'pdf',
        isMedia: true,
        mediaType: 'application/pdf'
    });
    switchEditorTab(newId);
    showToast(`Opened PDF in Editor: ${file.name}`, 'success');
    input.value = '';
}

async function docMergePdfs(input) {
    if (!input.files || input.files.length < 2) {
        showToast('Please select at least 2 PDF files to merge.', 'error');
        return;
    }
    const PDFLibObj = window.PDFLib || PDFLib;
    if (!PDFLibObj) {
        showToast('PDF library loading... Try again in a moment.', 'warning');
        return;
    }
    try {
        showToast('Merging PDF documents...', 'info');
        const mergedPdf = await PDFLibObj.PDFDocument.create();
        for (let i = 0; i < input.files.length; i++) {
            const file = input.files[i];
            const bytes = await file.arrayBuffer();
            const pdf = await PDFLibObj.PDFDocument.load(bytes);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }
        const mergedBytes = await mergedPdf.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'merged_document.pdf';
        link.click();
        showToast('PDFs merged successfully: merged_document.pdf', 'success');
    } catch(err) {
        console.error("PDF-Lib merge error:", err);
        showToast('Error merging PDFs: ' + err.message, 'error');
    }
    input.value = '';
}

async function docSplitPdf(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const PDFLibObj = window.PDFLib || PDFLib;
    if (!PDFLibObj) {
        showToast('PDF library loading...', 'warning');
        return;
    }
    try {
        showToast('Splitting PDF into individual pages...', 'info');
        const bytes = await file.arrayBuffer();
        const pdf = await PDFLibObj.PDFDocument.load(bytes);
        const pageCount = pdf.getPageCount();

        for (let i = 0; i < Math.min(pageCount, 10); i++) {
            const newPdf = await PDFLibObj.PDFDocument.create();
            const [page] = await newPdf.copyPages(pdf, [i]);
            newPdf.addPage(page);
            const newBytes = await newPdf.save();
            const blob = new Blob([newBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${file.name.replace('.pdf', '')}_page_${i + 1}.pdf`;
            link.click();
        }
        showToast(`Split into ${pageCount} pages!`, 'success');
    } catch(err) {
        console.error("PDF-Lib split error:", err);
        showToast('Error splitting PDF: ' + err.message, 'error');
    }
    input.value = '';
}

async function docWatermarkPdf(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const PDFLibObj = window.PDFLib || PDFLib;
    if (!PDFLibObj) {
        showToast('PDF library loading...', 'warning');
        return;
    }
    const text = prompt("Enter watermark text:", "CONFIDENTIAL / DRAFT");
    if (!text) return;

    try {
        showToast('Adding watermark to PDF...', 'info');
        const bytes = await file.arrayBuffer();
        const pdf = await PDFLibObj.PDFDocument.load(bytes);
        const pages = pdf.getPages();
        const font = await pdf.embedFont(PDFLibObj.StandardFonts.HelveticaBold);

        pages.forEach(page => {
            const { width, height } = page.getSize();
            page.drawText(text, {
                x: width / 4,
                y: height / 2,
                size: 40,
                font: font,
                color: PDFLibObj.rgb(0.75, 0.75, 0.75),
                rotate: PDFLibObj.degrees(45),
                opacity: 0.4,
            });
        });

        const watermarkedBytes = await pdf.save();
        const blob = new Blob([watermarkedBytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `watermarked_${file.name}`;
        link.click();
        showToast('Watermark added successfully!', 'success');
    } catch(err) {
        console.error("PDF-Lib watermark error:", err);
        showToast('Error watermarking PDF: ' + err.message, 'error');
    }
    input.value = '';
}

// Digital Signature Pad Logic
let isSigning = false;
let sigCanvas, sigCtx;

function initSignaturePad() {
    sigCanvas = document.getElementById('doc-sig-canvas');
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.strokeStyle = '#000000';
    sigCtx.lineWidth = 2;
    sigCtx.lineCap = 'round';

    // Pointer events cover mouse, touch and pen; coordinates are scaled to the canvas bitmap size
    const getPos = (e) => {
        const rect = sigCanvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (sigCanvas.width / rect.width),
            y: (e.clientY - rect.top) * (sigCanvas.height / rect.height),
        };
    };

    const startDraw = (e) => {
        e.preventDefault();
        isSigning = true;
        sigCanvas.setPointerCapture(e.pointerId);
        const pos = getPos(e);
        sigCtx.beginPath();
        sigCtx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (!isSigning) return;
        e.preventDefault();
        const pos = getPos(e);
        sigCtx.lineTo(pos.x, pos.y);
        sigCtx.stroke();
    };

    const stopDraw = () => { isSigning = false; };

    sigCanvas.style.touchAction = 'none';
    sigCanvas.addEventListener('pointerdown', startDraw);
    sigCanvas.addEventListener('pointermove', draw);
    sigCanvas.addEventListener('pointerup', stopDraw);
    sigCanvas.addEventListener('pointercancel', stopDraw);
}

function docClearSignature() {
    if (sigCtx && sigCanvas) {
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        showToast('Signature pad cleared', 'info');
    }
}

function docSaveSignature() {
    if (!sigCanvas) return;
    const dataUrl = sigCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'signature.png';
    link.click();
    showToast('Saved digital signature PNG!', 'success');
}

function docWordToHtml() {
    switchSidebarTab('word');
    showToast('Word Processor active. Use export HTML or copy content to editor.', 'info');
}

function docOpenMarkdownEditor() {
    const newId = Date.now();
    state.tabs.push({ id: newId, name: 'document.md', content: '# Markdown Document\n\nWrite your markdown content here!\n\n- Feature 1\n- Feature 2', format: 'md', isMedia: false });
    switchEditorTab(newId);
    if (!state.previewVisible) toggleHtmlPreview();
    showToast('Opened Markdown Editor & Split Preview!', 'success');
}

function docOpenCsvEditor() {
    const newId = Date.now();
    state.tabs.push({ id: newId, name: 'data.csv', content: 'ID,Name,Role,Status\n1,SanStudio,Developer,Active\n2,John Doe,Designer,Pending\n3,Jane Smith,Manager,Completed', format: 'csv', isMedia: false });
    switchEditorTab(newId);
    showToast('Opened CSV Data Editor!', 'info');
}

function getTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return diffMin + 'm ago';
    if (diffHr < 24) return diffHr + 'h ago';
    if (diffDay < 7) return diffDay + 'd ago';
    return past.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// --- Web Asset Explorer ---
let waeAssets = [];
let waeSiteData = {};
let waeCurrentFilter = 'all';
let waeActiveAsset = null;

function waeQuickUrl(url) {
    document.getElementById('wae-url-input').value = url;
    waeAnalyze();
}

async function waeFetchHtml(url) {
    return SanWeb.fetchText(url, { html: true, allowProxy: document.getElementById('wae-proxy').checked });
}

function waeAbsUrl(base, rel) {
    try { return new URL(rel, base).href; } catch (e) { return null; }
}
function waeClampScore(n) { return Math.max(5, Math.min(98, Math.round(n))); }

function waeProcessDocument(doc, baseUrl, rawHtml, discovered) {
    waeAssets = discovered || SanWeb.collect(doc, baseUrl).assets;
    const meta = {};
    doc.querySelectorAll('meta').forEach(m => { const n = m.getAttribute('name') || m.getAttribute('property'); const c = m.getAttribute('content'); if (n && c) meta[n] = c; });
    const title = doc.querySelector('title')?.textContent || '';
    const tech = new Set();
    const lower = rawHtml.toLowerCase();
    const techSigs = { 'React': ['data-reactroot', 'react-dom'], 'Next.js': ['__next_data__', '/_next/'], 'Vue': ['__vue__', 'data-v-'], 'Nuxt': ['__nuxt', '/_nuxt/'], 'Angular': ['ng-version'], 'WordPress': ['wp-content'], 'Shopify': ['cdn.shopify.com'], 'Tailwind CSS': ['tailwind'], 'Bootstrap': ['bootstrap.min.css'], 'jQuery': ['jquery.min.js'], 'Google Fonts': ['fonts.googleapis.com'], 'Vercel': ['vercel.app', '_vercel'], 'Cloudflare': ['cloudflare'] };
    Object.entries(techSigs).forEach(([name, sigs]) => { if (sigs.some(s => lower.includes(s))) tech.add(name); });

    const colorSet = new Set();
    [...rawHtml.matchAll(/#[0-9a-fA-F]{6}\b/g)].forEach(m => colorSet.add(m[0].toLowerCase()));
    let palette = [...colorSet].slice(0, 80);
    const freq = {}; palette.forEach(c => freq[c] = (freq[c] || 0) + 1);
    palette = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 10);

    const imgCount = waeAssets.filter(a => a.type === 'image').length;
    const modernFormats = waeAssets.filter(a => ['webp', 'avif'].includes(a.ext)).length;
    const lazyCount = waeAssets.filter(a => a.lazy).length;
    const scriptCount = waeAssets.filter(a => a.type === 'script').length;
    const hasOg = !!(meta['og:title'] || meta['og:image']);
    const hasViewport = !!doc.querySelector('meta[name="viewport"]');
    const seo = waeClampScore(50 + (hasOg ? 20 : 0) + (title ? 15 : 0) + (meta['description'] ? 15 : 0));
    const perf = waeClampScore(85 - Math.max(0, imgCount - 20) * 1.5 - Math.max(0, scriptCount - 10) * 1.5 + (lazyCount > 0 ? 8 : 0) + (modernFormats > 0 ? 7 : 0));
    const overall = Math.round((seo + perf) / 2);

    waeSiteData = {
        url: baseUrl, title, meta, tech: [...tech], palette,
        scores: { seo, perf, overall },
        counts: { images: imgCount, scripts: scriptCount, lazy: lazyCount, modern: modernFormats },
        favicon: waeAssets.find(a => a.type === 'icon')?.url || waeAbsUrl(baseUrl, '/favicon.ico'),
        fonts: waeAssets.filter(a => a.type === 'font'),
        hasViewport
    };
}

async function waeAnalyze(importedResponse = null) {
    if (document.getElementById('wae-analyze-btn').disabled) return;
    let url = document.getElementById('wae-url-input').value.trim();
    if (!url) { showToast('Please enter a URL.', 'error'); return; }
    try { url = SanWeb.normalizeUrl(url); } catch (error) { return showToast(error.message, 'error'); }
    document.getElementById('wae-url-input').value = url;

    const btn = document.getElementById('wae-analyze-btn');
    const statusEl = document.getElementById('wae-status');
    const statusText = document.getElementById('wae-status-text');
    const errorEl = document.getElementById('wae-error');
    const icon = document.getElementById('wae-analyze-icon');
    const btnText = document.getElementById('wae-analyze-text');

    errorEl.classList.add('hidden');
    statusEl.classList.remove('hidden');
    btn.disabled = true;
    icon.className = 'fa-solid fa-spinner fa-spin';
    btnText.textContent = 'Analyzing...';
    statusText.textContent = 'Fetching page…';
    document.getElementById('wae-sidebar-summary').style.display = 'none';
    document.getElementById('wae-results-container').replaceChildren();
    waeAssets = [];
    waeSiteData = {};
    waeCurrentFilter = 'all';
    document.getElementById('wae-lightbox')?.classList.remove('show');

    try {
        const response = importedResponse || await waeFetchHtml(url);
        const html = response.text;
        url = response.url;
        statusText.textContent = 'Parsing document…';
        await new Promise(r => setTimeout(r, 100));
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const discovered = await SanWeb.discover(doc, url, {
            allowProxy: document.getElementById('wae-proxy').checked,
            progress: text => { statusText.textContent = text; }
        });
        waeProcessDocument(doc, url, html, discovered.assets);
        waeSiteData.warnings = discovered.warnings;
        waeSiteData.transport = response.transport;
        statusText.textContent = 'Rendering assets…';
        await new Promise(r => setTimeout(r, 100));
        waeRenderAll();
        statusEl.classList.add('hidden');
        toggleAssetExplorerView(true);
        if (isMobile()) closeMobileSidebar();
        showToast(`Found ${waeAssets.length} assets on ${new URL(url).hostname}`, 'success');

        // Update sidebar summary
        const summaryEl = document.getElementById('wae-sidebar-summary');
        const statsEl = document.getElementById('wae-sidebar-stats');
        if (summaryEl && statsEl) {
            summaryEl.style.display = 'flex';
            statsEl.innerHTML = `
                <div class="flex justify-between"><span>Site:</span><b class="text-vs-text">${escapeHtml(new URL(url).hostname)}</b></div>
                <div class="flex justify-between"><span>Total assets:</span><b class="text-vs-text">${waeAssets.length}</b></div>
                <div class="flex justify-between"><span>Images:</span><b class="text-vs-text">${waeSiteData.counts.images}</b></div>
                <div class="flex justify-between"><span>Scripts:</span><b class="text-vs-text">${waeSiteData.counts.scripts}</b></div>
                <div class="flex justify-between"><span>SEO Score:</span><b class="text-vs-text">${waeSiteData.scores.seo}</b></div>
            `;
        }
    } catch (e) {
        statusEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        errorEl.textContent = 'Could not analyze: ' + (e.message || e);
    } finally {
        btn.disabled = false;
        icon.className = 'fa-solid fa-bolt';
        btnText.textContent = 'Analyze Website';
    }
}

function toggleAssetExplorerView(show) {
    const wrapper = document.getElementById('asset-explorer-wrapper');
    if (!wrapper) return;
    if (show) {
        if (state.wordVisible) toggleWordView(false);
        if (state.excelVisible) toggleSpreadsheetView(false);
        toggleMediaView(false);
        els.textEditorWrapper.classList.add('hidden');
        wrapper.classList.remove('hidden');
        wrapper.classList.add('flex');
        state.assetExplorerVisible = true;
    } else {
        wrapper.classList.add('hidden');
        wrapper.classList.remove('flex');
        els.textEditorWrapper.classList.remove('hidden');
        state.assetExplorerVisible = false;
    }
}

const WAE_CATS = [
    { key: 'all', label: 'All' },
    { key: 'image', label: 'Images', types: ['image'] },
    { key: 'svg', label: 'SVG', types: ['svg-inline'] },
    { key: 'icon', label: 'Icons', types: ['icon'] },
    { key: 'font', label: 'Fonts', types: ['font'] },
    { key: 'script', label: 'Scripts', types: ['script'] },
    { key: 'css', label: 'CSS', types: ['css'] },
    { key: 'video', label: 'Video', types: ['video'] },
    { key: 'audio', label: 'Audio', types: ['audio'] },
    { key: 'file', label: 'Files', types: ['file'] },
];
function waeMatchFilter(a, key) {
    if (key === 'all') return true;
    if (key === 'svg') return a.type === 'svg-inline' || a.ext === 'svg';
    const cat = WAE_CATS.find(c => c.key === key);
    return cat && cat.types.includes(a.type);
}
const WAE_EMOJI = { image: '🖼️', svg: '🔺', icon: '🔖', font: '🔤', script: '⚙️', css: '🎨', video: '🎬', audio: '🎧', hero: '🌅', logo: '🏷️', avatar: '👤', thumbnail: '🖇️', background: '🌌', responsive: '📱' };

function waeRenderAll() {
    const container = document.getElementById('wae-results-container');
    if (!container) return;
    const s = waeSiteData;
    const host = (() => { try { return new URL(s.url).hostname; } catch (e) { return s.url; } })();

    container.innerHTML = `
        <div class="wae-banner">
            <div class="wae-favicon"><img src="${escapeHtml(s.favicon || '')}" referrerpolicy="no-referrer" onerror="this.style.display='none'" alt=""/></div>
            <div>
                <h2 class="wae-site-title">${escapeHtml(s.title || host)}</h2>
                <div class="wae-site-url">${escapeHtml(host)}</div>
                <div class="flex flex-wrap gap-1 mt-2">${s.tech.slice(0, 6).map(t => `<span class="wae-tech-tag">${escapeHtml(t)}</span>`).join('') || '<span class="wae-tech-tag">No frameworks detected</span>'}</div>
            </div>
            <div class="wae-scores">
                ${waeScorePill('SEO', s.scores.seo)}
                ${waeScorePill('Perf', s.scores.perf)}
                ${waeScorePill('Overall', s.scores.overall)}
            </div>
        </div>
        <p class="p-3 text-xs text-vs-textMuted" role="status">Found ${waeAssets.length} assets in page source and linked CSS. Assets loaded only by JavaScript, login, or scrolling may not appear. Embedded players and stream manifests are links, not standalone video files.</p>
        ${(s.warnings || []).length ? `<details class="p-3 text-xs text-vs-textMuted"><summary>Partial scan: ${s.warnings.length} stylesheet / scan warnings</summary><ul>${s.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></details>` : ''}
        <div class="wae-toolbar">
            <div class="wae-filter-tabs" id="wae-filter-tabs"></div>
            <div class="flex gap-2 items-center">
                <div class="flex items-center gap-2 bg-vs-sidebar border border-vs-border rounded-lg px-3 py-1.5">
                    <i class="fa-solid fa-magnifying-glass text-[10px] text-vs-textMuted"></i>
                    <input id="wae-live-search" placeholder="Filter assets…" class="bg-transparent border-none outline-none text-vs-text text-[11px] w-28">
                </div>
                <button onclick="waeExportJson()" class="text-[10px] px-3 py-1.5 rounded-lg border border-vs-border bg-vs-sidebar text-vs-textMuted hover:text-vs-text hover:border-vs-accent transition-colors flex items-center gap-1"><i class="fa-solid fa-download"></i> JSON</button>
            </div>
        </div>
        <div class="wae-grid" id="wae-asset-grid"></div>
        <div class="wae-section-title">🎨 Color Palette</div>
        <div class="wae-palette" id="wae-palette-row"></div>
        <div class="wae-section-title">📊 Site Analysis</div>
        <div class="wae-panels" id="wae-panel-grid"></div>
    `;
    waeRenderTabs();
    waeRenderGrid();
    waeRenderPalette();
    waeRenderPanels();

    document.getElementById('wae-live-search').addEventListener('input', waeRenderGrid);
}

function waeScorePill(label, val) {
    const color = val >= 80 ? '#3DDC97' : val >= 55 ? '#FFB454' : '#FF5C7A';
    return `<div class="wae-score"><span class="wae-score-val" style="color:${color}">${val}</span><span class="wae-score-lbl">${label}</span></div>`;
}

function waeRenderTabs() {
    const counts = {};
    WAE_CATS.forEach(c => counts[c.key] = c.key === 'all' ? waeAssets.length : waeAssets.filter(a => waeMatchFilter(a, c.key)).length);
    const tabsEl = document.getElementById('wae-filter-tabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = WAE_CATS.filter(c => c.key === 'all' || counts[c.key] > 0).map(c =>
        `<button class="wae-ftab ${c.key === waeCurrentFilter ? 'active' : ''}" data-key="${c.key}">${c.label} <span style="opacity:.5">${counts[c.key]}</span></button>`
    ).join('');
    tabsEl.querySelectorAll('.wae-ftab').forEach(t => {
        t.addEventListener('click', () => { waeCurrentFilter = t.dataset.key; waeRenderTabs(); waeRenderGrid(); });
    });
}

function waeRenderGrid() {
    const searchEl = document.getElementById('wae-live-search');
    const q = searchEl ? searchEl.value.toLowerCase() : '';
    const filtered = waeAssets.filter(a => waeMatchFilter(a, waeCurrentFilter) && (!q || (a.name + a.url).toLowerCase().includes(q)));
    const grid = document.getElementById('wae-asset-grid');
    if (!grid) return;
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="wae-empty"><div style="font-size:30px;margin-bottom:8px;">🗂️</div>No assets for this filter.</div>';
        return;
    }
    const pageSize = Math.max(100, Number(grid.dataset.limit) || 100);
    grid.innerHTML = filtered.slice(0, pageSize).map((a, i) => {
        const isImg = a.type === 'image' || a.type === 'icon';
        const isSvg = a.type === 'svg-inline';
        const isVid = a.type === 'video';
        const isAudio = a.type === 'audio';
        const safeUrl = escapeHtml(a.url);
        const fallback = escapeHtml(WAE_EMOJI[a.category] || WAE_EMOJI[a.type] || '📄');
        let media;
        if (isSvg) {
            media = `<div class="wae-card-media" style="background:repeating-conic-gradient(var(--vs-editor) 0% 25%, transparent 0% 50%) 50% / 14px 14px;">${a.raw.length < 5000 ? `<img src="${waeSvgDataUrl(a.raw)}" alt="" style="width:100%;height:100%;object-fit:contain">` : '<div class="wae-ph">🔺</div>'}</div>`;
        } else if (isImg) {
            media = `<div class="wae-card-media"><img src="${safeUrl}" loading="lazy" referrerpolicy="no-referrer" data-fallback="${fallback}" alt=""/></div>`;
        } else if (isVid && a.category === 'iframe') {
            media = `<div class="wae-card-media"><div class="wae-ph">🎬</div></div>`;
        } else if (isVid) {
            media = `<div class="wae-card-media"><div class="wae-ph">🎬</div></div>`;
        } else if (isAudio) {
            media = `<div class="wae-card-media"><div class="wae-ph">🎧</div></div>`;
        } else {
            media = `<div class="wae-card-media"><div class="wae-ph">${fallback}</div></div>`;
        }
        return `<div class="wae-card" data-idx="${waeAssets.indexOf(a)}">
            <div style="position:relative;">${media}<span class="wae-card-cat">${escapeHtml(a.category || a.type)}</span></div>
            <div class="wae-card-body"><div class="wae-card-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</div><div class="wae-card-meta"><span>${escapeHtml(a.ext || a.type)}</span><span>${a.lazy ? 'lazy' : ''}</span></div></div>
        </div>`;
    }).join('');
    if (filtered.length > pageSize) {
        const more = document.createElement('button');
        more.className = 'wae-copy-btn';
        more.textContent = `Show more (${pageSize} of ${filtered.length})`;
        more.onclick = () => { grid.dataset.limit = pageSize + 100; waeRenderGrid(); };
        grid.appendChild(more);
    }
    grid.querySelectorAll('.wae-card').forEach(card => {
        card.addEventListener('click', () => waeOpenLightbox(waeAssets[parseInt(card.dataset.idx, 10)]));
    });
    grid.querySelectorAll('[data-fallback]').forEach(el => {
        el.addEventListener('error', () => {
            const ph = document.createElement('div');
            ph.className = 'wae-ph';
            ph.textContent = el.dataset.fallback;
            el.replaceWith(ph);
        });
        if (el.tagName === 'VIDEO') {
            el.addEventListener('mouseover', () => el.play().catch(() => { }));
            el.addEventListener('mouseout', () => el.pause());
        }
    });
}

/** Inline SVG from a scraped page is untrusted: show it through <img> so scripts can never run. */
function waeSvgDataUrl(raw) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(raw);
}

function copyText(text, okMessage) {
    navigator.clipboard.writeText(text)
        .then(() => showToast(okMessage, 'success'))
        .catch(() => showToast('Copy failed', 'error'));
}

function waeRenderPalette() {
    const row = document.getElementById('wae-palette-row');
    if (!row) return;
    row.innerHTML = waeSiteData.palette.map(hex =>
        `<div class="wae-swatch" style="background:${escapeHtml(hex)}" title="${escapeHtml(hex)}" data-hex="${escapeHtml(hex)}"></div>`
    ).join('');
    row.querySelectorAll('.wae-swatch').forEach(sw => {
        sw.addEventListener('click', () => copyText(sw.dataset.hex, `Copied ${sw.dataset.hex}`));
    });
}

function waeRenderPanels() {
    const s = waeSiteData;
    const panelGrid = document.getElementById('wae-panel-grid');
    if (!panelGrid) return;
    panelGrid.innerHTML = `
        <div class="wae-panel"><h4>🧬 Technology</h4>${s.tech.length ? s.tech.map(t => `<div class="wae-kv"><span>Detected</span><b>${escapeHtml(t)}</b></div>`).join('') : '<div class="wae-kv"><span>No signatures matched</span></div>'}</div>
        <div class="wae-panel"><h4>🏷️ Meta & SEO</h4>
            <div class="wae-kv"><span>Title</span><b>${escapeHtml((s.title || '—').slice(0, 35))}</b></div>
            <div class="wae-kv"><span>Description</span><b>${s.meta['description'] ? '✓' : '—'}</b></div>
            <div class="wae-kv"><span>Open Graph</span><b>${s.meta['og:title'] ? '✓' : '—'}</b></div>
            <div class="wae-kv"><span>Viewport</span><b>${s.hasViewport ? '✓' : '—'}</b></div>
        </div>
        <div class="wae-panel"><h4>🔤 Fonts</h4>${s.fonts.length ? s.fonts.slice(0, 6).map(f => `<div class="wae-kv"><span>${escapeHtml(f.name)}</span><b>${f.ext}</b></div>`).join('') : '<div class="wae-kv"><span>No custom fonts</span></div>'}</div>
        <div class="wae-panel"><h4>📈 Counts</h4>
            <div class="wae-kv"><span>Images</span><b>${s.counts.images}</b></div>
            <div class="wae-kv"><span>Scripts</span><b>${s.counts.scripts}</b></div>
            <div class="wae-kv"><span>Lazy-loaded</span><b>${s.counts.lazy}</b></div>
            <div class="wae-kv"><span>Modern formats</span><b>${s.counts.modern}</b></div>
            <div class="wae-kv"><span>Total</span><b>${waeAssets.length}</b></div>
        </div>
    `;
}

function waeOpenLightbox(a) {
    waeActiveAsset = a;
    const isInline = a.type === 'svg-inline';
    const isImg = a.type === 'image' || a.type === 'icon';
    const safeUrl = escapeHtml(a.url);
    const fallbackEmoji = escapeHtml(WAE_EMOJI[a.category] || WAE_EMOJI[a.type] || '📄');
    let mediaHtml;
    let tagName = 'img';
    let snippet = `<img src="${a.url}" alt="">`;
    if (isInline) {
        mediaHtml = `<img src="${waeSvgDataUrl(a.raw)}" alt="" style="max-width:100%;max-height:60vh">`;
        snippet = a.raw;
    } else if (isImg) {
        mediaHtml = `<img src="${safeUrl}" referrerpolicy="no-referrer" data-fallback="${fallbackEmoji}" alt=""/>`;
    } else if (a.type === 'video' && a.category === 'iframe') {
        mediaHtml = `<iframe src="${safeUrl}" sandbox="allow-scripts allow-same-origin allow-presentation" style="width:100%;aspect-ratio:16/9;border:none;" allowfullscreen></iframe>`;
        snippet = `<iframe src="${a.url}" allowfullscreen></iframe>`;
        tagName = 'iframe';
    } else if (a.type === 'video') {
        mediaHtml = `<video src="${safeUrl}" controls autoplay style="max-width:100%; max-height:60vh; border-radius:8px;"></video>`;
        snippet = `<video src="${a.url}" controls></video>`;
        tagName = 'video';
    } else if (a.type === 'audio') {
        mediaHtml = `<div style="display:flex;align-items:center;justify-content:center;height:100%;"><audio src="${safeUrl}" controls autoplay></audio></div>`;
        snippet = `<audio src="${a.url}" controls></audio>`;
        tagName = 'audio';
    } else {
        mediaHtml = `<div style="font-size:40px;">${fallbackEmoji}</div>`;
    }

    let lb = document.getElementById('wae-lightbox');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'wae-lightbox';
        lb.className = 'wae-lightbox';
        document.body.appendChild(lb);
    }
    lb.onclick = (e) => { if (e.target === lb) lb.classList.remove('show'); };
    lb.innerHTML = `
        <div class="wae-lb-inner">
            <div style="position:relative;">
                <div data-act="close" style="position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:10px;background:rgba(0,0,0,0.5);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:3;font-size:14px;">✕</div>
                <div class="wae-lb-media">${mediaHtml}</div>
            </div>
            <div class="wae-lb-content">
                <h3>${escapeHtml(a.name)}</h3>
                <div class="wae-lb-url">${isInline ? '(inline SVG)' : safeUrl}</div>
                <div class="wae-copy-grid">
                    <button class="wae-copy-btn" data-act="url">Copy URL</button>
                    <button class="wae-copy-btn" data-act="html">Copy &lt;${tagName}&gt;</button>
                    <button class="wae-copy-btn" data-act="md">Copy MD</button>
                    <button class="wae-copy-btn" data-act="css">Copy CSS bg</button>
                    <button class="wae-copy-btn" data-act="download" style="grid-column: 1 / -1; background: var(--vs-accent); color: white; border-color: var(--vs-accent);">
                        <i class="fa-solid fa-download"></i> ${a.category === 'iframe' ? 'Open Embedded Player' : ['m3u8', 'mpd'].includes(a.ext) ? 'Save Stream Manifest' : 'Download Asset'}
                    </button>
                </div>
            </div>
        </div>
    `;
    const actions = {
        close: () => lb.classList.remove('show'),
        url: () => copyText(a.url, 'URL copied!'),
        html: () => copyText(snippet, 'HTML copied!'),
        md: () => copyText(`![${a.name}](${a.url})`, 'MD copied!'),
        css: () => copyText(`background-image: url('${a.url}')`, 'CSS copied!'),
        download: () => waeDownloadAsset(a),
    };
    lb.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', actions[el.dataset.act]));
    lb.querySelectorAll('[data-fallback]').forEach(el => {
        el.addEventListener('error', () => { const d = document.createElement('div'); d.style.fontSize = '40px'; d.textContent = el.dataset.fallback; el.replaceWith(d); });
    });
    lb.classList.add('show');
}

async function waeDownloadAsset(asset) {
    if (!asset) return;
    if (asset.category === 'iframe') {
        if (window.SanNative?.available) SanNative.openExternal(asset.url);
        else window.open(asset.url, '_blank', 'noopener,noreferrer');
        return showToast('Opened the embedded player. It is not a downloadable video file.', 'info');
    }
    const button = document.querySelector('#wae-lightbox [data-act="download"]');
    if (button) button.disabled = true;
    try {
        if (asset.type === 'svg-inline') {
            await waeSaveBlob(new Blob([asset.raw], { type: 'image/svg+xml;charset=utf-8' }), asset.name);
            showToast('SVG saved.', 'success');
        } else if (window.SanNative?.available) {
            await SanNative.downloadWebAsset(asset.url, asset.name, waeSiteData.url);
            showToast('Download queued. Check Android Downloads for progress.', 'success');
        } else {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 60000);
            try {
                const response = await fetch(asset.url, { signal: controller.signal, credentials: 'omit' });
                if (!response.ok) throw new Error('HTTP ' + response.status);
                await waeSaveBlob(await response.blob(), asset.name);
                showToast('Asset saved.', 'success');
            } finally { clearTimeout(timer); }
        }
    } catch (error) {
        showToast('Download failed: ' + error.message + (window.SanNative?.available ? '' : '. Use Copy URL to save it in your browser, or download from the Android app.'), 'error');
    } finally { if (button) button.disabled = false; }
}

async function waeSaveBlob(blob, name) {
    if (window.SanNative?.available) return SanNative.downloadBlob(blob, name);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name;
    document.body.appendChild(link);
    link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function waeExportJson() {
    if (!waeAssets.length) { showToast('Analyze a site first.', 'error'); return; }
    const data = { site: waeSiteData, assets: waeAssets.map(({ raw, ...rest }) => rest) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    try {
        await waeSaveBlob(blob, 'asset-report.json');
        showToast('Downloaded asset-report.json', 'success');
    } catch (error) { showToast('Export failed: ' + error.message, 'error'); }
}
