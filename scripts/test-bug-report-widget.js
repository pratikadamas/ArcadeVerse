const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BugReportWidget } = require('../assets/js/bug-report-widget.js');

test('BugReportWidget collects telemetry and formats sanitized GitHub issue link', () => {
    const widget = new BugReportWidget({ repo: 'DebasmitaBose0/ArcadeVerse' });
    const telemetry = widget.collectTelemetry();

    assert.ok(telemetry.ua, 'Contains user agent info');
    assert.ok(telemetry.screenRes, 'Contains screen dimensions');
    assert.ok(telemetry.activeTheme, 'Contains active theme');

    const url = widget.generateGitHubUrl('Collision detector glitch on level 3');
    assert.ok(url.startsWith('https://github.com/DebasmitaBose0/ArcadeVerse/issues/new'), 'Generates new issue URL');
    assert.ok(url.includes('title='), 'Contains query title parameter');
    assert.ok(url.includes('body='), 'Contains query body parameter');
    assert.ok(decodeURIComponent(url).includes('Collision detector glitch'), 'Includes player bug notes');
});

test('bug-report-widget.css contains floating positioning and minimize rules', () => {
    const cssPath = path.resolve(__dirname, '../assets/css/bug-report-widget.css');
    assert.ok(fs.existsSync(cssPath), 'bug-report-widget.css must exist');

    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.bug-report-widget/, 'Styles floating widget container');
    assert.match(css, /position:\s*fixed/, 'Uses fixed viewport dock');
    assert.match(css, /\.bug-report-widget\.minimized/, 'Defines minimized circular icon state');
    assert.match(css, /\.bug-submit-btn/, 'Styles submit button');
});
