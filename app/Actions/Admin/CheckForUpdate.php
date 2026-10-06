<?php

namespace App\Actions\Admin;

use App\Enums\InstanceSettingKey;
use App\Support\InstanceSettings;
use App\Support\InstanceVersion;
use Illuminate\Support\Facades\Http;

class CheckForUpdate
{
    private const int TimeoutSeconds = 5;

    public function __construct(private InstanceSettings $settings) {}

    /**
     * Asks the release feed for the latest version and stores it with the time of the check.
     * Null, and nothing stored, when the feed gives no usable version.
     */
    public function handle(): ?string
    {
        $latest = $this->latestVersion();

        if ($latest === null) {
            return null;
        }

        $this->settings->setMany([
            InstanceSettingKey::LatestVersion->value => $latest,
            InstanceSettingKey::UpdateCheckedAt->value => now()->toIso8601String(),
        ]);

        return $latest;
    }

    private function latestVersion(): ?string
    {
        $tag = rescue(
            fn (): mixed => Http::timeout(self::TimeoutSeconds)
                ->acceptJson()
                ->get((string) config('skrum.update_feed'))
                ->throw()
                ->json('tag_name'),
            null,
            report: false,
        );

        if (! is_string($tag)) {
            return null;
        }

        $version = ltrim(trim($tag), 'vV');

        if (! InstanceVersion::isRelease($version)) {
            return null;
        }

        return $version;
    }
}
