import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from '../sveltekit/node_modules/typescript/lib/typescript.js';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText).toString('base64')}`;
const utils = moduleUrl(readFileSync(new URL('../sveltekit/src/lib/utils.ts', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../sveltekit/src/lib/dot-field.ts', import.meta.url), 'utf8').replace("'./utils'", JSON.stringify(utils));
const { dotFieldImages, morphFrame, morphPairs, hilbertIndex, globeTone, imageTonePixels } = await import(moduleUrl(source));

test('missing or malformed configuration uses the globe', () => {
  for (const value of [undefined, null, {}, '', 'avatar.png', [42, null, {}, 'video.mp4', 'file.pdf']]) {
    assert.deepEqual(dotFieldImages(value), []);
  }
});
test('supported local and remote images keep order and ignore unsupported/unsafe entries', () => {
  assert.deepEqual(dotFieldImages([
    ' assets/images/logo.svg ', 'https://example.com/photo.JPG?size=400#image',
    '/content/assets/face.webp', 'assets/images/logo.svg', 'video.webm',
    'javascript:evil.png', 'data:image/png;base64,test', 'ftp://example.com/image.png',
    'https://example.com/photo.avif', './assets/images/portrait.png'
  ]), ['/content/assets/images/logo.svg', 'https://example.com/photo.JPG?size=400#image',
    '/content/assets/face.webp', 'https://example.com/photo.avif', '/content/assets/images/portrait.png']);
});
test('multiple images hold, travel and loop continuously', () => {
  assert.deepEqual(morphFrame(3, 3), { from: 0, to: 1, progress: 0 });
  assert.ok(Math.abs(morphFrame(5.2, 3).progress - 0.5) < 1e-10);
  assert.ok(morphFrame(6.4 - 1e-8, 3).progress > 1 - 1e-7);
  assert.deepEqual(morphFrame(6.4, 3), { from: 1, to: 2, progress: 0 });
  assert.equal(morphFrame(18, 3).to, 0);
  assert.equal(morphFrame(19.2 + 1e-8, 3).from, 0);
  assert.deepEqual(morphFrame(100, 1), { from: 0, to: 0, progress: 0 });
  assert.deepEqual(morphFrame(100, 0), { from: 0, to: 0, progress: 0 });
});
test('hilbert order visits every cell once, always stepping to a neighbour', () => {
  const cells = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) cells[hilbertIndex(8, x, y)] = [x, y];
  assert.equal(cells.filter(Boolean).length, 64);
  for (let d = 1; d < 64; d++) {
    assert.equal(Math.abs(cells[d][0] - cells[d - 1][0]) + Math.abs(cells[d][1] - cells[d - 1][1]), 1);
  }
});
test('morph particles cover every lit cell of both images and nothing else', () => {
  const from = new Float32Array(36);
  const to = new Float32Array(36);
  for (const i of [0, 1, 7, 8]) from[i] = 0.5;
  for (const i of [20, 21, 22, 26, 27, 28, 33]) to[i] = 0.9;
  const { src, dst } = morphPairs(from, to, 6);
  assert.equal(src.length, 7);
  assert.deepEqual([...new Set(src)].sort((a, b) => a - b), [0, 1, 7, 8]);
  assert.deepEqual([...new Set(dst)].sort((a, b) => a - b), [20, 21, 22, 26, 27, 28, 33]);
});
test('morph particles fade in/out in place when one image has no lit cells', () => {
  const lit = new Float32Array(9);
  lit[4] = 1;
  const empty = new Float32Array(9);
  assert.deepEqual(morphPairs(empty, lit, 3), { src: Int32Array.of(4), dst: Int32Array.of(4) });
  assert.deepEqual(morphPairs(lit, empty, 3), { src: Int32Array.of(4), dst: Int32Array.of(4) });
  assert.equal(morphPairs(empty, empty, 3).src.length, 0);
});
test('transparent black SVG artwork stays readable, with transparent padding absent', () => {
  const pixels = new Uint8ClampedArray([0,0,0,255, 0,0,0,0, 255,255,255,255, 0,0,0,128]);
  const tones = imageTonePixels(pixels, pixels, 2);
  assert.ok(tones[0] >= 0.64);
  assert.equal(tones[1], 0);
  assert.ok(tones[2] > tones[0]);
  assert.ok(tones[3] > 0.3 && tones[3] < tones[0]);
});
test('opaque white background is not mistaken for transparent due to grid crop edges', () => {
  const probe = new Uint8ClampedArray([
    255,255,255,255, 255,255,255,255, 255,255,255,255,
    255,255,255,255, 0,0,0,255, 255,255,255,255,
    255,255,255,255, 255,255,255,255, 255,255,255,255
  ]);
  const cropped = new Uint8ClampedArray([0,0,0,0, 255,255,255,255, 0,0,0,255]);
  const tones = imageTonePixels(cropped, probe, 3);
  assert.equal(tones[0], 0);
  assert.ok(tones[1] < 1e-6);
  assert.equal(tones[2], 1);
});
test('globe has a bounded, shaded circular silhouette', () => {
  assert.equal(globeTone(1, 0), 0);
  assert.equal(globeTone(2, 2), 0);
  assert.ok(globeTone(0, 0) > 0.5);
  for (let x = -1; x <= 1; x += 0.1) for (let y = -1; y <= 1; y += 0.1) {
    assert.ok(globeTone(x, y) >= 0 && globeTone(x, y) <= 1);
  }
});
