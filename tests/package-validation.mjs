import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const entrypoint = './dist/index.js';
const expectedAllowlist = ['dist', 'LICENSE', 'README.md'];
const readme = readFileSync(join(root, 'README.md'), 'utf8');

assert.equal(packageJson.main, entrypoint, 'main must resolve to dist/index.js');
assert.equal(packageJson.exports, entrypoint, 'exports must resolve to dist/index.js');
assert.equal(
  packageJson.bin?.['taskhub-mcp'],
  entrypoint,
  'taskhub-mcp bin must resolve to dist/index.js',
);
assert.deepEqual(packageJson.files, expectedAllowlist, 'package files must be an explicit allowlist');
assert.equal(packageJson.license, 'MIT', 'package license metadata must remain publishable');
assert.match(readme, /TASKHUB_API_TOKEN/, 'README must document the published credential contract');
assert.equal(
  packageJson.scripts?.['test:package'],
  'node tests/package-validation.mjs',
  'package validation must have a deterministic package script',
);

const entrypointPath = join(root, entrypoint.slice(2));
assert.ok(existsSync(entrypointPath), 'dist/index.js must exist before publication');
const syntaxCheck = spawnSync(process.execPath, ['--check', entrypointPath], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(syntaxCheck.status, 0, syntaxCheck.stderr || 'dist/index.js syntax check failed');

const pack = spawnSync('pnpm', ['pack', '--dry-run', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
assert.equal(pack.status, 0, pack.stderr || 'pnpm pack --dry-run --json failed');

let packMetadata;
try {
  packMetadata = JSON.parse(pack.stdout);
} catch (error) {
  throw new Error(`pnpm pack returned invalid JSON: ${error.message}`);
}

const publishedFiles = packMetadata.files.map((file) => file.path);
const isAllowed = (file) => file === 'package.json'
  || file === 'LICENSE'
  || file === 'README.md'
  || file.startsWith('dist/');
const forbiddenPath = /^(?:src|tests|openspec|\.atl|\.codegraph|\.env|\.npmignore|ARCHITECTURE\.md|GUIA\.md|SECURITY\.md)(?:\/|$)/;

assert.ok(publishedFiles.includes('package.json'), 'published package metadata is required');
assert.ok(publishedFiles.includes('LICENSE'), 'LICENSE must be published');
assert.ok(publishedFiles.includes('README.md'), 'README.md must be published');
assert.ok(publishedFiles.includes('dist/index.js'), 'dist/index.js must be published');
assert.ok(publishedFiles.every(isAllowed), 'published files must stay within the package allowlist');
assert.ok(
  publishedFiles.every((file) => !forbiddenPath.test(file)),
  'source, tests, OpenSpec, repository docs, environment files, and development artifacts must be excluded',
);

console.log(`Package validation passed: ${publishedFiles.length} published files.`);
