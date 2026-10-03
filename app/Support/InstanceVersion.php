<?php

namespace App\Support;

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
     * A branch or local build (main, dev, pr-12) has no place in the release order, so it stays unknown.
     *
     * @return array{
     *     state: 'unknown'|'current'|'outdated',
     *     latest: ?string,
     *     checkedAt: ?string
     * }
     */
    public function status(): array
    {
        $latest = $this->settings->latestVersion();

        if (! $this->settings->updateCheckEnabled()) {
            return ['state' => 'unknown', 'latest' => null, 'checkedAt' => null];
        }

        if ($latest === null) {
            return ['state' => 'unknown', 'latest' => null, 'checkedAt' => null];
        }

        if (! self::isRelease($this->current())) {
            return ['state' => 'unknown', 'latest' => null, 'checkedAt' => null];
        }

        $state = version_compare($latest, $this->current(), '>') ? 'outdated' : 'current';

        return ['state' => $state, 'latest' => $latest, 'checkedAt' => $this->settings->updateCheckedAt()];
    }
}
