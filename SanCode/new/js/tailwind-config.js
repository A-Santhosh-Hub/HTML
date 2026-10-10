tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['Fira Code', 'Consolas', 'monospace'],
            },
            colors: {
                vs: {
                    activity: 'var(--vs-activity)',
                    activityActive: 'var(--vs-activityActive)',
                    activityInactive: 'var(--vs-activityInactive)',
                    sidebar: 'var(--vs-sidebar)',
                    editor: 'var(--vs-editor)',
                    tabInactive: 'var(--vs-tabInactive)',
                    tabActive: 'var(--vs-tabActive)',
                    tabBorder: 'var(--vs-tabBorder)',
                    statusBar: 'var(--vs-statusBar)',
                    text: 'var(--vs-text)',
                    textMuted: 'var(--vs-textMuted)',
                    border: 'var(--vs-border)',
                    hover: 'var(--vs-hover)',
                    selection: 'var(--vs-selection)',
                    accent: 'var(--vs-accent)',
                    accentHover: 'var(--vs-accentHover)'
                }
            }
        }
    }
}
