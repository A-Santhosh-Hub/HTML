/* Shared source transport and inert asset discovery for Web Extractor / Web Assets. */
(function (global) {
    'use strict';
    const LIMIT = 8 * 1024 * 1024;
    function normalizeUrl(value) {
        let text = String(value || '').trim();
        if (!text) throw new Error('Enter a website URL.');
        if (!/^[a-z][a-z\d+.-]*:/i.test(text)) text = 'https://' + text;
        let url;
        try { url = new URL(text); } catch (_) { throw new Error('Enter a valid website URL.'); }
        if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS URL without embedded credentials.');
        url.hash = '';
        return url.href;
    }

    async function request(url, proxy) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 18000);
        try {
            const response = await fetch(proxy ? 'https://api.allorigins.win/get?url=' + encodeURIComponent(url) : url,
                { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
            if (!response.ok) throw new Error('HTTP ' + response.status + (proxy ? ' from the public proxy.' : ' from the website.'));
            if (Number(response.headers.get('content-length')) > LIMIT) throw new Error('Source exceeds the 8 MB limit.');
            // Bound decoded response bytes even when Content-Length is missing or compressed.
            let body;
            if (response.body && response.body.getReader) {
                const reader = response.body.getReader(), chunks = [];
                let size = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    size += value.byteLength;
                    if (size > LIMIT) { await reader.cancel(); throw new Error('Source exceeds the 8 MB limit.'); }
                    chunks.push(value);
                }
                body = new Uint8Array(size);
                let offset = 0;
                chunks.forEach(chunk => { body.set(chunk, offset); offset += chunk.length; });
            } else body = new Uint8Array(await response.arrayBuffer());
            if (body.length > LIMIT) throw new Error('Source exceeds the 8 MB limit.');
            const type = response.headers.get('content-type') || '';
            const declaration = /charset\s*=\s*["']?([\w.-]+)/i.exec(type) || /charset\s*=\s*["']?([\w.-]+)/i.exec(new TextDecoder().decode(body.slice(0, 4096)));
            let decoder;
            try { decoder = new TextDecoder(proxy ? 'utf-8' : declaration ? declaration[1] : 'utf-8'); } catch (_) { decoder = new TextDecoder(); }
            const text = decoder.decode(body);
            if (proxy) {
                const data = JSON.parse(text);
                const status = Number(data.status && data.status.http_code);
                if (status >= 400) throw new Error('HTTP ' + status + ' from the website.');
                if (typeof data.contents !== 'string') throw new Error('The public proxy returned no source.');
                return { text: data.contents, url: normalizeUrl(data.status && data.status.url || url), status: status || 200, contentType: data.status && data.status.content_type || '', transport: 'public proxy' };
            }
            return { text, url: response.url || url, status: response.status, contentType: type, transport: 'browser' };
        } catch (error) {
            if (error.name === 'AbortError') throw new Error('Website request timed out. Try again.');
            throw error;
        } finally { clearTimeout(timer); }
    }

    async function fetchText(value, options = {}) {
        const url = normalizeUrl(value);
        let result;
        if (global.SanNative && SanNative.available) {
            result = await SanNative.fetchWebText(url);
        } else {
            try { result = await request(url, false); }
            catch (error) {
                if (!options.allowProxy) throw new Error(error.message + ' This site may block browser requests. Enable the optional public proxy, or use saved HTML.');
                try { result = await request(url, true); }
                catch (proxyError) {
                    throw new Error('Could not read the website directly or through the public proxy (' + proxyError.message + '). Use Open saved HTML source or Analyze saved HTML.');
                }
            }
        }
        if (!result.text || !result.text.trim()) throw new Error('The website returned an empty response.');
        if (options.html && result.contentType && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(result.contentType)) {
            throw new Error('The URL returned ' + result.contentType + '. Enter a web page URL.');
        }
        return result;
    }

    function abs(value, base) {
        if (!value || !value.trim() || value.trim().startsWith('#')) return null;
        try { const u = new URL(value, base); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : null; } catch (_) { return null; }
    }
    function ext(url) { try { return (new URL(url).pathname.match(/\.([\w]+)$/) || [,''])[1].toLowerCase(); } catch (_) { return ''; } }
    function typeOf(url, fallback = 'file') {
        const suffix = ext(url);
        if (/^(png|jpe?g|gif|webp|avif|svg|bmp|ico|tiff?)$/.test(suffix)) return 'image';
        if (/^(mp4|webm|ogv|mov|m4v|m3u8|mpd)$/.test(suffix)) return 'video';
        if (/^(mp3|wav|ogg|m4a|aac|flac|opus)$/.test(suffix)) return 'audio';
        if (/^(woff2?|ttf|otf|eot)$/.test(suffix)) return 'font';
        if (suffix === 'css') return 'css';
        if (/^(m?js)$/.test(suffix)) return 'script';
        return fallback;
    }
    // Srcset URLs can contain commas (including data URLs); whitespace descriptors delimit candidates.
    function srcset(value) {
        const urls = [];
        // Tokenize as the HTML algorithm does: URL up to whitespace, then descriptors up to comma.
        let rest = String(value || '');
        while (rest.trim()) {
            rest = rest.replace(/^[\s,]+/, '');
            const match = /^\S+/.exec(rest);
            if (!match) break;
            let url = match[0]; rest = rest.slice(url.length);
            if (url.endsWith(',')) url = url.replace(/,+$/, '');
            else { const comma = rest.indexOf(','); rest = comma < 0 ? '' : rest.slice(comma + 1); }
            if (!url.startsWith('data:')) urls.push(url);
        }
        return urls;
    }

    function collect(doc, pageUrl) {
        const base = abs(doc.querySelector('base[href]')?.getAttribute('href'), pageUrl) || pageUrl;
        const assets = [], seen = new Set(), sheets = [];
        let truncated = false;
        function add(value, type, category, extra = {}, from = base) {
            const url = abs(value, from);
            if (!url || seen.has(url)) return;
            if (assets.length >= 3000) { truncated = true; return; }
            seen.add(url);
            const actualType = type || typeOf(url);
            let name = new URL(url).pathname.split('/').filter(Boolean).pop() || 'asset';
            try { name = decodeURIComponent(name); } catch (_) { /* keep literal filename */ }
            assets.push({ url, ref: value, name, type: actualType, category: category || actualType, ext: ext(url), ...extra });
            if (actualType === 'css') sheets.push(url);
        }
        function css(text, from = base) {
            // Handle imports before url() so extensionless stylesheets get the correct type.
            for (const match of text.matchAll(/@import\s+(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)|"([^"]+)"|'([^']+)')/gi)) add(match[1] || match[2] || match[3] || match[4] || match[5], 'css', 'css', {}, from);
            for (const match of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi)) {
                const value = match[1] || match[2] || match[3];
                const url = abs(value, from);
                if (url) add(value, typeOf(url, 'image'), typeOf(url, 'image') === 'image' ? 'background' : null, {}, from);
            }
        }
        doc.querySelectorAll('img, picture source').forEach(node => {
            const lazy = node.getAttribute('loading') === 'lazy' || node.hasAttribute('data-src');
            ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-url'].forEach(attr => add(node.getAttribute(attr), 'image', 'image', { lazy, alt: node.getAttribute('alt') || '' }));
            ['srcset', 'data-srcset', 'data-lazy-srcset'].forEach(attr => srcset(node.getAttribute(attr)).forEach(url => add(url, 'image', 'responsive', { lazy })));
        });
        doc.querySelectorAll('video, audio, video source, audio source').forEach(node => {
            const type = node.closest('audio') ? 'audio' : 'video';
            add(node.getAttribute('src'), type);
            add(node.getAttribute('data-src'), type);
            add(node.getAttribute('poster'), 'image', 'poster');
        });
        doc.querySelectorAll('script[src]').forEach(node => add(node.getAttribute('src'), 'script'));
        doc.querySelectorAll('link[href]').forEach(node => {
            const rel = (node.getAttribute('rel') || '').toLowerCase().split(/\s+/);
            const as = node.getAttribute('as');
            if (rel.includes('stylesheet')) add(node.getAttribute('href'), 'css');
            else if (rel.some(r => r.includes('icon'))) add(node.getAttribute('href'), 'icon');
            else if (rel.includes('preload') || rel.includes('modulepreload')) add(node.getAttribute('href'), ({style: 'css', image: 'image', font: 'font', script: 'script', video: 'video', audio: 'audio'})[as] || (rel.includes('modulepreload') ? 'script' : undefined));
        });
        doc.querySelectorAll('meta[content]').forEach(node => {
            const key = node.getAttribute('property') || node.getAttribute('name') || '';
            if (/^(og|twitter):(image|video|audio)(:url|:secure_url)?$/.test(key)) add(node.getAttribute('content'), key.includes('video') ? 'video' : key.includes('audio') ? 'audio' : 'image', 'social');
        });
        doc.querySelectorAll('a[href]').forEach(node => {
            const value = node.getAttribute('href'), url = abs(value, base);
            if (url && (node.hasAttribute('download') || typeOf(url) !== 'file' || /^(pdf|zip|rar|7z|docx?|xlsx?|pptx?|csv|txt|epub)$/.test(ext(url)))) add(value);
        });
        doc.querySelectorAll('iframe[src]').forEach(node => {
            const url = abs(node.getAttribute('src'), base);
            if (url && /(^|\.)(youtube\.com|youtube-nocookie\.com|vimeo\.com)$/.test(new URL(url).hostname)) add(url, 'video', 'iframe');
        });
        doc.querySelectorAll('svg').forEach((node, i) => {
            if (assets.length >= 3000) { truncated = true; return; }
            const svg = node.cloneNode(true);
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            assets.push({ url: 'inline-svg-' + i, name: 'inline-svg-' + (i + 1) + '.svg', type: 'svg-inline', category: 'svg', ext: 'svg', raw: new XMLSerializer().serializeToString(svg) });
        });
        doc.querySelectorAll('svg use').forEach(node => add(node.getAttribute('href') || node.getAttribute('xlink:href'), 'image', 'svg'));
        doc.querySelectorAll('style').forEach(node => css(node.textContent));
        doc.querySelectorAll('[style]').forEach(node => css(node.getAttribute('style')));
        return { assets, sheets, css, get truncated() { return truncated; } };
    }

    async function discover(doc, pageUrl, options = {}) {
        const result = collect(doc, pageUrl), visited = new Set(), warnings = [];
        const deadline = Date.now() + 45000;
        // Each batch is bounded; @imports are added to the queue by the CSS parser.
        while (visited.size < 18 && Date.now() < deadline) {
            const batch = result.sheets.filter(url => !visited.has(url)).slice(0, Math.min(3, 18 - visited.size));
            if (!batch.length) break;
            batch.forEach(url => visited.add(url));
            options.progress?.('Reading stylesheets (' + visited.size + '/18)…');
            await Promise.all(batch.map(async url => {
                try {
                    const response = await fetchText(url, { allowProxy: options.allowProxy });
                    if (/text\/html/i.test(response.contentType)) throw new Error('Stylesheet returned an HTML page');
                    result.css(response.text, response.url);
                } catch (error) { warnings.push('Could not read stylesheet: ' + url + ' — ' + error.message); }
            }));
        }
        if (result.sheets.some(url => !visited.has(url))) warnings.push('Stylesheet scan limit reached; some CSS assets were not scanned.');
        if (result.truncated) warnings.push('Showing the first 3,000 discovered assets.');
        return { assets: result.assets, warnings, stylesheetCount: visited.size };
    }
    global.SanWeb = { normalizeUrl, fetchText, collect, discover, srcset };
    if (global.SanNative?.available) document.querySelectorAll('[data-web-proxy]').forEach(label => { label.style.display = 'none'; });
    [['website-url', 'extract-btn'], ['wae-url-input', 'wae-analyze-btn']].forEach(([input, button]) => {
        document.getElementById(input)?.addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); document.getElementById(button).click(); }
        });
    });
})(window);
