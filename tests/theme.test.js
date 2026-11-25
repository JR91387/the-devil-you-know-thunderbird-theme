// Checks for The Devil You Know: manifest, stylesheet, packages and contrast.
// Run with `npm test` (builds first). Needs Node and Python 3, nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('theme/manifest.json'));
const css = read('theme/theme.css');
const HEX = /^#[0-9A-F]{6}$/i;

test('manifest has the required theme keys', () => {
  assert.equal(manifest.manifest_version, 2);
  assert.equal(manifest.name, 'The Devil You Know');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  const gecko = manifest.browser_specific_settings.gecko;
  assert.equal(gecko.id, 'the-devil-you-know@jerryreinitz.com');
  assert.equal(gecko.strict_min_version, '140.0');
  assert.equal(manifest.theme_experiment.stylesheet, 'theme.css');
  assert.ok(manifest.theme.colors && manifest.dark_theme.colors);
});

test('light and dark set the same color keys, all valid hex', () => {
  const light = manifest.theme.colors;
  const dark = manifest.dark_theme.colors;
  assert.deepEqual(Object.keys(light).sort(), Object.keys(dark).sort());
  for (const [k, v] of [...Object.entries(light), ...Object.entries(dark)]) assert.match(v, HEX, k);
});

test('theme.css opens with the author header', () => {
  const head = css.slice(0, 600);
  assert.ok(head.startsWith('/*'));
  assert.match(head, /Copyright \(c\) 2026 Jerry Reinitz \(https:\/\/jerryreinitz\.com\)\. MIT License\./);
  for (const link of ['https://jerryreinitz.com', 'https://reinitzindustries.com', 'https://github.com/JR91387', 'https://www.linkedin.com/in/jerryreinitz/']) {
    assert.ok(head.includes(link), link);
  }
});

test('every --dyk- value used in theme.css is defined', () => {
  const defined = new Set([...css.matchAll(/(--dyk-[\w-]+)\s*:/g)].map((m) => m[1]));
  for (const m of css.matchAll(/var\((--dyk-[\w-]+)\)/g)) assert.ok(defined.has(m[1]), m[1]);
});

test('no remote URLs or brand names in the theme', () => {
  const body = css.split('*/').slice(1).join('*/');
  assert.doesNotMatch(body, /url\((?!data:)/);
  for (const text of [body, JSON.stringify(manifest)]) assert.doesNotMatch(text, /outlook|microsoft|office 365/i);
});

// Read a package with Python's zipfile (the build already needs Python).
const zipNames = (url) => execFileSync('python3', ['-I', '-c', 'import sys,zipfile; print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', fileURLToPath(url)], { encoding: 'utf8' }).trim().split('\n');
const zipRead = (url, name) => execFileSync('python3', ['-I', '-c', 'import sys,zipfile; sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode())', fileURLToPath(url), name], { encoding: 'utf8' });

test('both packages exist with the expected files', () => {
  const dist = new URL('../dist/', import.meta.url);
  const v = manifest.version;
  const names = readdirSync(dist);
  for (const f of [`the-devil-you-know-${v}.xpi`, `the-devil-you-know-${v}-atn.xpi`]) {
    assert.ok(names.includes(f), f);
    assert.deepEqual(zipNames(new URL(f, dist)).sort(), ['AUTHOR.md', 'LICENSE', 'icon.svg', 'manifest.json', 'theme.css']);
  }
});

test('ATN package has no update_url and has a max version; self-hosted keeps update_url', () => {
  const dist = new URL('../dist/', import.meta.url);
  const v = manifest.version;
  const atn = JSON.parse(zipRead(new URL(`the-devil-you-know-${v}-atn.xpi`, dist), 'manifest.json')).browser_specific_settings.gecko;
  const own = JSON.parse(zipRead(new URL(`the-devil-you-know-${v}.xpi`, dist), 'manifest.json')).browser_specific_settings.gecko;
  assert.equal(atn.update_url, undefined);
  assert.match(atn.strict_max_version, /^\d+\.\*$/);
  assert.match(own.update_url, /^https:\/\/raw\.githubusercontent\.com\/JR91387\/the-devil-you-know-thunderbird-theme\/main\/updates\.json$/);
});

test('updates.json offers the manifest version at its release download', () => {
  const v = manifest.version;
  const feed = JSON.parse(read('updates.json')).addons[manifest.browser_specific_settings.gecko.id].updates;
  const entry = feed.find((u) => u.version === v);
  assert.ok(entry, `updates.json has no entry for ${v}`);
  assert.ok(entry.update_link.endsWith(`/releases/download/v${v}/the-devil-you-know-${v}.xpi`), entry.update_link);
  assert.equal(entry.applications.gecko.strict_min_version, manifest.browser_specific_settings.gecko.strict_min_version);
});

// WCAG contrast of the main text/background pairs, read from the values block.
function values(mode) {
  const out = {};
  for (const m of css.matchAll(/(--dyk-[\w-]+):\s*(?:light-dark\((#[0-9A-F]{6}),\s*(#[0-9A-F]{6})\)|(#[0-9A-F]{6}))/gi)) {
    out[m[1]] = m[4] || (mode === 'light' ? m[2] : m[3]);
  }
  return out;
}
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

for (const mode of ['light', 'dark']) {
  test(`text contrast is at least 4.5:1 (${mode})`, () => {
    const v = values(mode);
    const pairs = [['ink', 'pane'], ['ink-2', 'pane'], ['accent', 'pane'], ['ink', 'selected'], ['ink', 'selected-2'],
      ['on-accent', 'accent-fill'], ['ink-2', 'pane-alt'], ['accent', 'selected'], ['ink', 'frame'], ['ink-3', 'pane'], ['ink-3', 'pane-alt']];
    for (const [fg, bg] of pairs) {
      const r = contrast(v[`--dyk-${fg}`], v[`--dyk-${bg}`]);
      assert.ok(r >= 4.5, `${fg} on ${bg}: ${r.toFixed(2)}`);
    }
  });
}

// Manifest colors that have no --dyk value (icon and toolbar-button greys).
const MANIFEST_ONLY = new Set(['#424242', '#E6E6E6', '#D6D6D6']);

for (const [mode, colors] of [['light', manifest.theme.colors], ['dark', manifest.dark_theme.colors]]) {
  test(`manifest colors match theme.css (${mode})`, () => {
    const v = values(mode);
    const shared = { frame: 'frame', tab_line: 'accent', toolbar_field_border_focus: 'accent', icons_attention: 'accent', popup: 'pane', sidebar: 'pane-alt' };
    for (const [key, name] of Object.entries(shared)) assert.equal(colors[key].toUpperCase(), v[`--dyk-${name}`].toUpperCase(), `${key} vs --dyk-${name}`);
    const palette = new Set(Object.values(v).map((c) => c.toUpperCase()));
    for (const [key, c] of Object.entries(colors)) assert.ok(palette.has(c.toUpperCase()) || MANIFEST_ONLY.has(c.toUpperCase()), `${key} ${c} is not in theme.css or MANIFEST_ONLY`);
  });
}
