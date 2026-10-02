<?php

namespace App\Support\Mail;

use App\Support\Branding\BrandAssets;
use App\Support\Branding\BrandPalette;
use App\Support\InstanceSettings;
use Illuminate\Support\Arr;

class MailBrand
{
    /**
     * Hex values of docs/design-system/components/Emails/README.md.
     *
     * @var array{light: array<string, string>, dark: array<string, string>}
     */
    public const array Palette = [
        'light' => [
            'muted' => '#f3efeb',
            'card' => '#ffffff',
            'border' => '#e4dfd9',
            'input' => '#948a83',
            'foreground' => '#211a16',
            'muted-foreground' => '#655b55',
            'primary' => '#bb4d2a',
            'primary-foreground' => '#fefbf8',
            'skrum-primary-text' => '#9c3917',
            'skrum-destructive-text' => '#a51c30',
        ],
        'dark' => [
            'muted' => '#27221e',
            'card' => '#1b1613',
            'border' => '#352f2b',
            'input' => '#6f6761',
            'foreground' => '#f2f0ec',
            'muted-foreground' => '#b0aaa3',
            'primary' => '#ea865e',
            'primary-foreground' => '#1d100b',
            'skrum-primary-text' => '#f9a782',
            'skrum-destructive-text' => '#feaaa9',
        ],
    ];

    /** @var array<int, string> */
    private const array BrandTokens = ['primary', 'primary-foreground', 'skrum-primary-text'];

    /** @var array<int, string> */
    private const array MailSafeLogoTypes = ['image/png', 'image/jpeg'];

    public function __construct(private InstanceSettings $settings, private BrandAssets $assets) {}

    public function name(): string
    {
        return $this->settings->displayName();
    }

    public function poweredBy(): bool
    {
        return $this->settings->poweredBy();
    }

    public function instanceUrl(): string
    {
        return url('/');
    }

    /**
     * Most mail clients do not draw SVG or WebP: such a logo is replaced by the name.
     */
    public function logoUrl(): ?string
    {
        if (! in_array($this->assets->mime('logo-light'), self::MailSafeLogoTypes, true)) {
            return null;
        }

        $path = $this->assets->url('logo-light');

        return $path === null ? null : url($path);
    }

    /**
     * @return array{light: array<string, string>, dark: array<string, string>}
     */
    public function colors(): array
    {
        $color = $this->settings->brandColor();

        if ($color === null) {
            return self::Palette;
        }

        $brand = BrandPalette::derive($color)->toHex();

        return [
            'light' => [...self::Palette['light'], ...Arr::only($brand['light'], self::BrandTokens)],
            'dark' => [...self::Palette['dark'], ...Arr::only($brand['dark'], self::BrandTokens)],
        ];
    }
}
