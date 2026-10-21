import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { isPublished, prunePrivateMarkdown } = require('./publication-policy.cjs');

for (const fm of [{}, { status: 'ongoing' }, { status: 'completed' }, { published: true }, { visibility: 'public' }]) {
  assert.equal(isPublished(fm), true, JSON.stringify(fm));
}
for (const fm of [
  { status: 'draft' }, { status: 'DRAFT' }, { draft: true }, { published: false },
  { visibility: 'private' }, { visibility: 'draft' },
  { status: 'draft', published: true }, { visibility: 'private', published: true },
]) {
  assert.equal(isPublished(fm), false, JSON.stringify(fm));
}
assert.equal(isPublished(null), false);
assert.equal(isPublished({ status: 'internal' }, { publication: { hidden_statuses: ['internal', 'draft'] } }), false);
assert.equal(isPublished({ status: 'draft' }, { publication: { hidden_statuses: [] } }), true, 'Explicit site policy can override a workflow status');
assert.equal(isPublished({ published: false }, { publication: { hidden_statuses: [] } }), false, 'Explicit visibility remains private');

const root = mkdtempSync(join(tmpdir(), 'raksara-publication-'));
try {
  const source = [
    ['blog/public.md', 'public content'],
    ['blog/novel/draft.md', 'never ship this draft'],
    ['portfolio/internal.md', 'private project'],
    ['pages/confidential.md', 'private page'],
    ['content/blog/novel/draft.md', 'legacy draft duplicate'],
    ['assets/guide.md', 'downloadable asset'],
  ];
  for (const [path, text] of source) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const pruned = prunePrivateMarkdown(root, new Set(['blog/public.md']));
  assert.equal(pruned, 4);
  assert.equal(readFileSync(join(root, 'blog/public.md'), 'utf8'), 'public content');
  assert.equal(readFileSync(join(root, 'assets/guide.md'), 'utf8'), 'downloadable asset');
  for (const name of ['blog/novel/draft.md', 'portfolio/internal.md', 'pages/confidential.md', 'content/blog/novel/draft.md']) {
    assert.equal(existsSync(join(root, name)), false, name);
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
console.log('Publication visibility and physical static-file isolation checks passed.');
