export type ThemeName = 'light' | 'dark';

export type PaletteWarning = {
    key: string;
    replace: Record<string, number | string>;
};

export type Palette = {
    light: Record<string, string>;
    dark: Record<string, string>;
    ratios: Record<ThemeName, { onPrimary: number; primaryOnSurface: number }>;
    warnings: PaletteWarning[];
};

export type BrandAssetName =
    | 'logo-light'
    | 'logo-dark'
    | 'favicon'
    | 'logo-mail';

export type GifProvider = 'giphy' | 'tenor';

export type GifRating = 'g' | 'pg' | 'pg-13' | 'r';

export type AdminAvatarStyle = {
    value: string;
    name: string;
    license: string;
    attribution: string | null;
    attributionRequired: boolean;
    sampleUrls: string[];
};

/** What applies while nothing is stored: the environment, else Skrüm. */
export type BrandingDefaults = {
    brandColor: string;
    brandRadius: number;
    displayName: string;
    poweredBy: boolean;
    avatarStyle: string;
    avatarMemberChoice: boolean;
    gifProvider: GifProvider | null;
    gifEnabled: boolean;
    gifRating: GifRating;
};

/** Every setting is the STORED value: null means the default applies. */
export type BrandingPageProps = {
    brandColor: string | null;
    brandRadius: number | null;
    displayName: string | null;
    poweredBy: boolean | null;
    avatarStyle: string | null;
    avatarMemberChoice: boolean | null;
    gifProvider: GifProvider | null;
    gifEnabled: boolean | null;
    gifRating: GifRating | null;
    hasGifKey: boolean;
    defaults: BrandingDefaults;
    assets: {
        logoLightUrl: string | null;
        logoDarkUrl: string | null;
        faviconUrl: string | null;
        logoMailUrl: string | null;
        /** The instance logo is one mail clients cannot draw, and no mail logo is stored. */
        mailShowsName: boolean;
    };
    palette: Palette | null;
    avatarStyles: AdminAvatarStyle[];
};

export type BrandingFormData = {
    brand_color: string;
    brand_radius: number;
    display_name: string;
    powered_by: boolean;
    avatar_style: string;
    avatar_member_choice: boolean;
    gif_provider: GifProvider | '';
    gif_enabled: boolean;
    gif_rating: GifRating;
    gif_key: string;
    gif_key_clear: boolean;
};

export type BrandingPayload = {
    brand_color: string | null;
    brand_radius: number | null;
    display_name: string | null;
    powered_by: boolean | null;
    avatar_style: string | null;
    avatar_member_choice: boolean | null;
    gif_provider: GifProvider | null;
    gif_enabled: boolean | null;
    gif_rating: GifRating | null;
    gif_key: string;
    gif_key_clear: boolean;
};

export const MinRadius = 0;
export const MaxRadius = 16;
export const MaxAssetBytes = 512 * 1024;
export const PreviewDelayMs = 250;

export const RadiusPresets = [0, 4, 8, 16] as const;

export type RadiusPreset = (typeof RadiusPresets)[number];

export const BrandAssetNames: BrandAssetName[] = [
    'logo-light',
    'logo-dark',
    'favicon',
    'logo-mail',
];

/** The styles of the short list, in the order of the mockup. */
export const FeaturedAvatarStyles = [
    'initials',
    'notionists',
    'thumbs',
    'lorelei',
    'glass',
    'shapes',
    'fun-emoji',
];

export const AssetMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
];

export const AssetExtensions = ['png', 'jpg', 'jpeg', 'webp', 'svg'];

export const AssetAccept = [
    ...AssetExtensions.map((extension) => `.${extension}`),
    ...AssetMimeTypes,
].join(',');

/**
 * Lower-case `#rrggbb` for a 3- or 6-digit hex, with or without `#`; null for
 * anything else. The server applies the same rule before deriving a palette.
 */
export function normalizeHex(input: string): string | null {
    const digits = input.trim().replace(/^#/, '').toLowerCase();

    if (/^[0-9a-f]{6}$/.test(digits)) {
        return `#${digits}`;
    }

    if (/^[0-9a-f]{3}$/.test(digits)) {
        return `#${digits.replace(/./g, (digit) => digit + digit)}`;
    }

    return null;
}

export function clampRadius(value: number): number {
    if (!Number.isFinite(value)) {
        return MinRadius;
    }

    return Math.min(MaxRadius, Math.max(MinRadius, Math.round(value)));
}

export function isRadiusPreset(value: number): value is RadiusPreset {
    return RadiusPresets.some((preset) => preset === value);
}

/**
 * The segment shown while the default radius applies: the server accepts 0 to
 * 16, the control offers four values. Between two segments the smaller one wins.
 */
export function nearestRadiusPreset(value: number): RadiusPreset {
    const radius = clampRadius(value);

    return RadiusPresets.reduce((nearest, preset) =>
        Math.abs(preset - radius) < Math.abs(nearest - radius)
            ? preset
            : nearest,
    );
}

export type ContrastLevel = 'AAA' | 'AA' | 'below';

export function contrastLevel(ratio: number): ContrastLevel {
    if (ratio >= 7) {
        return 'AAA';
    }

    if (ratio >= 4.5) {
        return 'AA';
    }

    return 'below';
}

/** One decimal, rounded down: 4.49 must never read as 4.5. */
export function formatRatio(ratio: number): string {
    return (Math.floor(ratio * 10 + 1e-9) / 10).toFixed(1);
}

export type AssetRejection = 'size' | 'type';

export function assetRejection(file: File): AssetRejection | null {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const typeAllowed =
        file.type === ''
            ? AssetExtensions.includes(extension)
            : AssetMimeTypes.includes(file.type);

    if (!typeAllowed) {
        return 'type';
    }

    if (file.size > MaxAssetBytes) {
        return 'size';
    }

    return null;
}

export function initialFormData(props: BrandingPageProps): BrandingFormData {
    return {
        brand_color: props.brandColor ?? '',
        brand_radius: props.brandRadius ?? props.defaults.brandRadius,
        display_name: props.displayName ?? '',
        powered_by: props.poweredBy ?? props.defaults.poweredBy,
        avatar_style: props.avatarStyle ?? props.defaults.avatarStyle,
        avatar_member_choice:
            props.avatarMemberChoice ?? props.defaults.avatarMemberChoice,
        gif_provider: props.gifProvider ?? props.defaults.gifProvider ?? '',
        gif_enabled: props.gifEnabled ?? props.defaults.gifEnabled,
        gif_rating: props.gifRating ?? props.defaults.gifRating,
        gif_key: '',
        gif_key_clear: false,
    };
}

/**
 * What to store for one field. A field left as the page showed it goes back as
 * it is stored (null stays null, so nothing gets pinned and the environment
 * keeps deciding); a field moved onto the default is cleared; anything else is
 * the admin's choice.
 */
function storable<T>(value: T, stored: T | null, fallback: T): T | null {
    if (value === (stored ?? fallback)) {
        return stored;
    }

    return value === fallback ? null : value;
}

/** The field is empty while the default name applies. */
function storableName(
    name: string,
    stored: string | null,
    fallback: string,
): string | null {
    if (name === '') {
        return null;
    }

    if (name === stored) {
        return stored;
    }

    return name === fallback ? null : name;
}

export type StoredBranding = Pick<
    BrandingPageProps,
    | 'brandRadius'
    | 'displayName'
    | 'poweredBy'
    | 'avatarStyle'
    | 'avatarMemberChoice'
    | 'gifProvider'
    | 'gifEnabled'
    | 'gifRating'
    | 'defaults'
>;

/** What is sent to the server: null clears a setting, see `storable`. */
export function toPayload(
    data: BrandingFormData,
    props: StoredBranding,
): BrandingPayload {
    const { defaults } = props;
    const color = data.brand_color.trim();

    return {
        brand_color: color === '' ? null : (normalizeHex(color) ?? color),
        brand_radius: storable(
            data.brand_radius,
            props.brandRadius,
            defaults.brandRadius,
        ),
        display_name: storableName(
            data.display_name.trim(),
            props.displayName,
            defaults.displayName,
        ),
        powered_by: storable(
            data.powered_by,
            props.poweredBy,
            defaults.poweredBy,
        ),
        avatar_style: storable(
            data.avatar_style,
            props.avatarStyle,
            defaults.avatarStyle,
        ),
        avatar_member_choice: storable(
            data.avatar_member_choice,
            props.avatarMemberChoice,
            defaults.avatarMemberChoice,
        ),
        gif_provider: storable<GifProvider | null>(
            data.gif_provider === '' ? null : data.gif_provider,
            props.gifProvider,
            defaults.gifProvider,
        ),
        gif_enabled: storable(
            data.gif_enabled,
            props.gifEnabled,
            defaults.gifEnabled,
        ),
        gif_rating: storable(
            data.gif_rating,
            props.gifRating,
            defaults.gifRating,
        ),
        gif_key: data.gif_key,
        gif_key_clear: data.gif_key_clear,
    };
}

export type DefaultedField =
    | 'displayName'
    | 'poweredBy'
    | 'avatarStyle'
    | 'gifProvider'
    | 'gifEnabled'
    | 'gifRating';

/** The fields that show the default because nothing is stored for them. */
export function followsDefault(
    data: BrandingFormData,
    props: StoredBranding,
): Record<DefaultedField, boolean> {
    const { defaults } = props;

    return {
        displayName:
            props.displayName === null && data.display_name.trim() === '',
        poweredBy:
            props.poweredBy === null && data.powered_by === defaults.poweredBy,
        avatarStyle:
            props.avatarStyle === null &&
            data.avatar_style === defaults.avatarStyle,
        gifProvider:
            props.gifProvider === null &&
            data.gif_provider === (defaults.gifProvider ?? ''),
        gifEnabled:
            props.gifEnabled === null &&
            data.gif_enabled === defaults.gifEnabled,
        gifRating:
            props.gifRating === null && data.gif_rating === defaults.gifRating,
    };
}

export function countChanges(
    initial: BrandingPayload,
    current: BrandingPayload,
): number {
    const keys = Object.keys(initial) as Array<keyof BrandingPayload>;

    return keys.filter((key) => initial[key] !== current[key]).length;
}

/** Changes of these values mean the server stored something new. */
export function formSignature(props: BrandingPageProps): string {
    return JSON.stringify([
        props.brandColor,
        props.brandRadius,
        props.displayName,
        props.poweredBy,
        props.avatarStyle,
        props.avatarMemberChoice,
        props.gifProvider,
        props.gifEnabled,
        props.gifRating,
        props.hasGifKey,
        props.defaults,
    ]);
}

export function paletteStyle(
    palette: Palette | null,
    theme: ThemeName,
    radius: number,
): Record<string, string> {
    const style: Record<string, string> = {
        '--radius': `${clampRadius(radius) / 16}rem`,
    };

    if (palette === null) {
        return style;
    }

    for (const [token, value] of Object.entries(palette[theme])) {
        style[`--${token}`] = value;
    }

    return style;
}
