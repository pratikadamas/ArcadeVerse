/**
 * Favorite Folders Manager (#1490)
 * Manages custom user folder collections for favorite games:
 * createFolder, deleteFolder, renameFolder, addGameToFolder, removeGameFromFolder, getFolders.
 * Persists in localStorage under 'arcadeverse_favorite_folders'.
 */

class FavoriteFoldersManager {
    constructor() {
        this.storageKey = 'arcadeverse_favorite_folders';
        this.folders = [];
        this.activeFolderId = null;
        this.init();
    }

    init() {
        this.loadFolders();
    }

    loadFolders() {
        if (typeof localStorage === 'undefined') return;
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    this.folders = parsed;
                    return;
                }
            }
        } catch (e) {}

        // Default starter folders
        this.folders = [
            { id: 'quick-breaks', name: 'Quick Breaks', gameIds: [] },
            { id: 'high-scores', name: 'High Score Challenges', gameIds: [] }
        ];
        this.saveFolders();
    }

    saveFolders() {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.folders));
        } catch (e) {}
    }

    getFolders() {
        return [...this.folders];
    }

    getFolder(id) {
        return this.folders.find(f => f.id === id) || null;
    }

    createFolder(name) {
        if (!name || typeof name !== 'string') return null;
        const trimmed = name.trim();
        if (!trimmed) return null;

        const id = 'folder-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        const newFolder = {
            id,
            name: trimmed,
            gameIds: []
        };
        this.folders.push(newFolder);
        this.saveFolders();
        return newFolder;
    }

    deleteFolder(id) {
        const index = this.folders.findIndex(f => f.id === id);
        if (index === -1) return false;
        this.folders.splice(index, 1);
        if (this.activeFolderId === id) {
            this.activeFolderId = null;
        }
        this.saveFolders();
        return true;
    }

    renameFolder(id, newName) {
        const folder = this.getFolder(id);
        if (!folder || !newName || typeof newName !== 'string') return false;
        const trimmed = newName.trim();
        if (!trimmed) return false;
        folder.name = trimmed;
        this.saveFolders();
        return true;
    }

    addGameToFolder(folderId, gameId) {
        const folder = this.getFolder(folderId);
        if (!folder || !gameId) return false;
        if (!folder.gameIds.includes(gameId)) {
            folder.gameIds.push(gameId);
            this.saveFolders();
        }
        return true;
    }

    removeGameFromFolder(folderId, gameId) {
        const folder = this.getFolder(folderId);
        if (!folder || !gameId) return false;
        const idx = folder.gameIds.indexOf(gameId);
        if (idx !== -1) {
            folder.gameIds.splice(idx, 1);
            this.saveFolders();
            return true;
        }
        return false;
    }

    getFoldersForGame(gameId) {
        return this.folders.filter(f => f.gameIds.includes(gameId));
    }

    filterGames(gamesList, folderId) {
        if (!folderId || !Array.isArray(gamesList)) return gamesList;
        const folder = this.getFolder(folderId);
        if (!folder) return gamesList;
        return gamesList.filter(g => {
            const id = g.id || g.slug || g.title;
            return folder.gameIds.includes(id);
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FavoriteFoldersManager };
}

if (typeof window !== 'undefined') {
    window.FavoriteFoldersManager = FavoriteFoldersManager;
}
