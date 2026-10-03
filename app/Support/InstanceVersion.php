<?php

namespace App\Support;

class InstanceVersion
{
    public function __construct(private InstanceSettings $settings) {}

    public function current(): string
    {
        return ltrim(trim((string) config('skrum.version')), 'vV');
    }

    /**
     * @return array{
     *     state: 'unknown'|'current'|'outdated',
     *     latest: ?string,
     *     checkedAt: ?string
     * }
     */
    public function status(): array
    {
        $latest = $this->settings->latestVersion();

        if (! $this->settings->updateCheckEnabled() || $latest === null) {
            return ['state' => 'unknown', 'latest' => null, 'checkedAt' => null];
        }

        $state = version_compare($latest, $this->current(), '>') ? 'outdated' : 'current';

        return ['state' => $state, 'latest' => $latest, 'checkedAt' => $this->settings->updateCheckedAt()];
    }
}
