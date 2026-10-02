<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\Avatars\AvatarUrl;
use App\Support\Gifs\GifCatalog;
use App\Support\InstanceSettings;
use Inertia\Inertia;
use Inertia\Response;

class AboutPagesController extends Controller
{
    public function show(InstanceSettings $settings, AvatarUrl $avatarUrl, AvatarStyleCatalogue $catalogue, GifCatalog $gifCatalog): Response
    {
        return Inertia::render('about', [
            'name' => $settings->displayName(),
            'version' => (string) config('skrum.version'),
            'poweredBy' => $settings->poweredBy(),
            'attributions' => [
                'avatarStyles' => array_values(array_filter(array_map(
                    $catalogue->attribution(...),
                    $this->stylesInUse($settings, $avatarUrl, $catalogue),
                ))),
                'gifProvider' => $gifCatalog->providerName(),
            ],
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function stylesInUse(InstanceSettings $settings, AvatarUrl $avatarUrl, AvatarStyleCatalogue $catalogue): array
    {
        $instanceStyle = $avatarUrl->instanceStyle();

        if (! $settings->avatarMemberChoice()) {
            return [$instanceStyle];
        }

        $memberStyles = User::query()
            ->whereNotNull('avatar_style')
            ->distinct()
            ->orderBy('avatar_style')
            ->pluck('avatar_style')
            ->filter(fn (string $style): bool => $catalogue->isSelectable($style))
            ->all();

        return array_values(array_unique([$instanceStyle, ...$memberStyles]));
    }
}
