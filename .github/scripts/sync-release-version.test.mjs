import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { imageFiles, syncReleaseVersion } from './sync-release-version.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const files = [...imageFiles, 'config/skrum.php', 'composer.json'];

function fixture(t) {
    const root = mkdtempSync(resolve(tmpdir(), 'skrum-release-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    for (const file of files) {
        mkdirSync(dirname(resolve(root, file)), { recursive: true });
        copyFileSync(resolve(repository, file), resolve(root, file));
    }
    return root;
}

function contents(root) {
    return files.map((file) => readFileSync(resolve(root, file), 'utf8'));
}

void test('updates all deployment references, Composer and application version, and is idempotent', (t) => {
    const root = fixture(t);
    const before = JSON.parse(readFileSync(resolve(root, 'composer.json')));
    assert.equal(syncReleaseVersion(root, 'v9.8.7').length, files.length);
    for (const file of imageFiles) {
        const content = readFileSync(resolve(root, file), 'utf8');
        assert.ok(content.includes('ghcr.io/arnaud-ritti/skrum:9.8.7'), file);
        assert.doesNotMatch(content, /ghcr\.io\/arnaud-ritti\/skrum:(?:latest|0\.0\.1)/);
    }
    const after = JSON.parse(readFileSync(resolve(root, 'composer.json')));
    assert.equal(after.version, '9.8.7');
    assert.deepEqual(after.require, before.require);
    assert.deepEqual(after['require-dev'], before['require-dev']);
    assert.match(readFileSync(resolve(root, 'config/skrum.php'), 'utf8'), /'SKRUM_VERSION', '9\.8\.7'/);
    assert.deepEqual(syncReleaseVersion(root, 'v9.8.7'), []);
});

for (const tag of ['', 'v1.2', 'v1.2.3-rc.1', 'v01.2.3', 'v1.2.3\n', '$(echo secret)']) {
    void test(`rejects an invalid or prerelease tag ${JSON.stringify(tag)} before changing files`, (t) => {
        const root = fixture(t);
        const before = contents(root);
        assert.throws(() => syncReleaseVersion(root, tag));
        assert.deepEqual(contents(root), before);
    });
}

void test('rejects older releases without changing any file', (t) => {
    const root = fixture(t);
    syncReleaseVersion(root, 'v9.8.7');
    const before = contents(root);
    assert.throws(() => syncReleaseVersion(root, 'v9.8.6'), /older version/);
    assert.deepEqual(contents(root), before);
});

void test('detects a missing deployment reference before changing any file', (t) => {
    const root = fixture(t);
    writeFileSync(resolve(root, imageFiles.at(-1)), 'No image reference here.\n');
    const before = contents(root);
    assert.throws(() => syncReleaseVersion(root, 'v9.8.7'), /Missing image version/);
    assert.deepEqual(contents(root), before);
});
