import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBreached, sha1Hex, splitHash } from './breach-check';

const PasswordHash = '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('sha1Hex', () => {
    it('hashes the text into upper-case hex', async () => {
        expect(await sha1Hex('password')).toBe(PasswordHash);
    });

    it('gives nothing where the browser has no crypto.subtle', async () => {
        vi.stubGlobal('crypto', { getRandomValues: () => undefined });

        expect(await sha1Hex('password')).toBeNull();
    });
});

describe('splitHash', () => {
    it('keeps five characters for the range and the rest for the comparison', () => {
        expect(splitHash(PasswordHash)).toEqual({
            prefix: '5BAA6',
            suffix: '1E4C9B93F3F0682250B6CF8331B7EE68FD8',
        });
    });
});

describe('isBreached', () => {
    it('finds the suffix in the range whatever its case', () => {
        expect(
            isBreached(
                [
                    '0018A45C4D1DEF81644B54AB7F969B88D65',
                    '1e4c9b93f3f0682250b6cf8331b7ee68fd8',
                ],
                '1E4C9B93F3F0682250B6CF8331B7EE68FD8',
            ),
        ).toBe(true);
    });

    it('does not find a suffix the range lacks', () => {
        expect(
            isBreached(
                ['0018A45C4D1DEF81644B54AB7F969B88D65'],
                '1E4C9B93F3F0682250B6CF8331B7EE68FD8',
            ),
        ).toBe(false);
    });
});
