import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const imageFiles = [
    'compose.production.yaml',
    'compose.production.mariadb.yaml',
    'compose.production.sqlite.yaml',
    'docs/coolify/skrum.yaml',
    'docs/coolify/README.md',
    'README.md',
    '.env.production.example',
    'website/src/snippets/install.sh',
    'website/src/content/docs/self-hosting/install.md',
    'website/src/content/docs/self-hosting/configuration.md',
    'website/src/content/docs/self-hosting/upgrading.md',
];

export function syncReleaseVersion(root, tag, { check = false } = {}) {
    const version = tag.replace(/^v/, '');
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
        throw new Error('Expected a stable release tag, for example v1.2.3.');
    }

    const updates = new Map();
    for (const file of imageFiles) {
        const content = readFileSync(resolve(root, file), 'utf8');
        const pattern = /ghcr\.io\/arnaud-ritti\/skrum:(?:latest|\d+\.\d+\.\d+)(?![\w.-])/g;
        if (!pattern.test(content)) {
            throw new Error(`Missing image version in ${file}.`);
        }
        updates.set(file, content.replace(/ghcr\.io\/arnaud-ritti\/skrum:\d+\.\d+\.\d+(?![\w.-])/g, `ghcr.io/arnaud-ritti/skrum:${version}`));
    }

    const configFile = 'config/skrum.php';
    const config = readFileSync(resolve(root, configFile), 'utf8');
    const pattern = /('version' => env\('SKRUM_VERSION', ')(\d+\.\d+\.\d+)('\))/;
    const match = config.match(pattern);
    if (!match) {
        throw new Error('Missing application version fallback.');
    }
    const current = match[2].split('.').map(BigInt);
    const next = version.split('.').map(BigInt);
    for (let index = 0; index < 3; index += 1) {
        if (next[index] < current[index]) {
            throw new Error('Cannot move release defaults to an older version.');
        }
        if (next[index] > current[index]) {
            break;
        }
    }
    updates.set(configFile, config.replace(pattern, (_match, prefix, _currentVersion, suffix) => `${prefix}${version}${suffix}`));

    const composerFile = 'composer.json';
    const composer = JSON.parse(readFileSync(resolve(root, composerFile), 'utf8'));
    const versionedComposer = {};
    for (const [key, value] of Object.entries(composer)) {
        if (key === 'version') {
            continue;
        }
        versionedComposer[key] = value;
        if (key === 'name') {
            versionedComposer.version = version;
        }
    }
    updates.set(composerFile, `${JSON.stringify(versionedComposer, null, 4)}\n`);

    const changed = [];
    for (const [file, content] of updates) {
        if (readFileSync(resolve(root, file), 'utf8') !== content) {
            if (!check) {
                writeFileSync(resolve(root, file), content);
            }
            changed.push(file);
        }
    }
    if (check && changed.length > 0) {
        throw new Error(`Release references do not match ${version}: ${changed.join(', ')}. Merge the preparation pull request before publishing the release.`);
    }
    return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const tag = process.argv[2] ?? '';
    try {
        const changed = syncReleaseVersion(root, tag, { check: process.argv.includes('--check') });
        process.stdout.write(`${JSON.stringify({ version: tag.replace(/^v/, ''), changed })}\n`);
    } catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    }
}
