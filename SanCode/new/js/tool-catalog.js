// Catalog metadata stays separate from the existing tool implementations.
const catalogTools = [
    ['tools', 'Format code', 'Code', 'wand-magic-sparkles', 'format clean text'],
    ['snippets', 'Snippets', 'Code', 'puzzle-piece', 'code saved'],
    ['devkit', 'Developer kit', 'Code', 'toolbox', 'json base64 encode decode'],
    ['word', 'Word processor', 'Documents', 'file-word', 'document write'],
    ['excel', 'Spreadsheet', 'Documents', 'table', 'excel cells csv'],
    ['doc-tools', 'PDF tools', 'Documents', 'file-pdf', 'document merge split'],
    ['video', 'Media player', 'Web & media', 'circle-play', 'video audio music'],
    ['yt-thumbnail', 'YouTube thumbnails', 'Web & media', 'image', 'download video'],
    ['extractor', 'Web extractor', 'Web & media', 'globe', 'website html'],
    ['drive-extractor', 'Drive links', 'Web & media', 'link', 'google extract id'],
    ['asset-explorer', 'Web assets', 'Web & media', 'images', 'website images'],
    ['qr-generator', 'QR code', 'Generators', 'qrcode', 'qr generate'],
    ['contact-links', 'Contact links', 'Generators', 'address-book', 'phone whatsapp'],
    ['formatter', 'Phone numbers', 'Generators', 'phone', 'india in number format'],
    ['templates', 'Message templates', 'Generators', 'comment', 'whatsapp messages']
];
const catalogGroups = ['All', 'Favorites', 'Recent', 'Code', 'Documents', 'Web & media', 'Generators'];
let catalogGroup = 'All';
let catalogPreferences = { favorites: [], recent: [] };
try {
    const saved = JSON.parse(localStorage.getItem('sancode.toolCatalog') || '{}');
    for (const key of ['favorites', 'recent']) {
        if (Array.isArray(saved[key])) catalogPreferences[key] = [...new Set(saved[key])].filter(id => catalogTools.some(tool => tool[0] === id));
    }
} catch { /* Storage may be disabled or contain an older value. */ }

function saveCatalogPreferences() {
    try { localStorage.setItem('sancode.toolCatalog', JSON.stringify(catalogPreferences)); } catch { /* Favorites still work for this session. */ }
}

function rememberTool(id) {
    if (!catalogTools.some(tool => tool[0] === id)) return;
    catalogPreferences.recent = [id, ...catalogPreferences.recent.filter(item => item !== id)].slice(0, 6);
    saveCatalogPreferences();
}

function renderToolCatalog(query = document.getElementById('tool-search').value) {
    const grid = document.querySelector('#mobile-tool-drawer .drawer-grid');
    const terms = query.trim().toLowerCase().split(/\s+/);
    let tools = catalogTools.filter(tool => terms.every(term => tool.join(' ').toLowerCase().includes(term)));
    if (catalogGroup === 'Favorites') tools = tools.filter(tool => catalogPreferences.favorites.includes(tool[0]));
    else if (catalogGroup === 'Recent') tools = catalogPreferences.recent.map(id => tools.find(tool => tool[0] === id)).filter(Boolean);
    else if (catalogGroup !== 'All') tools = tools.filter(tool => tool[2] === catalogGroup);
    grid.replaceChildren();
    const empty = document.getElementById('tool-search-empty');
    empty.hidden = tools.length !== 0;
    empty.textContent = query.trim() ? 'No matching tools' : catalogGroup === 'Favorites' ? 'No favorites yet' : 'No recent tools';
    for (const tool of tools) {
        const [id, label, category, icon] = tool;
        const row = document.createElement('div');
        row.className = 'catalog-row';
        const button = document.createElement('button');
        button.className = 'drawer-item';
        button.dataset.tool = id;
        button.onclick = () => mobileOpenTool(id);
        const symbol = document.createElement('i');
        symbol.className = 'fa-solid fa-' + icon;
        symbol.setAttribute('aria-hidden', 'true');
        symbol.dataset.category = category;
        const text = document.createElement('span');
        text.textContent = label;
        button.append(symbol, text);
        const star = document.createElement('button');
        star.className = 'catalog-favorite';
        const selected = catalogPreferences.favorites.includes(id);
        star.setAttribute('aria-label', 'Favorite ' + label);
        star.title = (selected ? 'Remove favorite: ' : 'Favorite: ') + label;
        star.setAttribute('aria-pressed', String(selected));
        const starIcon = document.createElement('i');
        starIcon.className = (selected ? 'fa-solid' : 'fa-regular') + ' fa-star';
        star.append(starIcon);
        star.onclick = () => {
            catalogPreferences.favorites = selected ? catalogPreferences.favorites.filter(item => item !== id) : [...catalogPreferences.favorites, id];
            saveCatalogPreferences();
            renderToolCatalog();
            const next = grid.querySelector(`[data-tool="${id}"]`)?.nextElementSibling;
            (next || document.querySelector('#tool-categories [aria-pressed="true"]')).focus();
        };
        row.append(button, star);
        grid.append(row);
    }
}

let catalogReturnFocus;
let catalogBackground = [];
function openCatalogFocus() {
    renderToolCatalog();
    catalogReturnFocus = document.activeElement;
    const drawer = document.getElementById('mobile-tool-drawer');
    catalogBackground = [...document.body.children].filter(el => el !== drawer && el.id !== 'mobile-drawer-backdrop' && !['SCRIPT', 'STYLE'].includes(el.tagName)).map(el => [el, el.inert]);
    catalogBackground.forEach(([el]) => { el.inert = true; });
    drawer.focus({ preventScroll: true });
}
function closeCatalogFocus() {
    catalogBackground.forEach(([el, inert]) => { el.inert = inert; });
    catalogBackground = [];
    catalogReturnFocus?.focus({ preventScroll: true });
}
document.addEventListener('DOMContentLoaded', () => {
    const categories = document.getElementById('tool-categories');
    for (const group of catalogGroups) {
        const button = document.createElement('button');
        button.textContent = group;
        button.setAttribute('aria-pressed', String(group === catalogGroup));
        button.onclick = () => {
            catalogGroup = group;
            for (const item of categories.children) item.setAttribute('aria-pressed', String(item === button));
            renderToolCatalog();
        };
        categories.append(button);
    }
    renderToolCatalog();
    document.getElementById('mobile-tool-drawer').addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeMobileToolDrawer();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = [...event.currentTarget.querySelectorAll('button, input')].filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
});
