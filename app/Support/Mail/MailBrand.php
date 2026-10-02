<?php

namespace App\Support\Mail;

use App\Support\Branding\BrandAssets;
use App\Support\Branding\BrandPalette;
use App\Support\InstanceSettings;
use Illuminate\Support\Arr;

class MailBrand
{
    /**
     * Hex values of docs/design-system/components/Emails/README.md; the
     * presence tokens it does not list are converted from resources/css/app.css.
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
            'skrum-roti-1' => '#e06255',
            'skrum-roti-2' => '#dd7b2b',
            'skrum-roti-3' => '#e7bf57',
            'skrum-roti-4' => '#6fb880',
            'skrum-roti-5' => '#45a992',
            'skrum-roti-foreground' => '#221812',
            'skrum-presence-1' => '#ff6d6a',
            'skrum-presence-1-foreground' => '#1c1410',
            'skrum-presence-2' => '#4871cb',
            'skrum-presence-2-foreground' => '#fefbf8',
            'skrum-presence-3' => '#f6a726',
            'skrum-presence-3-foreground' => '#1c1410',
            'skrum-presence-4' => '#59ad9b',
            'skrum-presence-4-foreground' => '#1c1410',
            'skrum-presence-5' => '#bc3b95',
            'skrum-presence-5-foreground' => '#fefbf8',
            'skrum-presence-6' => '#7ac8ef',
            'skrum-presence-6-foreground' => '#1c1410',
            'skrum-presence-7' => '#2f4362',
            'skrum-presence-7-foreground' => '#fefbf8',
            'skrum-presence-8' => '#ebe050',
            'skrum-presence-8-foreground' => '#1c1410',
            'skrum-presence-9' => '#72229e',
            'skrum-presence-9-foreground' => '#fefbf8',
            'skrum-presence-10' => '#872e00',
            'skrum-presence-10-foreground' => '#fefbf8',
            'skrum-presence-11' => '#697400',
            'skrum-presence-11-foreground' => '#fefbf8',
            'skrum-presence-12' => '#1c685d',
            'skrum-presence-12-foreground' => '#fefbf8',
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
            'skrum-roti-1' => '#ed756e',
            'skrum-roti-2' => '#ee9b58',
            'skrum-roti-3' => '#e9c769',
            'skrum-roti-4' => '#82cb92',
            'skrum-roti-5' => '#4db39e',
            'skrum-roti-foreground' => '#190f0a',
            'skrum-presence-1' => '#f5762a',
            'skrum-presence-1-foreground' => '#1c1410',
            'skrum-presence-2' => '#35b2ff',
            'skrum-presence-2-foreground' => '#1c1410',
            'skrum-presence-3' => '#dcb900',
            'skrum-presence-3-foreground' => '#1c1410',
            'skrum-presence-4' => '#a1b385',
            'skrum-presence-4-foreground' => '#1c1410',
            'skrum-presence-5' => '#f485c9',
            'skrum-presence-5-foreground' => '#1c1410',
            'skrum-presence-6' => '#96d1ff',
            'skrum-presence-6-foreground' => '#1c1410',
            'skrum-presence-7' => '#d2e9f6',
            'skrum-presence-7-foreground' => '#1c1410',
            'skrum-presence-8' => '#fae74a',
            'skrum-presence-8-foreground' => '#1c1410',
            'skrum-presence-9' => '#967bd1',
            'skrum-presence-9-foreground' => '#1c1410',
            'skrum-presence-10' => '#cd6752',
            'skrum-presence-10-foreground' => '#1c1410',
            'skrum-presence-11' => '#c1d29c',
            'skrum-presence-11-foreground' => '#1c1410',
            'skrum-presence-12' => '#50968a',
            'skrum-presence-12-foreground' => '#1c1410',
        ],
    ];

    public const int LogoHeight = 28;

    public const int DefaultLogoWidth = 121;

    public const int MaxLogoWidth = 240;

    public const int PresenceColors = 12;

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

    public function host(): string
    {
        return (string) parse_url($this->instanceUrl(), PHP_URL_HOST);
    }

    /**
     * Null when the header writes the name instead: the instance has a logo
     * mail clients cannot draw, or a name of its own and no logo.
     *
     * @return array{
     *     light: string,
     *     dark: string,
     *     width: int,
     *     height: int
     * }|null
     */
    public function logo(): ?array
    {
        $mailLogo = $this->drawable('logo-mail');

        if ($mailLogo !== null) {
            return ['light' => $mailLogo['url'], 'dark' => $mailLogo['url'], 'width' => $mailLogo['width'], 'height' => self::LogoHeight];
        }

        $light = $this->drawable('logo-light');

        if ($light !== null) {
            return ['light' => $light['url'], 'dark' => $this->drawable('logo-dark')['url'] ?? $light['url'], 'width' => $light['width'], 'height' => self::LogoHeight];
        }

        if ($this->assets->mime('logo-light') !== null) {
            return null;
        }

        if ($this->settings->storedDisplayName() !== null) {
            return null;
        }

        return [
            'light' => asset('brand/skrum-logo-mail-light.png'),
            'dark' => asset('brand/skrum-logo-mail-dark.png'),
            'width' => self::DefaultLogoWidth,
            'height' => self::LogoHeight,
        ];
    }

    /**
     * The seed is the one of the avatar, so a person keeps one colour.
     */
    public static function presence(string $avatarSeed): int
    {
        return (hexdec(substr(hash('sha256', $avatarSeed), 0, 7)) % self::PresenceColors) + 1;
    }

    /**
     * @return array{
     *     url: string,
     *     width: int
     * }|null
     */
    private function drawable(string $asset): ?array
    {
        if (! in_array($this->assets->mime($asset), self::MailSafeLogoTypes, true)) {
            return null;
        }

        $path = $this->assets->url($asset);
        $size = $this->assets->size($asset);

        if ($path === null || $size === null) {
            return null;
        }

        return [
            'url' => url($path),
            'width' => min(self::MaxLogoWidth, max(1, (int) round($size['width'] * self::LogoHeight / $size['height']))),
        ];
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
