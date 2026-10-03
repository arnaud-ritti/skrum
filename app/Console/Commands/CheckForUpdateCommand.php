<?php

namespace App\Console\Commands;

use App\Enums\InstanceSettingKey;
use App\Support\InstanceSettings;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

#[Description('Ask the release feed for the latest Skrüm version, when the admin turned the check on')]
#[Signature('skrum:check-for-update')]
class CheckForUpdateCommand extends Command
{
    private const string VersionPattern = '/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/D';

    private const int TimeoutSeconds = 5;

    public function handle(InstanceSettings $settings): int
    {
        if (! $settings->updateCheckEnabled()) {
            $this->comment('The update check is off.');

            return self::SUCCESS;
        }

        $this->info('Asking the release feed…');

        $latest = $this->latestVersion();

        if ($latest === null) {
            Log::warning('The update check got no usable version from the release feed.');
            $this->warn('The release feed gave no usable version.');

            return self::SUCCESS;
        }

        $settings->setMany([
            InstanceSettingKey::LatestVersion->value => $latest,
            InstanceSettingKey::UpdateCheckedAt->value => now()->toIso8601String(),
        ]);

        $this->comment("Latest version: {$latest}.");

        return self::SUCCESS;
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

        if (preg_match(self::VersionPattern, $version) !== 1) {
            return null;
        }

        return $version;
    }
}
