import type { BrandingPageProps, Palette } from './branding';

/** Sample data for the bench and the tests: hex values here are data. */
export const samplePalette: Palette = {
    light: {
        primary: '#2b63b0',
        'primary-foreground': '#fdfcfb',
        ring: '#2b63b0',
        accent: '#edf1f7',
        'skrum-primary-soft': '#e8eff9',
        'skrum-primary-text': '#27579b',
    },
    dark: {
        primary: '#7ea9ee',
        'primary-foreground': '#0f1520',
        ring: '#7ea9ee',
        accent: '#272c34',
        'skrum-primary-soft': '#222c3c',
        'skrum-primary-text': '#9dbdf2',
    },
    ratios: {
        light: { onPrimary: 5.8, primaryOnSurface: 5.6 },
        dark: { onPrimary: 7.2, primaryOnSurface: 6.4 },
    },
    warnings: [],
};

export const adjustedPalette: Palette = {
    light: {
        primary: '#8f7500',
        'primary-foreground': '#fdfcfb',
        ring: '#8f7500',
        accent: '#f4f1e6',
        'skrum-primary-soft': '#f6f0d6',
        'skrum-primary-text': '#6f5a00',
    },
    dark: {
        primary: '#e3c22b',
        'primary-foreground': '#17140a',
        ring: '#e3c22b',
        accent: '#2e2b20',
        'skrum-primary-soft': '#322c14',
        'skrum-primary-text': '#e6cd5c',
    },
    ratios: {
        light: { onPrimary: 4.51, primaryOnSurface: 4.4 },
        dark: { onPrimary: 9.89, primaryOnSurface: 9.1 },
    },
    warnings: [
        {
            key: 'Too light to carry text: lightness adjusted from :from % to :to % in the light theme.',
            replace: { from: 88, to: 56 },
        },
    ],
};

export const weakPalette: Palette = {
    ...samplePalette,
    ratios: {
        light: { onPrimary: 3.1, primaryOnSurface: 3 },
        dark: { onPrimary: 5.8, primaryOnSurface: 5 },
    },
    warnings: [
        {
            key: 'Nearly neutral colour: active states will rely on lightness alone.',
            replace: {},
        },
        {
            key: 'Hue close to the destructive red: destructive actions keep their icon and label, do not remove them.',
            replace: {},
        },
    ],
};

export function sampleProps(
    overrides: Partial<BrandingPageProps> = {},
): BrandingPageProps {
    return {
        brandColor: '#2b63b0',
        brandRadius: null,
        displayName: null,
        poweredBy: null,
        avatarStyle: null,
        avatarMemberChoice: null,
        gifProvider: null,
        gifEnabled: null,
        gifRating: null,
        hasGifKey: false,
        defaults: {
            brandColor: '#bb4d2a',
            brandRadius: 10,
            displayName: 'Skrüm',
            poweredBy: true,
            avatarStyle: 'thumbs',
            avatarMemberChoice: false,
            gifProvider: null,
            gifEnabled: true,
            gifRating: 'g',
        },
        assets: {
            logoLightUrl: null,
            logoDarkUrl: null,
            faviconUrl: null,
            logoMailUrl: null,
            mailShowsName: false,
        },
        palette: samplePalette,
        avatarStyles: [
            {
                value: 'thumbs',
                name: 'Thumbs',
                license: 'CC0 1.0',
                attribution: null,
                attributionRequired: false,
                sampleUrls: [],
            },
            {
                value: 'fun-emoji',
                name: 'Fun Emoji',
                license: 'CC BY 4.0',
                attribution: 'Fun Emoji Set by Davis Uche, CC BY 4.0',
                attributionRequired: true,
                sampleUrls: [],
            },
        ],
        ...overrides,
    };
}
