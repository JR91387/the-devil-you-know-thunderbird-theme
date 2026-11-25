// Checks for The Devil You Know: manifest, stylesheet, packages and contrast.
// Run with `npm test` (builds first). No dependencies beyond Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

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

// Minimal zip reader: list entries and read one file.
function unzip(path) {
  const buf = readFileSync(path);
  let eocd = buf.length - 22;
  while (buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let i = 0; i < buf.readUInt16LE(eocd + 10); i++) {
    const method = buf.readUInt16LE(p + 10);
    const n = buf.readUInt16LE(p + 28), x = buf.readUInt16LE(p + 30), c = buf.readUInt16LE(p + 32);
    const name = buf.toString('utf8', p + 46, p + 46 + n);
    const off = buf.readUInt32LE(p + 42);
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const data = buf.subarray(start, start + buf.readUInt32LE(p + 20));
    entries[name] = () => (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    p += 46 + n + x + c;
  }
  return entries;
}

test('both packages exist with the expected files', () => {
  const dist = new URL('../dist/', import.meta.url);
  const v = manifest.version;
  const names = readdirSync(dist);
  for (const f of [`the-devil-you-know-${v}.xpi`, `the-devil-you-know-${v}-atn.xpi`]) {
    assert.ok(names.includes(f), f);
    const z = unzip(new URL(f, dist));
    assert.deepEqual(Object.keys(z).sort(), ['AUTHOR.md', 'LICENSE', 'icon.svg', 'manifest.json', 'theme.css']);
  }
});

test('ATN package has no update_url and has a max version; self-hosted keeps update_url', () => {
  const dist = new URL('../dist/', import.meta.url);
  const v = manifest.version;
  const atn = JSON.parse(unzip(new URL(`the-devil-you-know-${v}-atn.xpi`, dist))['manifest.json']()).browser_specific_settings.gecko;
  const own = JSON.parse(unzip(new URL(`the-devil-you-know-${v}.xpi`, dist))['manifest.json']()).browser_specific_settings.gecko;
  assert.equal(atn.update_url, undefined);
  assert.match(atn.strict_max_version, /^\d+\.\*$/);
  assert.match(own.update_url, /^https:\/\/raw\.githubusercontent\.com\/JR91387\/the-devil-you-know-thunderbird-theme\/main\/updates\.json$/);
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
      ['on-accent', 'accent-fill'], ['ink-2', 'pane-alt'], ['accent', 'selected'], ['ink', 'frame']];
    for (const [fg, bg] of pairs) {
      const r = contrast(v[`--dyk-${fg}`], v[`--dyk-${bg}`]);
      assert.ok(r >= 4.5, `${fg} on ${bg}: ${r.toFixed(2)}`);
    }
  });
}
