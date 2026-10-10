const workbenchControls = {
    fontSize: ['setting-font', 'setFontSize'],
    wordWrap: ['setting-wrap', 'setWordWrap'],
    indentGuides: ['setting-guides', 'setGuides'],
    rainbowBrackets: ['setting-brackets', 'setRainbow'],
    renderWhitespace: ['setting-whitespace', 'setWhitespace'],
    glassEffects: ['setting-glass', null]
};

function syncWorkbenchSettings() {
    for (const [key, [id]] of Object.entries(workbenchControls)) {
        const control = document.getElementById(id);
        if (!control) continue;
        if (key === 'fontSize') control.value = state.settings[key] || 14;
        else control.checked = ['glassEffects', 'indentGuides', 'rainbowBrackets'].includes(key) ? state.settings[key] !== false : !!state.settings[key];
    }
    document.getElementById('setting-font-value').textContent = (state.settings.fontSize || 14) + ' px';
    document.body.classList.toggle('solid-surfaces', state.settings.glassEffects === false);
}

function setWorkbenchSetting(key, value) {
    const spec = workbenchControls[key];
    if (!spec) return;
    if (key === 'fontSize') {
        if (!Number.isFinite(value)) return;
        value = Math.max(10, Math.min(28, Math.round(value)));
    } else value = !!value;
    state.settings[key] = value;
    if (ed && spec[1]) ed[spec[1]](value);
    if (key === 'wordWrap') applyWordWrap();
    saveSettings();
    syncWorkbenchSettings();
}

document.addEventListener('DOMContentLoaded', syncWorkbenchSettings);
