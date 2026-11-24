/**
 * Keyboard Shortcut Legend Overlay Modal (#1380)
 * Global hotkey cheat sheet listener ('?' / Shift+'/') displaying categorized
 * keyboard shortcuts with beveled 3D retro keycap pills and printable layout.
 */

class ShortcutLegendModal {
    constructor() {
        this.isOpen = false;
        this.modalElement = null;
        this.categories = [
            {
                name: 'Navigation & Browsing',
                shortcuts: [
                    { keys: ['/'], description: 'Focus search input bar' },
                    { keys: ['Tab'], description: 'Navigate interactive controls' },
                    { keys: ['Shift', 'Tab'], description: 'Navigate controls backwards' }
                ]
            },
            {
                name: 'Audio & Sound Controls',
                shortcuts: [
                    { keys: ['M'], description: 'Toggle global audio mute / unmute' },
                    { keys: ['+', '='], description: 'Increase synthesizer master volume' },
                    { keys: ['-'], description: 'Decrease synthesizer master volume' }
                ]
            },
            {
                name: 'Game Modal & Controls',
                shortcuts: [
                    { keys: ['Esc'], description: 'Close active modal / pause gameplay' },
                    { keys: ['F'], description: 'Toggle fullscreen canvas mode' },
                    { keys: ['R'], description: 'Quick restart current game' }
                ]
            },
            {
                name: 'Help & Accessibility',
                shortcuts: [
                    { keys: ['?'], description: 'Toggle keyboard shortcut cheat sheet' },
                    { keys: ['Alt', 'S'], description: 'Jump to skip-to-content navigation' }
                ]
            }
        ];
    }

    init() {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', (e) => {
            // Ignore if active input or textarea
            const targetTag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
            if (targetTag === 'input' || targetTag === 'textarea') return;

            if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.render();
    }

    close() {
        this.isOpen = false;
        if (this.modalElement && this.modalElement.parentNode) {
            this.modalElement.parentNode.removeChild(this.modalElement);
            this.modalElement = null;
        }
    }

    render() {
        if (typeof document === 'undefined') return;
        if (this.modalElement) this.close();

        this.modalElement = document.createElement('div');
        this.modalElement.className = 'shortcut-legend-overlay';
        this.modalElement.setAttribute('role', 'dialog');
        this.modalElement.setAttribute('aria-modal', 'true');
        this.modalElement.setAttribute('aria-label', 'Keyboard Shortcuts Legend');

        const card = document.createElement('div');
        card.className = 'shortcut-legend-card';

        let html = `
            <div class="shortcut-legend-header">
                <h3>ARCADE KEYBOARD SHORTCUTS</h3>
                <button class="shortcut-legend-close" aria-label="Close shortcuts modal">&times;</button>
            </div>
            <div class="shortcut-legend-grid">
        `;

        for (const cat of this.categories) {
            html += `<div class="shortcut-cat-column">
                <h4>${cat.name}</h4>
                <ul class="shortcut-list">`;
            for (const sc of cat.shortcuts) {
                const keysHtml = sc.keys.map(k => `<kbd class="retro-keycap">${k}</kbd>`).join(' + ');
                html += `<li><span class="keys-wrap">${keysHtml}</span> <span class="desc-wrap">${sc.description}</span></li>`;
            }
            html += `</ul></div>`;
        }

        html += `
            </div>
            <div class="shortcut-legend-footer">
                <span>Press <kbd class="retro-keycap">Esc</kbd> or click outside to dismiss</span>
                <button class="shortcut-legend-print" onclick="window.print()">Print Cheat Sheet</button>
            </div>
        `;

        card.innerHTML = html;
        this.modalElement.appendChild(card);

        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) {
                this.close();
            }
        });

        const closeBtn = card.querySelector('.shortcut-legend-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        document.body.appendChild(this.modalElement);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShortcutLegendModal };
}

if (typeof window !== 'undefined') {
    window.ShortcutLegendModal = ShortcutLegendModal;
}
