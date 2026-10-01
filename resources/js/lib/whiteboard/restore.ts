import { restoreElements } from './excalidraw';
import type { SceneElement } from './types';

const indexOf = (element: SceneElement): string | null =>
    typeof element.index === 'string' && element.index !== ''
        ? element.index
        : null;

/**
 * The order Excalidraw stacks elements in: by fractional index compared by
 * code unit, then by id. Elements without an index stay at the end, in the
 * order given. Handed any other order, Excalidraw repairs it by giving
 * elements a new index and a new version, and the sync would write that back
 * and move them for everyone.
 */
export function inIndexOrder<T extends SceneElement>(
    elements: readonly T[],
): T[] {
    return [...elements].sort((first, second) => {
        const firstIndex = indexOf(first);
        const secondIndex = indexOf(second);

        if (firstIndex === null || secondIndex === null) {
            return Number(firstIndex === null) - Number(secondIndex === null);
        }

        if (firstIndex !== secondIndex) {
            return firstIndex < secondIndex ? -1 : 1;
        }

        if (first.id === second.id) {
            return 0;
        }

        return first.id < second.id ? -1 : 1;
    });
}

/** The rules of `fractional-indexing`, which throws on a key that breaks them. */
function hasUsableIndex(element: SceneElement): boolean {
    const index = element.index;

    if (index === null || index === undefined) {
        return true;
    }

    if (typeof index !== 'string' || !/^[A-Za-z][0-9A-Za-z]*$/.test(index)) {
        return false;
    }

    const head = index.charCodeAt(0);
    const integerLength = head >= 97 ? head - 97 + 2 : 90 - head + 2;

    if (index.length < integerLength || index === `A${'0'.repeat(26)}`) {
        return false;
    }

    return index.length === integerLength || !index.endsWith('0');
}

function report(element: SceneElement, error: unknown) {
    console.error(
        `whiteboard: element ${element.id} cannot be shown and was left out`,
        error,
    );
}

function restoreAll(elements: SceneElement[]): SceneElement[] {
    return restoreElements(
        elements as never,
        null,
    ) as unknown as SceneElement[];
}

/** One element Excalidraw cannot read must not take the board down. */
function restoreOneByOne(elements: SceneElement[]): SceneElement[] {
    return elements.flatMap((element) => {
        try {
            return restoreAll([element]);
        } catch (error) {
            report(element, error);

            return [];
        }
    });
}

/**
 * Restoring marks an empty text as deleted under a new version. That is not
 * an edit: written back, it would delete a text someone is about to type.
 * An element whose index had to be repaired keeps its new version, so that
 * the repair reaches the server and every client agrees on it.
 */
function withServerVersions(
    restored: SceneElement[],
    sources: SceneElement[],
): SceneElement[] {
    const byId = new Map(sources.map((element) => [element.id, element]));
    const repaired: string[] = [];

    const elements = restored.map((element) => {
        const source = byId.get(element.id);

        if (
            !source ||
            (element.version === source.version &&
                element.versionNonce === source.versionNonce)
        ) {
            return element;
        }

        if (element.index !== (source.index ?? null)) {
            repaired.push(element.id);

            return element;
        }

        return {
            ...element,
            version: source.version,
            versionNonce: source.versionNonce,
        };
    });

    if (repaired.length > 0) {
        console.warn(
            'whiteboard: repaired the stacking index of',
            repaired.join(', '),
        );
    }

    return elements;
}

/**
 * Turns server elements into scene elements without changing their index,
 * version or nonce, so that loading a board is never mistaken for editing it.
 */
export function restoreScene(
    elements: readonly SceneElement[],
): SceneElement[] {
    const ordered = inIndexOrder(
        elements.filter((element) => {
            const usable = hasUsableIndex(element);

            if (!usable) {
                report(element, new Error('invalid index'));
            }

            return usable;
        }),
    );

    try {
        return withServerVersions(restoreAll(ordered), ordered);
    } catch {
        return withServerVersions(restoreOneByOne(ordered), ordered);
    }
}
