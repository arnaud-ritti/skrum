import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inIndexOrder, restoreScene } from './restore';
import type { SceneElement } from './types';

vi.mock('./excalidraw', () => ({
    restoreElements: (elements: SceneElement[]) =>
        elements.map((element) => {
            if (element.id === 'unreadable') {
                throw new Error('cannot restore');
            }

            if (element.text === '') {
                return {
                    ...element,
                    isDeleted: true,
                    version: element.version + 1,
                    versionNonce: 999,
                };
            }

            if (element.id === 'misplaced') {
                return {
                    ...element,
                    index: 'a5',
                    version: element.version + 1,
                    versionNonce: 998,
                };
            }

            return element;
        }),
}));

function element(
    id: string,
    overrides: Partial<SceneElement> = {},
): SceneElement {
    return {
        id,
        type: 'rectangle',
        version: 7,
        versionNonce: 70,
        isDeleted: false,
        index: 'a0',
        ...overrides,
    };
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('inIndexOrder', () => {
    it('orders by index, then by id, and keeps the elements without one at the end', () => {
        const ordered = inIndexOrder([
            element('none', { index: null }),
            element('b', { index: 'a1' }),
            element('c', { index: 'a0' }),
            element('a', { index: 'a1' }),
        ]);

        expect(ordered.map((known) => known.id)).toEqual([
            'c',
            'a',
            'b',
            'none',
        ]);
    });
});

describe('restoreScene', () => {
    it('leaves out an element whose index the library would throw on', () => {
        const restored = restoreScene([
            element('good', { index: 'a0' }),
            element('bad', { index: 'a10' }),
        ]);

        expect(restored.map((known) => known.id)).toEqual(['good']);
    });

    it('keeps the server version of an empty text the library marks deleted', () => {
        const [text] = restoreScene([element('t', { type: 'text', text: '' })]);

        expect(text).toMatchObject({
            isDeleted: true,
            version: 7,
            versionNonce: 70,
        });
    });

    it('keeps the new version of an element whose index was repaired', () => {
        const [repaired] = restoreScene([element('misplaced')]);

        expect(repaired).toMatchObject({
            index: 'a5',
            version: 8,
            versionNonce: 998,
        });
    });

    it('restores the others one by one when one element cannot be read', () => {
        const restored = restoreScene([
            element('first', { index: 'a0' }),
            element('unreadable', { index: 'a1' }),
            element('last', { index: 'a2' }),
        ]);

        expect(restored.map((known) => known.id)).toEqual(['first', 'last']);
    });
});
