const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ExitConfirmationManager } = require('../assets/js/exit-confirmation.js');

test('ExitConfirmationManager prompts until checkbox is saved in sessionStorage', () => {
    let mockSession = {};
    global.sessionStorage = {
        getItem(k) { return mockSession[k] || null; },
        setItem(k, v) { mockSession[k] = String(v); },
        removeItem(k) { delete mockSession[k]; }
    };

    const mgr = new ExitConfirmationManager();
    assert.equal(mgr.shouldPrompt(), true, 'Should prompt initially');

    mgr.setSkipConfirmation(true);
    assert.equal(mgr.shouldPrompt(), false, 'Should bypass prompt when skip is set');

    let confirmed = false;
    mgr.renderConfirmationDialog(() => { confirmed = true; });
    assert.equal(confirmed, true, 'Executes confirm immediately when prompt bypassed');

    mgr.resetPreference();
    assert.equal(mgr.shouldPrompt(), true, 'Should prompt again after reset');
});

test('exit-confirmation.css contains alertdialog modal styling', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/exit-confirmation.css');
    assert.ok(fs.existsSync(cssPath), 'exit-confirmation.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.exit-dialog-overlay/, 'Styles modal overlay');
    assert.match(css, /\.exit-dialog-card/, 'Styles card box');
    assert.match(css, /\.exit-btn-confirm/, 'Styles exit action button');
});
