import type { SceneElement } from './types';

/**
 * What the canvas holds, in a form a browser test can compare with the
 * server: the number of live elements, then the sums of their versions and
 * of their version nonces. Two copies of an element with the same version
 * and nonce are the same copy, so two scenes with the same stamp hold the
 * same elements.
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
