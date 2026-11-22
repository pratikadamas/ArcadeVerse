/**
 * Client-Side Custom Game Shelf Collections & Base64 Library Exporter
 * Pure Vanilla JavaScript & Storage Manager Engine
 * Allows users to create named shelves, assign custom neon color tags, reorder games,
 * compresses shelf collections into serverless Base64 URL parameter strings, and persists
 * in localStorage under 'arcadeverse_shelves' namespace with JSON backup export.
 *
 * @module GameShelfCollections
 * @version 1.0.0
 * ArcadeVerse Nexus Spring Of Code 2026
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArcadeVerse = root.ArcadeVerse || {};
    root.ArcadeVerse.GameShelfCollections = factory();
    root.GameShelfCollections = root.ArcadeVerse.GameShelfCollections;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var STORAGE_KEY = 'arcadeverse_shelves';

  function GameShelfCollections() {
    this.shelves = this.loadShelves();
  }

  GameShelfCollections.prototype.loadShelves = function () {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {}
    return [
      { id: 'favorites', name: 'My Favorites', color: '#00dfd8', gameIds: [] },
      { id: 'speedrun', name: 'Speedrun Challenges', color: '#f59e0b', gameIds: [] }
    ];
  };

  GameShelfCollections.prototype.saveShelves = function () {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.shelves));
      }
    } catch (e) {}
  };

  GameShelfCollections.prototype.createShelf = function (name, color) {
    var id = 'shelf_' + Date.now();
    var newShelf = {
      id: id,
      name: name || 'Untitled Shelf',
      color: color || '#38bdf8',
      gameIds: []
    };
    this.shelves.push(newShelf);
    this.saveShelves();
    return newShelf;
  };

  GameShelfCollections.prototype.addGameToShelf = function (shelfId, gameId) {
    var shelf = this.getShelf(shelfId);
    if (!shelf) return false;
    if (shelf.gameIds.indexOf(gameId) === -1) {
      shelf.gameIds.push(gameId);
      this.saveShelves();
      return true;
    }
    return false;
  };

  GameShelfCollections.prototype.removeGameFromShelf = function (shelfId, gameId) {
    var shelf = this.getShelf(shelfId);
    if (!shelf) return false;
    var idx = shelf.gameIds.indexOf(gameId);
    if (idx !== -1) {
      shelf.gameIds.splice(idx, 1);
      this.saveShelves();
      return true;
    }
    return false;
  };

  GameShelfCollections.prototype.getShelf = function (shelfId) {
    for (var i = 0; i < this.shelves.length; i++) {
      if (this.shelves[i].id === shelfId) return this.shelves[i];
    }
    return null;
  };

  /**
   * Compresses shelf collection into compact Base64 shareable URL parameter
   */
  GameShelfCollections.prototype.exportShareableURL = function (shelfId) {
    var shelf = this.getShelf(shelfId);
    if (!shelf) return '';
    var payload = {
      n: shelf.name,
      c: shelf.color,
      g: shelf.gameIds
    };
    var json = JSON.stringify(payload);
    var b64 = '';
    if (typeof Buffer !== 'undefined') {
      b64 = Buffer.from(json).toString('base64');
    } else if (typeof btoa !== 'undefined') {
      b64 = btoa(unescape(encodeURIComponent(json)));
    }
    return '?shelf=' + encodeURIComponent(b64);
  };

  /**
   * Imports shelf from Base64 URL parameter
   */
  GameShelfCollections.prototype.importFromShareableString = function (b64String) {
    try {
      var json = '';
      if (typeof Buffer !== 'undefined') {
        json = Buffer.from(b64String, 'base64').toString('utf8');
      } else if (typeof atob !== 'undefined') {
        json = decodeURIComponent(escape(atob(b64String)));
      }
      var data = JSON.parse(json);
      if (data && data.n && Array.isArray(data.g)) {
        var importedShelf = {
          id: 'imported_' + Date.now(),
          name: data.n,
          color: data.c || '#00dfd8',
          gameIds: data.g
        };
        this.shelves.push(importedShelf);
        this.saveShelves();
        return importedShelf;
      }
    } catch (e) {}
    return null;
  };

  /**
   * Exports full JSON backup
   */
  GameShelfCollections.prototype.exportJSON = function () {
    return JSON.stringify(this.shelves, null, 2);
  };

  return GameShelfCollections;
});
