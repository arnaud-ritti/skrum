<?php

namespace App\Http\Controllers\Admin;

use App\Enums\InstanceSettingKey;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BrandingUpdateRequest;
use App\Models\User;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\Branding\BrandAssets;
use App\Support\Branding\BrandPalette;
use App\Support\Branding\BrandPaletteSummary;
use App\Support\Branding\BrandStyle;
use App\Support\InstanceSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BrandingController extends Controller
{
    public const string DefaultBrandColor = '#bb4d2a';

    /** @var array<int, string> */
    private const array SampleSeeds = ['5f2b8c1e9a4d47f0b3c6d8e1a7f90214', 'c41d7e02b96a4f35a8e0d3b7f1c5926e'];

    public function edit(Request $request, InstanceSettings $settings, BrandAssets $assets, AvatarStyleCatalogue $catalogue): Response
    {
        $color = $settings->brandColor();
        $radius = $settings->brandRadius();

        return Inertia::render('admin/branding', [
            'brandColor' => $color,
            'brandRadius' => $radius,
            'displayName' => $settings->displayName(),
            'poweredBy' => $settings->poweredBy(),
            'avatarStyle' => $settings->avatarStyle(),
            'avatarMemberChoice' => $settings->avatarMemberChoice(),
            'gifProvider' => $settings->gifProvider(),
            'gifEnabled' => $settings->gifEnabled(),
            'gifRating' => $settings->gifRating(),
            'hasGifKey' => $settings->hasGifKey(),
            'defaults' => [
                'brandColor' => self::DefaultBrandColor,
                'brandRadius' => BrandStyle::DefaultRadiusPx,
                'displayName' => (string) config('app.name'),
            ],
            'assets' => [
                'logoLightUrl' => $assets->url('logo-light'),
                'logoDarkUrl' => $assets->url('logo-dark'),
                'faviconUrl' => $assets->url('favicon'),
            ],
            'palette' => $color === null
                ? null
                : BrandPaletteSummary::of(BrandPalette::derive($color, $radius ?? BrandStyle::DefaultRadiusPx)),
            'avatarStyles' => $this->avatarStyles($catalogue, $request->user()),
        ]);
    }

    public function update(BrandingUpdateRequest $request, InstanceSettings $settings): RedirectResponse
    {
        $settings->setMany($request->settings());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Branding saved.')]);

        return to_route('admin.branding.edit');
    }

    public function destroy(InstanceSettings $settings, BrandAssets $assets): RedirectResponse
    {
        foreach (BrandAssets::Names as $asset) {
            $assets->remove($asset);
        }

        $settings->setMany(array_fill_keys(array_column(InstanceSettingKey::cases(), 'value'), null));

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Branding reset to the Skrüm defaults.')]);

        return to_route('admin.branding.edit');
    }

    /**
     * @return array<int, array{
     *     value: string,
     *     name: string,
     *     license: string,
     *     attribution: ?string,
     *     attributionRequired: bool,
     *     sampleUrls: array<int, string>
     * }>
     */
    private function avatarStyles(AvatarStyleCatalogue $catalogue, User $admin): array
    {
        $seeds = [$admin->avatarSeed(), ...self::SampleSeeds];

        return array_map(fn (array $style): array => [
            ...$style,
            'sampleUrls' => array_map(
                fn (string $seed): string => route('admin.avatarPreviews.show', ['style' => $style['value'], 'seed' => $seed], absolute: false),
                $seeds,
            ),
        ], $catalogue->styles());
    }
}
