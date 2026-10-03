<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BrandingUpdateRequest;
use App\Models\InstanceSetting;
use App\Models\User;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\Branding\BrandAssets;
use App\Support\Branding\BrandPalette;
use App\Support\Branding\BrandPaletteSummary;
use App\Support\Branding\BrandStyle;
use App\Support\InstanceSettings;
use App\Support\Mail\MailBrand;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            'displayName' => $settings->storedDisplayName(),
            'poweredBy' => $settings->storedPoweredBy(),
            'avatarStyle' => $settings->storedAvatarStyle(),
            'avatarMemberChoice' => $settings->storedAvatarMemberChoice(),
            'profilePhotos' => $settings->storedProfilePhotos(),
            'gifProvider' => $settings->storedGifProvider(),
            'gifEnabled' => $settings->storedGifEnabled(),
            'gifRating' => $settings->storedGifRating(),
            'hasGifKey' => $settings->hasGifKey(),
            'defaults' => [
                'brandColor' => self::DefaultBrandColor,
                'brandRadius' => BrandStyle::DefaultRadiusPx,
                'displayName' => $settings->defaultDisplayName(),
                'poweredBy' => InstanceSettings::DefaultPoweredBy,
                'avatarStyle' => $settings->defaultAvatarStyle(),
                'avatarMemberChoice' => InstanceSettings::DefaultAvatarMemberChoice,
                'profilePhotos' => InstanceSettings::DefaultProfilePhotos,
                'gifProvider' => $settings->defaultGifProvider(),
                'gifEnabled' => InstanceSettings::DefaultGifEnabled,
                'gifRating' => $settings->defaultGifRating(),
            ],
            'assets' => [
                'logoLightUrl' => $assets->url('logo-light'),
                'logoDarkUrl' => $assets->url('logo-dark'),
                'faviconUrl' => $assets->url('favicon'),
                'logoMailUrl' => $assets->url('logo-mail'),
                'mailShowsName' => $assets->mime('logo-light') !== null && resolve(MailBrand::class)->logo() === null,
            ],
            'palette' => $color === null
                ? null
                : BrandPaletteSummary::of(BrandPalette::derive($color, $radius ?? BrandStyle::DefaultRadiusPx)),
            'avatarStyles' => $this->avatarStyles($catalogue, $request->user()),
        ]);
    }

    public function update(BrandingUpdateRequest $request, InstanceSettings $settings, RecordAuditEvent $recordAuditEvent): RedirectResponse
    {
        DB::transaction(function () use ($request, $settings, $recordAuditEvent): void {
            $before = $this->storedBranding();

            $settings->setMany($request->settings());

            $after = $this->storedBranding();

            $changedKeys = array_values(array_filter(
                array_column(InstanceSettingKey::branding(), 'value'),
                fn (string $key): bool => ($before[$key] ?? null) !== ($after[$key] ?? null),
            ));

            if ($changedKeys === []) {
                return;
            }

            $recordAuditEvent->handle(AuditAction::SettingsUpdated, $request->user(), null, ['section' => 'branding', 'keys' => $changedKeys]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Branding saved.')]);

        return to_route('admin.branding.edit');
    }

    public function destroy(Request $request, InstanceSettings $settings, BrandAssets $assets, RecordAuditEvent $recordAuditEvent): RedirectResponse
    {
        foreach (BrandAssets::Names as $asset) {
            $assets->remove($asset);
        }

        DB::transaction(function () use ($request, $settings, $recordAuditEvent): void {
            $settings->setMany(array_fill_keys(array_column(InstanceSettingKey::branding(), 'value'), null));

            $recordAuditEvent->handle(AuditAction::BrandingReset, $request->user());
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Branding reset to the Skrüm defaults.')]);

        return to_route('admin.branding.edit');
    }

    /**
     * The raw stored rows: a secret is compared by its stored form and never decrypted.
     *
     * @return array<string, mixed>
     */
    private function storedBranding(): array
    {
        return InstanceSetting::query()
            ->whereIn('key', array_column(InstanceSettingKey::branding(), 'value'))
            ->get()
            ->pluck('value', 'key')
            ->all();
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
