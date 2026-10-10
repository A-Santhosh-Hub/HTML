/* Browser-only conveniences; Android sources remain independent of this export. */
(function () {
    'use strict';
    function note(panel, text) {
        const host = document.querySelector(panel);
        if (!host) return;
        const paragraph = document.createElement('p');
        paragraph.className = 'text-xs text-vs-textMuted p-3';
        paragraph.textContent = text;
        host.appendChild(paragraph);
    }
    note('#sidebar-todo', 'Browser reminders need this page to remain open. Sleeping devices and suspended tabs can delay alarms.');
    note('#sidebar-workspace', 'Folders are imported into this browser session. Download Workspace ZIP to keep your changes; browser edits do not overwrite the original folder.');
    note('#sidebar-settings', 'Your notes and settings are stored in this browser. Export important work before clearing site data.');
    if (location.protocol === 'file:') {
        showToast('For all browser features, use the included local server or publish this folder on GitHub Pages.', 'info');
    }

    async function readHtml(input) {
        const file = input.files[0];
        if (!file) return null;
        if (file.size > 8 * 1024 * 1024) throw new Error('HTML source exceeds the 8 MB limit.');
        const text = await file.text();
        if (!text.trim()) throw new Error('The HTML file is empty.');
        return { file, text };
    }
    document.getElementById('browser-source-file').addEventListener('change', async event => {
        try {
            const imported = await readHtml(event.target);
            if (!imported) return;
            if (state.previewVisible) toggleHtmlPreview();
            openTextTab({ name: imported.file.name, content: imported.text, format: 'html' });
            saveToHistory(imported.text, 'html', 'Opened ' + imported.file.name);
            document.getElementById('extract-status').textContent = 'Opened saved source: ' + imported.file.name;
            if (isMobile()) closeMobileSidebar();
        } catch (error) { showToast(error.message, 'error'); }
        finally { event.target.value = ''; }
    });
    document.getElementById('browser-assets-file').addEventListener('change', async event => {
        try {
            const imported = await readHtml(event.target);
            if (!imported) return;
            const url = SanWeb.normalizeUrl(document.getElementById('wae-url-input').value);
            await waeAnalyze({ text: imported.text, url, status: 200, contentType: 'text/html', transport: 'saved HTML' });
        } catch (error) { showToast('Enter the original page URL first. ' + error.message, 'error'); }
        finally { event.target.value = ''; }
    });
})();
