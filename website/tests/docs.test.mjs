import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderPages } from '../src/docs.mjs';

const sections = [{ id: 'retrospectives' }, { id: 'planning-poker' }];
const page = (id, order, related) => ({ id, data: { title: id, description: id, order, related } });

test('orders pages by section, then by order', () => {
    const ordered = orderPages(
        [page('planning-poker/decks', 1), page('retrospectives/voting', 2), page('retrospectives/writing', 1)],
        sections,
    );

    assert.deepEqual(
        ordered.map((entry) => entry.id),
        ['retrospectives/writing', 'retrospectives/voting', 'planning-poker/decks'],
    );
});

test('refuses a page whose folder is not a section', () => {
    assert.throws(() => orderPages([page('billing/plans', 1)], sections), /src\/content\/docs\/billing\/plans\.md is not in a section folder/);
});

test('refuses a page nested below a section', () => {
    assert.throws(() => orderPages([page('retrospectives/phases/voting', 1)], sections), /is not in a section folder/);
});

test('refuses two pages of a section with the same order', () => {
    assert.throws(
        () => orderPages([page('retrospectives/writing', 1), page('retrospectives/voting', 1)], sections),
        /retrospectives\/voting\.md and src\/content\/docs\/retrospectives\/writing\.md both have order 1/,
    );
});

test('accepts the same order in two sections', () => {
    assert.equal(orderPages([page('retrospectives/writing', 1), page('planning-poker/decks', 1)], sections).length, 2);
});

test('refuses a related id that names no page', () => {
    assert.throws(
        () => orderPages([page('retrospectives/writing', 1, ['retrospectives/votin'])], sections),
        /retrospectives\/writing\.md: related "retrospectives\/votin" names no page/,
    );
});

test('accepts a related id that names a page', () => {
    assert.equal(orderPages([page('retrospectives/writing', 1, ['planning-poker/decks']), page('planning-poker/decks', 1)], sections).length, 2);
});
