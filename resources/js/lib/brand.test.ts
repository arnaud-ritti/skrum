import { describe, expect, it } from 'vitest';
import { showsPoweredBy } from '@/lib/brand';
import type { Brand } from '@/types';

const skrum: Brand = {
    name: 'Skrüm',
    logoLightUrl: null,
    logoDarkUrl: null,
    faviconUrl: null,
    poweredBy: true,
};

describe('showsPoweredBy', () => {
    it('stays silent for the product under its own name and logo', () => {
        expect(showsPoweredBy(skrum)).toBe(false);
        expect(showsPoweredBy(undefined)).toBe(false);
    });

    it('credits the product once the instance has its own name or logo', () => {
        expect(showsPoweredBy({ ...skrum, name: 'Acme' })).toBe(true);
        expect(
            showsPoweredBy({ ...skrum, logoLightUrl: '/brand/logo-light' }),
        ).toBe(true);
    });

    it('stays silent when the admin switched the credit off', () => {
        expect(
            showsPoweredBy({
                ...skrum,
                name: 'Acme',
                logoLightUrl: '/brand/logo-light',
                poweredBy: false,
            }),
        ).toBe(false);
    });
});
