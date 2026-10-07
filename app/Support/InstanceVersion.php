<?php

namespace App\Support;

use Illuminate\Support\Str;

class InstanceVersion
{
    public const string ReleasePattern = '/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/D';

    public function __construct(private InstanceSettings $settings) {}

    public function current(): string
    {
        return ltrim(trim((string) config('skrum.version')), 'vV');
    }

    public static function isRelease(string $version): bool
    {
        return preg_match(self::ReleasePattern, $version) === 1;
    }

    /**
     * A branch or local build (main, dev, pr-12) has no place in the release order: it is unreleased.
     * What a check stored is compared whether the daily check is on or off: an administrator may ask for one at any time.
     *
     * @return array{
     *     state: 'unknown'|'unreleased'|'current'|'outdated',
     *     latest: ?string,
     *     checkedAt: ?string,
     *     releaseUrl: ?string
     * }
     */
    public function status(): array
    {
        $latest = $this->settings->latestVersion();

        if (! self::isRelease($this->current())) {
            return ['state' => 'unreleased', 'latest' => null, 'checkedAt' => null, 'releaseUrl' => null];
        }

        if ($latest === null) {
            return ['state' => 'unknown', 'latest' => null, 'checkedAt' => null, 'releaseUrl' => null];
        }

        $checkedAt = $this->settings->updateCheckedAt();

        if (! version_compare($this->withoutBuild($latest), $this->withoutBuild($this->current()), '>')) {
            return ['state' => 'current', 'latest' => $latest, 'checkedAt' => $checkedAt, 'releaseUrl' => null];
        }

        return ['state' => 'outdated', 'latest' => $latest, 'checkedAt' => $checkedAt, 'releaseUrl' => $this->releaseUrl($latest)];
    }

    private function releaseUrl(string $version): string
    {
        $repository = rtrim((string) config('skrum.repository_url'), '/');
        $tag = rawurlencode("v{$version}");

        return "{$repository}/releases/tag/{$tag}";
    }

    /**
     * Build metadata (1.2.3+abc) has no precedence in SemVer; version_compare would read it as a pre-release.
     */
    private function withoutBuild(string $version): string
    {
        return Str::before($version, '+');
    }
}
