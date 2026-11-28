/**
 * Catalog Filter Preset Saver Bookmarkable Slot Pills Controller (#1556)
 * Allows users to save combinations of active search, category, and density filters
 * into up to 5 named preset slot pills, saved in localStorage for 1-click restoration.
 */

class FilterPresetManager {
    static STORAGE_KEY = 'arcadeverse_filter_presets';
    static MAX_PRESETS = 5;

    constructor() {
        this.presets = this.loadPresets();
    }

    loadPresets() {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(FilterPresetManager.STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    saveToStorage() {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(FilterPresetManager.STORAGE_KEY, JSON.stringify(this.presets));
        }
    }

    addPreset(name, filterState) {
        if (!name || !filterState) return false;
        if (this.presets.length >= FilterPresetManager.MAX_PRESETS) {
            return false;
        }

        const preset = {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name: name.trim().slice(0, 15),
            filters: { ...filterState }
        };

        this.presets.push(preset);
        this.saveToStorage();
        return preset;
    }

    removePreset(id) {
        const initialLen = this.presets.length;
        this.presets = this.presets.filter((p) => p.id !== id);
        this.saveToStorage();
        return this.presets.length < initialLen;
    }

    getPresets() {
        return [...this.presets];
    }

    renderPresetsBar(container, onApplyPreset, onSaveRequest) {
        if (!container || typeof document === 'undefined') return null;

        container.innerHTML = '';
        const bar = document.createElement('div');
        bar.className = 'filter-presets-bar';

        this.presets.forEach((preset) => {
            const pill = document.createElement('div');
            pill.className = 'preset-slot-pill';
            pill.innerHTML = `
                <span>${preset.name}</span>
                <button class="preset-delete-btn" aria-label="Delete preset ${preset.name}">&times;</button>
            `;

            pill.addEventListener('click', (e) => {
                if (e.target.classList.contains('preset-delete-btn')) {
                    e.stopPropagation();
                    this.removePreset(preset.id);
                    this.renderPresetsBar(container, onApplyPreset, onSaveRequest);
                    return;
                }
                if (typeof onApplyPreset === 'function') {
                    onApplyPreset(preset.filters);
                }
            });

            bar.appendChild(pill);
        });

        if (this.presets.length < FilterPresetManager.MAX_PRESETS) {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'save-preset-btn';
            saveBtn.textContent = '+ Save Preset';
            saveBtn.addEventListener('click', () => {
                if (typeof onSaveRequest === 'function') {
                    onSaveRequest();
                }
            });
            bar.appendChild(saveBtn);
        }

        container.appendChild(bar);
        return bar;
    }
}

if (typeof document !== 'undefined') {
    window.arcadeVersePresets = new FilterPresetManager();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FilterPresetManager };
}
