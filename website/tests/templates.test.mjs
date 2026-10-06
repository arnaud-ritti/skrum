import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { catalogue, headings } from '../src/templates.mjs';

const template = (slug, colors = ['moss', 'coral']) => ({
    key: slug.replaceAll('-', '_'),
    slug,
    category: 'essentials',
    name: slug,
    columns: colors.map((color, index) => ({ title: `Column ${index + 1}`, description: 'What to write here', color })),
});

const data = (...templates) => ({ categories: [{ id: 'essentials', name: 'Essentials' }], templates });
const body = (titles = headings) => titles.map((title) => `## ${title}\n\nA paragraph.\n`).join('\n');
const text = (id, related, content = body()) => ({
    id,
    data: { summary: `What ${id} is for.`, related: related.map((slug) => ({ template: slug, why: 'A reason.' })) },
    body: content,
});

const three = data(template('sailboat'), template('starfish'), template('kalm'));
const written = [text('sailboat', ['starfish', 'kalm']), text('starfish', ['sailboat', 'kalm']), text('kalm', ['sailboat', 'starfish'])];

test('keeps the order of the data and links each template to the one before and after', () => {
    const templates = catalogue(three, []);

    assert.deepEqual(
        templates.map((entry) => [entry.previous, entry.slug, entry.next]),
        [
            [null, 'sailboat', 'starfish'],
            ['sailboat', 'starfish', 'kalm'],
            ['starfish', 'kalm', null],
        ],
    );
});

test('lists for each template the ones that name it as related', () => {
    const templates = catalogue(three, [text('sailboat', ['starfish', 'kalm']), text('starfish', ['kalm', 'sailboat'])]);

    assert.deepEqual(
        templates.map((entry) => entry.relatedBy),
        [['starfish'], ['sailboat'], ['sailboat', 'starfish']],
    );
});

test('returns a template that has no text yet with a null explanation', () => {
    const [sailboat, starfish] = catalogue(three, [text('sailboat', ['starfish', 'kalm'])]);

    assert.equal(sailboat.explanation.data.summary, 'What sailboat is for.');
    assert.equal(starfish.explanation, null);
});

test('leaves the headings and the orphans alone while a text is missing', () => {
    assert.equal(catalogue(three, [text('sailboat', ['starfish', 'kalm'], 'No heading at all.'), text('starfish', ['sailboat', 'kalm'])]).length, 3);
});

test('accepts the committed data before any text is written', () => {
    const committed = JSON.parse(readFileSync(new URL('../src/data/retro-templates.json', import.meta.url), 'utf8'));

    assert.equal(catalogue(committed, []).length, committed.templates.length);
});

test('refuses a column colour the design system does not have', () => {
    assert.throws(
        () => catalogue(data(template('sailboat', ['moss', 'teal'])), []),
        /src\/data\/retro-templates\.json: the template "sailboat" has a column of colour "teal"/,
    );
});

test('refuses two templates with the same slug', () => {
    assert.throws(
        () => catalogue(data(template('sailboat'), template('sailboat')), []),
        /src\/data\/retro-templates\.json: two templates have the slug "sailboat"/,
    );
});

test('refuses a text that names no template', () => {
    assert.throws(() => catalogue(three, [text('sailbot', ['starfish', 'kalm'])]), /src\/content\/templates\/sailbot\.md names no template/);
});

test('refuses a related entry that names no template', () => {
    assert.throws(
        () => catalogue(three, [text('sailboat', ['starfish', 'calm'])]),
        /src\/content\/templates\/sailboat\.md: related "calm" names no template/,
    );
});

test('refuses a related entry that names its own page', () => {
    assert.throws(
        () => catalogue(three, [text('sailboat', ['starfish', 'sailboat'])]),
        /src\/content\/templates\/sailboat\.md names itself as related/,
    );
});

test('refuses fewer than two related templates', () => {
    assert.throws(
        () => catalogue(three, [text('sailboat', ['starfish'])]),
        /src\/content\/templates\/sailboat\.md has fewer than two related templates/,
    );
});

test('counts a template named twice as one related template', () => {
    assert.throws(
        () => catalogue(three, [text('sailboat', ['starfish', 'starfish'])]),
        /src\/content\/templates\/sailboat\.md has fewer than two related templates/,
    );
});

test('refuses a text without one of the five headings, once all are written', () => {
    const short = body(headings.filter((title) => title !== 'Goal'));

    assert.throws(
        () => catalogue(three, [text('sailboat', ['starfish', 'kalm'], short), ...written.slice(1)]),
        /src\/content\/templates\/sailboat\.md lacks the heading "Goal"/,
    );
});

test('refuses the five headings out of order, once all are written', () => {
    const shuffled = body(['What it is', 'When to use it', 'Goal', 'When to pick another format', 'How to run it']);

    assert.throws(
        () => catalogue(three, [text('sailboat', ['starfish', 'kalm'], shuffled), ...written.slice(1)]),
        /src\/content\/templates\/sailboat\.md has its headings out of order/,
    );
});

test('refuses a template no other names as related, once all are written', () => {
    const four = data(...three.templates, template('daki'));

    assert.throws(
        () => catalogue(four, [...written, text('daki', ['sailboat', 'kalm'])]),
        /src\/content\/templates\/daki\.md is named as related by no other template/,
    );
});

test('accepts a catalogue whose texts are all written and all named', () => {
    assert.deepEqual(
        catalogue(three, written).map((entry) => entry.explanation.id),
        ['sailboat', 'starfish', 'kalm'],
    );
});
