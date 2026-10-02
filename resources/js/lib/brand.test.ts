import { describe, expect, it } from 'vitest';
import { isRebranded, showsPoweredBy } from '@/lib/brand';
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

describe('isRebranded', () => {
    it('is false for the product, with or without its diaeresis', () => {
        expect(isRebranded(skrum)).toBe(false);
        expect(isRebranded({ ...skrum, name: 'Skrum' })).toBe(false);
        expect(isRebranded(undefined)).toBe(false);
    });

    it('is true with another name or a logo, credit line or not', () => {
        const silent: Brand = { ...skrum, name: 'Acme', poweredBy: false };

        expect(isRebranded({ ...skrum, name: 'Acme' })).toBe(true);
        expect(
            isRebranded({ ...skrum, logoLightUrl: '/brand/logo-light' }),
        ).toBe(true);
        expect(isRebranded(silent)).toBe(true);
    });
});
