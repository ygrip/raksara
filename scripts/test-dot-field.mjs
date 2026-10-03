import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from '../sveltekit/node_modules/typescript/lib/typescript.js';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText).toString('base64')}`;
const utils = moduleUrl(readFileSync(new URL('../sveltekit/src/lib/utils.ts', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../sveltekit/src/lib/dot-field.ts', import.meta.url), 'utf8').replace("'./utils'", JSON.stringify(utils));
const { dotFieldImages, morphFrame, globeTone, imageTonePixels } = await import(moduleUrl(source));

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
test('multiple images hold, scramble, reform and loop continuously', () => {
  assert.deepEqual(morphFrame(3, 3), { from: 0, to: 1, blend: 0, scatter: 0 });
  const middle = morphFrame(5.2, 3);
  assert.ok(Math.abs(middle.blend - 0.5) < 1e-10);
  assert.ok(Math.abs(middle.scatter - 1) < 1e-10);
  assert.equal(morphFrame(6.4, 3).from, 1);
  assert.equal(morphFrame(18, 3).to, 0);
  assert.equal(morphFrame(19.2 + 1e-8, 3).from, 0);
  assert.ok(morphFrame(6.4 - 1e-8, 3).scatter < 1e-7);
  assert.deepEqual(morphFrame(100, 1), { from: 0, to: 0, blend: 0, scatter: 0 });
  assert.deepEqual(morphFrame(100, 0), { from: 0, to: 0, blend: 0, scatter: 0 });
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
