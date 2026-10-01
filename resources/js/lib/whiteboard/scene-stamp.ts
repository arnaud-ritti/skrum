import type { SceneElement } from './types';

/**
 * What the canvas holds, in a form a browser test can compare with the
 * server: the number of live elements, then the sums of their versions and
 * of their version nonces. The stamp is not injective: a stamp that differs
 * proves the scenes differ; equal stamps are taken as equal for test
 * purposes.
 */
export function sceneStamp(elements: readonly SceneElement[]): string {
    let count = 0;
    let versions = 0;
    let nonces = 0;

    for (const element of elements) {
        if (element.isDeleted) {
            continue;
        }

        count += 1;
        versions += element.version;
        nonces += element.versionNonce;
    }

    return `${count}:${versions}:${nonces}`;
}
