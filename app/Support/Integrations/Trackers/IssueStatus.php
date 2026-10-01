<?php

namespace App\Support\Integrations\Trackers;

use Carbon\CarbonImmutable;
use Carbon\Exceptions\InvalidFormatException;

/**
 * Where an issue stands in its source workflow (spec 8 §5.2): the status
 * id and name, the provider's own category (`kind`: Jira status category
 * key, Linear state type, GitHub open/completed/not_planned) and the Jira
 * project or Linear team key whose mapping applies.
 */
class IssueStatus
{
    public const GitHubOpen = 'open';

    public const GitHubCompleted = 'completed';

    public const GitHubNotPlanned = 'not_planned';

    /**
     * Jira project keys and Linear team keys, the containers a status
     * mapping is keyed by.
     */
    public const ContainerKeyPattern = '/^[A-Z][A-Z0-9_]{0,49}\z/';

    public function __construct(
        public string $id,
        public ?string $name,
        public string $kind,
        public ?string $container,
        public ?CarbonImmutable $updatedAt,
    ) {}

    public static function time(mixed $value): ?CarbonImmutable
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value)->utc();
        } catch (InvalidFormatException) {
            return null;
        }
    }
}
