<?php

namespace App\Support\Avatars;

use Illuminate\Support\Str;

class AvatarStyleCatalogue
{
    public const string Initials = 'initials';

    public const string AttributionLicense = 'CC BY 4.0';

    /**
     * Source work, author and licence of each style, from docs/design-system/components/AvatarStylePicker/README.md.
     *
     * @var array<string, array{0: string, 1: string, 2: string}>
     */
    private const array Licenses = [
        'adventurer' => ['Adventurer', 'Lisa Wischofsky', 'CC BY 4.0'],
        'adventurer-neutral' => ['Adventurer Neutral', 'Lisa Wischofsky', 'CC BY 4.0'],
        'avataaars' => ['Avataaars', 'Pablo Stanley', 'Free for personal and commercial use'],
        'avataaars-neutral' => ['Avataaars', 'Pablo Stanley', 'Free for personal and commercial use'],
        'big-ears' => ['Face Generator', 'The Visual Team', 'CC BY 4.0'],
        'big-ears-neutral' => ['Face Generator', 'The Visual Team', 'CC BY 4.0'],
        'big-smile' => ['Custom Avatar', 'Ashley Seo', 'CC BY 4.0'],
        'bottts' => ['Bottts', 'Pablo Stanley', 'Free for personal and commercial use'],
        'bottts-neutral' => ['Bottts', 'Pablo Stanley', 'Free for personal and commercial use'],
        'croodles' => ['Croodles - Doodle your face', 'vijay verma', 'CC BY 4.0'],
        'croodles-neutral' => ['Croodles - Doodle your face', 'vijay verma', 'CC BY 4.0'],
        'dylan' => ['Dylan! The Avatar Generator', 'Natalia Spivak', 'CC BY 4.0'],
        'fun-emoji' => ['Fun Emoji Set', 'Davis Uche', 'CC BY 4.0'],
        'glass' => ['Glass', 'DiceBear', 'CC0 1.0'],
        'icons' => ['Bootstrap Icons', 'The Bootstrap Authors', 'MIT'],
        'identicon' => ['Identicon', 'DiceBear', 'CC0 1.0'],
        'initials' => ['Initials', 'DiceBear', 'CC0 1.0'],
        'lorelei' => ['Lorelei', 'Lisa Wischofsky', 'CC0 1.0'],
        'lorelei-neutral' => ['Lorelei Neutral', 'Lisa Wischofsky', 'CC0 1.0'],
        'micah' => ['Avatar Illustration System', 'Micah Lanier', 'CC BY 4.0'],
        'miniavs' => ['Miniavs - Free Avatar Creator', 'Webpixels', 'CC BY 4.0'],
        'notionists' => ['Notionists', 'Zoish', 'CC0 1.0'],
        'notionists-neutral' => ['Notionists', 'Zoish', 'CC0 1.0'],
        'open-peeps' => ['Open Peeps', 'Pablo Stanley', 'CC0 1.0'],
        'personas' => ['Personas by Draftbit', 'Draftbit - draftbit.com', 'CC BY 4.0'],
        'pixel-art' => ['Pixel Art', 'DiceBear', 'CC0 1.0'],
        'pixel-art-neutral' => ['Pixel Art Neutral', 'DiceBear', 'CC0 1.0'],
        'rings' => ['Rings', 'DiceBear', 'CC0 1.0'],
        'shapes' => ['Shapes', 'DiceBear', 'CC0 1.0'],
        'thumbs' => ['Thumbs', 'DiceBear', 'CC0 1.0'],
        'toon-head' => ['ToonHead', 'Johan Melin', 'CC BY 4.0'],
    ];

    /** @var ?array<int, string> */
    private ?array $values = null;

    /**
     * The styles installed on disk, plus the initials fallback.
     *
     * @return array<int, string>
     */
    public function values(): array
    {
        if ($this->values !== null) {
            return $this->values;
        }

        $files = glob(base_path('vendor/dicebear/styles/src/*.json')) ?: [];
        $values = array_map(fn (string $file): string => basename($file, '.json'), $files);
        $values = array_filter($values, fn (string $value): bool => preg_match('/^[a-z0-9-]+$/D', $value) === 1);

        return $this->values = array_values(array_unique([...$values, self::Initials]));
    }

    /**
     * The styles an admin or a member may pick: installed, and with a licence we can state.
     *
     * @return array<int, string>
     */
    public function selectable(): array
    {
        return array_values(array_filter(
            $this->values(),
            fn (string $value): bool => array_key_exists($value, self::Licenses),
        ));
    }

    public function isSelectable(string $style): bool
    {
        return in_array($style, $this->selectable(), true);
    }

    public function has(string $style): bool
    {
        return in_array($style, $this->values(), true);
    }

    /**
     * Null when the style has no definition on disk, whatever the name asked for.
     */
    public function path(string $style): ?string
    {
        if (! $this->has($style)) {
            return null;
        }

        $path = base_path("vendor/dicebear/styles/src/{$style}.json");

        return is_file($path) ? $path : null;
    }

    /**
     * @return array<int, array{
     *     value: string,
     *     name: string,
     *     license: string,
     *     attribution: ?string,
     *     attributionRequired: bool
     * }>
     */
    public function styles(): array
    {
        return array_map($this->style(...), $this->selectable());
    }

    /**
     * @return array{
     *     value: string,
     *     name: string,
     *     license: string,
     *     attribution: ?string,
     *     attributionRequired: bool
     * }
     */
    public function style(string $value): array
    {
        $known = self::Licenses[$value] ?? null;

        if ($known === null) {
            return [
                'value' => $value,
                'name' => Str::headline($value),
                'license' => __('See DiceBear'),
                'attribution' => null,
                'attributionRequired' => false,
            ];
        }

        [$source, $author, $license] = $known;
        $translatedLicense = __($license);

        return [
            'value' => $value,
            'name' => Str::headline($value),
            'license' => $translatedLicense,
            'attribution' => __(':source by :creator, :license', [
                'source' => $source,
                'creator' => $author,
                'license' => $translatedLicense,
            ]),
            'attributionRequired' => $license === self::AttributionLicense,
        ];
    }

    /**
     * Null for a style that does not ask for attribution.
     *
     * @return ?array{
     *     style: string,
     *     name: string,
     *     source: string,
     *     creator: string,
     *     license: string,
     *     sourceUrl: ?string
     * }
     */
    public function attribution(string $value): ?array
    {
        $known = self::Licenses[$value] ?? null;

        if ($known === null) {
            return null;
        }

        [$source, $creator, $license] = $known;

        if ($license !== self::AttributionLicense) {
            return null;
        }

        return [
            'style' => $value,
            'name' => Str::headline($value),
            'source' => $source,
            'creator' => $creator,
            'license' => $license,
            'sourceUrl' => $this->sourceUrl($value),
        ];
    }

    private function sourceUrl(string $value): ?string
    {
        $path = $this->path($value);

        if ($path === null) {
            return null;
        }

        $url = data_get(json_decode((string) file_get_contents($path), true), 'meta.source.url');

        if (! is_string($url)) {
            return null;
        }

        if (preg_match('#^https?://#i', $url) !== 1) {
            return null;
        }

        return $url;
    }
}
