/**
 * GameComparatorDrawer - Multi-Criteria Game Comparison Drawer with Side-by-Side Spec Matrix
 * 
 * Allows selecting up to 3 games simultaneously, sliding up a docked comparison tray,
 * rendering side-by-side spec comparison matrices (category, controls, dimensions, features),
 * and supporting direct-launch actions.
 */

class GameComparatorDrawer {
  constructor(options = {}) {
    this.maxGames = options.maxGames || 3;
    this.selectedGames = [];
    this.isOpen = false;
  }

  addGame(game) {
    if (!game || !game.id) return false;
    if (this.selectedGames.some(g => g.id === game.id)) return false;

    if (this.selectedGames.length >= this.maxGames) {
      this.selectedGames.shift(); // Remove oldest to maintain max selection
    }

    this.selectedGames.push({
      id: game.id,
      title: game.title || game.name || game.id,
      category: game.category || 'Arcade',
      controls: game.controls || ['Keyboard'],
      difficulty: game.difficulty || 'Medium',
      highScore: game.highScore || 0,
      tags: game.tags || []
    });

    this.isOpen = true;
    return true;
  }

  removeGame(gameId) {
    const prevLen = this.selectedGames.length;
    this.selectedGames = this.selectedGames.filter(g => g.id !== gameId);
    if (this.selectedGames.length === 0) {
      this.isOpen = false;
    }
    return this.selectedGames.length < prevLen;
  }

  clear() {
    this.selectedGames = [];
    this.isOpen = false;
  }

  getComparisonMatrix() {
    const fields = ['Category', 'Controls', 'Difficulty', 'High Score', 'Tags'];
    const matrix = {
      fields,
      games: this.selectedGames.map(g => ({
        id: g.id,
        title: g.title,
        specs: {
          'Category': g.category,
          'Controls': Array.isArray(g.controls) ? g.controls.join(', ') : String(g.controls),
          'Difficulty': g.difficulty,
          'High Score': g.highScore,
          'Tags': Array.isArray(g.tags) ? g.tags.join(', ') : ''
        }
      }))
    };
    return matrix;
  }

  generateHtmlMatrix() {
    const matrix = this.getComparisonMatrix();
    if (matrix.games.length === 0) {
      return '<div class="comparator-empty">No games selected for comparison.</div>';
    }

    let html = '<div class="comparator-matrix-table"><table style="width:100%; border-collapse:collapse;">';
    html += '<thead><tr><th>Specification</th>';
    for (const g of matrix.games) {
      html += `<th>${g.title}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const field of matrix.fields) {
      html += `<tr><td><strong>${field}</strong></td>`;
      for (const g of matrix.games) {
        html += `<td>${g.specs[field]}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GameComparatorDrawer };
}
