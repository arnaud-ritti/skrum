import { describe, expect, it } from 'vitest';
import {
    assetRejection,
    clampRadius,
    contrastLevel,
    countChanges,
    followsDefault,
    formatRatio,
    initialFormData,
    normalizeHex,
    paletteStyle,
    toPayload,
} from './branding';
import { samplePalette, sampleProps } from './samples';

describe('normalizeHex', () => {
    it('accepts 3 or 6 digits with or without the hash and trims', () => {
        expect(normalizeHex(' 2B63B0 ')).toBe('#2b63b0');
        expect(normalizeHex('#fff')).toBe('#ffffff');
        expect(normalizeHex('A1c')).toBe('#aa11cc');
    });

    it('refuses anything else', () => {
        expect(normalizeHex('')).toBeNull();
        expect(normalizeHex('#12')).toBeNull();
        expect(normalizeHex('#12345')).toBeNull();
        expect(normalizeHex('red')).toBeNull();
        expect(normalizeHex('#2b63b0;x')).toBeNull();
    });
});

describe('contrast', () => {
    it('grades a ratio as AAA from 7, AA from 4.5, below otherwise', () => {
        expect(contrastLevel(7.2)).toBe('AAA');
        expect(contrastLevel(7)).toBe('AAA');
        expect(contrastLevel(5.8)).toBe('AA');
        expect(contrastLevel(4.5)).toBe('AA');
        expect(contrastLevel(3.1)).toBe('below');
    });

    it('never rounds a ratio up', () => {
        expect(formatRatio(4.49)).toBe('4.4');
        expect(formatRatio(5.8)).toBe('5.8');
        expect(formatRatio(7)).toBe('7.0');
    });
});

describe('clampRadius', () => {
    it('keeps the radius an integer between 0 and 16', () => {
        expect(clampRadius(-3)).toBe(0);
        expect(clampRadius(40)).toBe(16);
        expect(clampRadius(7.6)).toBe(8);
        expect(clampRadius(Number.NaN)).toBe(0);
    });
});

describe('assetRejection', () => {
    it('refuses a file over 512 KB and a type outside the list', () => {
        const big = new File([new Uint8Array(600 * 1024)], 'logo.png', {
            type: 'image/png',
        });
        const gif = new File(['x'], 'logo.gif', { type: 'image/gif' });
        const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
        const untyped = new File(['x'], 'logo.webp');

        expect(assetRejection(big)).toBe('size');
        expect(assetRejection(gif)).toBe('type');
        expect(assetRejection(svg)).toBeNull();
        expect(assetRejection(untyped)).toBeNull();
    });
});

describe('payload', () => {
    const environment = {
        ...sampleProps().defaults,
        avatarStyle: 'lorelei',
        gifProvider: 'giphy' as const,
        gifRating: 'pg' as const,
    };

    it('shows the effective defaults of a fresh instance and stores none of them', () => {
        const props = sampleProps({
            brandColor: null,
            defaults: environment,
        });
        const data = initialFormData(props);

        expect(data).toMatchObject({
            display_name: '',
            powered_by: true,
            avatar_style: 'lorelei',
            avatar_member_choice: false,
            gif_provider: 'giphy',
            gif_enabled: true,
            gif_rating: 'pg',
        });
        expect(toPayload(data, props)).toEqual({
            brand_color: null,
            brand_radius: null,
            display_name: null,
            powered_by: null,
            avatar_style: null,
            avatar_member_choice: null,
            profile_photos: null,
            gif_provider: null,
            gif_enabled: null,
            gif_rating: null,
            gif_key: '',
            gif_key_clear: false,
        });
    });

    it('shows "Profile photos" as stored, else off by default, and stores it like the member choice', () => {
        const fresh = sampleProps();

        expect(initialFormData(fresh).profile_photos).toBe(false);
        expect(
            toPayload(
                { ...initialFormData(fresh), profile_photos: true },
                fresh,
            ).profile_photos,
        ).toBe(true);

        const stored = sampleProps({ profilePhotos: true });

        expect(initialFormData(stored).profile_photos).toBe(true);
        expect(toPayload(initialFormData(stored), stored).profile_photos).toBe(
            true,
        );
        expect(
            toPayload(
                { ...initialFormData(stored), profile_photos: false },
                stored,
            ).profile_photos,
        ).toBeNull();
    });

    it('stores only the field the admin changed', () => {
        const props = sampleProps({
            brandColor: null,
            defaults: environment,
        });
        const untouched = toPayload(initialFormData(props), props);

        expect(
            toPayload(
                { ...initialFormData(props), brand_color: '#FFD600' },
                props,
            ),
        ).toEqual({ ...untouched, brand_color: '#ffd600' });
        expect(
            toPayload(
                {
                    ...initialFormData(props),
                    avatar_style: 'thumbs',
                    gif_enabled: false,
                },
                props,
            ),
        ).toEqual({
            ...untouched,
            avatar_style: 'thumbs',
            gif_enabled: false,
        });
    });

    it('sends a stored value back unchanged, even one equal to the default', () => {
        const props = sampleProps({
            displayName: 'Skrüm',
            poweredBy: true,
            avatarStyle: 'fun-emoji',
            avatarMemberChoice: true,
            gifProvider: 'tenor',
            gifEnabled: false,
            gifRating: 'g',
            defaults: environment,
        });

        expect(toPayload(initialFormData(props), props)).toMatchObject({
            display_name: 'Skrüm',
            powered_by: true,
            avatar_style: 'fun-emoji',
            avatar_member_choice: true,
            gif_provider: 'tenor',
            gif_enabled: false,
            gif_rating: 'g',
        });
    });

    it('clears a stored value that the admin moves back onto the default', () => {
        const props = sampleProps({
            displayName: 'Nordlys',
            avatarStyle: 'fun-emoji',
            gifProvider: 'tenor',
            gifEnabled: false,
            gifRating: 'r',
            defaults: environment,
        });

        expect(
            toPayload(
                {
                    ...initialFormData(props),
                    display_name: ' ',
                    avatar_style: 'lorelei',
                    gif_provider: 'giphy',
                    gif_enabled: true,
                    gif_rating: 'pg',
                },
                props,
            ),
        ).toMatchObject({
            display_name: null,
            avatar_style: null,
            gif_provider: null,
            gif_enabled: null,
            gif_rating: null,
        });
    });

    it('marks the fields that follow the default until they are changed', () => {
        const props = sampleProps({
            gifRating: 'pg-13',
            defaults: environment,
        });
        const data = initialFormData(props);

        expect(followsDefault(data, props)).toEqual({
            displayName: true,
            poweredBy: true,
            avatarStyle: true,
            gifProvider: true,
            gifEnabled: true,
            gifRating: false,
        });
        expect(
            followsDefault(
                {
                    ...data,
                    display_name: 'Nordlys',
                    avatar_style: 'thumbs',
                    gif_provider: '',
                },
                props,
            ),
        ).toMatchObject({
            displayName: false,
            avatarStyle: false,
            gifProvider: false,
        });
    });

    it('normalises the colour and keeps a stored radius', () => {
        const props = sampleProps({ brandRadius: 10 });
        const payload = toPayload(
            {
                ...initialFormData(props),
                brand_color: ' 2B63B0 ',
                display_name: '  Nordlys ',
            },
            props,
        );

        expect(payload.brand_color).toBe('#2b63b0');
        expect(payload.brand_radius).toBe(10);
        expect(payload.display_name).toBe('Nordlys');
    });

    it('does not store a typed colour equal to the default', () => {
        const props = sampleProps({ brandColor: null });
        const payload = toPayload(
            { ...initialFormData(props), brand_color: 'BB4D2A' },
            props,
        );

        expect(payload.brand_color).toBeNull();
    });

    it('counts the fields that differ', () => {
        const props = sampleProps();
        const initial = toPayload(initialFormData(props), props);

        expect(countChanges(initial, initial)).toBe(0);
        expect(
            countChanges(initial, {
                ...initial,
                brand_radius: 16,
                powered_by: !initial.powered_by,
                gif_key: 'typed',
            }),
        ).toBe(3);
    });
});

describe('paletteStyle', () => {
    it('exposes the tokens of the asked theme and the radius in rem', () => {
        expect(paletteStyle(samplePalette, 'dark', 8)).toMatchObject({
            '--radius': '0.5rem',
            '--primary': samplePalette.dark.primary,
            '--skrum-primary-soft': samplePalette.dark['skrum-primary-soft'],
        });
        expect(paletteStyle(null, 'light', 10)).toEqual({
            '--radius': '0.625rem',
        });
    });
});
