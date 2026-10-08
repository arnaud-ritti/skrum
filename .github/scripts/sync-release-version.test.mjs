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

void test('preserves latest image references while updating Composer and application version, and is idempotent', (t) => {
    const root = fixture(t);
    const before = JSON.parse(readFileSync(resolve(root, 'composer.json')));
    assert.deepEqual(syncReleaseVersion(root, 'v9.8.7'), ['config/skrum.php', 'composer.json']);
    for (const file of imageFiles) {
        const content = readFileSync(resolve(root, file), 'utf8');
        assert.equal(content, readFileSync(resolve(repository, file), 'utf8'), file);
        assert.ok(content.includes('ghcr.io/arnaud-ritti/skrum:latest'), file);
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

void test('updates an explicit release reference without replacing latest in the same file', (t) => {
    const root = fixture(t);
    const file = resolve(root, imageFiles[0]);
    writeFileSync(file, `${readFileSync(file, 'utf8')}\n# Release example: ghcr.io/arnaud-ritti/skrum:0.0.1\n`);
    syncReleaseVersion(root, 'v9.8.7');
    const content = readFileSync(file, 'utf8');
    assert.ok(content.includes('ghcr.io/arnaud-ritti/skrum:latest'));
    assert.ok(content.includes('ghcr.io/arnaud-ritti/skrum:9.8.7'));
    assert.ok(!content.includes('ghcr.io/arnaud-ritti/skrum:0.0.1'));
});

void test('release validation rejects stale metadata without modifying files', (t) => {
    const root = fixture(t);
    const before = contents(root);
    assert.throws(() => syncReleaseVersion(root, 'v9.8.7', { check: true }), /Merge the preparation pull request/);
    assert.deepEqual(contents(root), before);
});

void test('release validation accepts prepared references and detects Composer drift', (t) => {
    const root = fixture(t);
    syncReleaseVersion(root, 'v9.8.7');
    assert.deepEqual(syncReleaseVersion(root, 'v9.8.7', { check: true }), []);
    const file = resolve(root, 'composer.json');
    const composer = JSON.parse(readFileSync(file, 'utf8'));
    composer.version = '9.8.6';
    writeFileSync(file, `${JSON.stringify(composer, null, 4)}\n`);
    const before = contents(root);
    assert.throws(() => syncReleaseVersion(root, 'v9.8.7', { check: true }), /composer.json/);
    assert.deepEqual(contents(root), before);
});
