<?php

namespace App\Support\Integrations\Jira;

use App\Enums\ExternalIssueState;
use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\StatusPushRejected;
use App\Models\TeamIntegration;
use App\Support\Integrations\Trackers\DoneMapping;

/**
 * Chooses the Jira transition for a status push (spec 8 §5.2): the
 * configured target, else a done-category target preferring "Done",
 * "Closed", "Resolved" (restricted to the project's done statuses), for a
 * start the configured start status, else the first `indeterminate` target,
 * for a reopen out of Done the first `new`, then `indeterminate` target, and
 * for a stop out of an in-progress status only a `new` target: another
 * in-progress status would leave the issue started and undo the stop.
 */
class JiraTransitions
{
    private const array PreferredDoneNames = ['Done', 'Closed', 'Resolved'];

    private const array PreferredResolutions = ['Done', 'Fixed'];

    private const array ReopenCategories = ['new', 'indeterminate'];

    private const array StopCategories = ['new'];

    private const array StartCategories = ['indeterminate'];

    private const array ConfiguredTargets = [
        'open' => 'reopenStatusId',
        'started' => 'startStatusId',
        'done' => 'completeStatusId',
    ];

    /**
     * @param  array<array-key, mixed>  $transitions  as `GET issue/{id}/transitions?expand=transitions.fields` lists them
     * @return array<array-key, mixed>|null
     */
    public static function choose(TeamIntegration $integration, ?string $project, array $transitions, ExternalIssueState $target, ExternalIssueState $current): ?array
    {
        $available = array_values(array_filter($transitions, fn (mixed $transition): bool => is_array($transition)
            && (is_string($transition['id'] ?? null) || is_int($transition['id'] ?? null))
            && is_array($transition['to'] ?? null)));

        $configured = DoneMapping::configured($integration, $project, self::ConfiguredTargets[$target->value]);

        foreach ($available as $transition) {
            if ($configured !== null && self::targetId($transition) === $configured) {
                return $transition;
            }
        }

        return match ($target) {
            ExternalIssueState::Done => self::doneTransition($integration, $project, $available),
            ExternalIssueState::Started => self::firstOfCategories($available, self::StartCategories),
            ExternalIssueState::Open => self::firstOfCategories(
                $available,
                $current === ExternalIssueState::Started ? self::StopCategories : self::ReopenCategories,
            ),
        };
    }

    /**
     * Fields the transition screen requires: when closing, `resolution` is
     * filled with "Done", else "Fixed", else the first allowed value; any
     * other required field without a default, or a resolution required to
     * reopen, stops the push.
     *
     * @param  array<array-key, mixed>  $transition
     * @return array<string, mixed>
     */
    public static function requiredFields(IntegrationProvider $provider, array $transition, string $key, ExternalIssueState $target): array
    {
        $fields = [];

        foreach ((array) ($transition['fields'] ?? []) as $fieldId => $field) {
            if (! is_array($field) || ($field['required'] ?? false) !== true || ($field['hasDefaultValue'] ?? false) === true) {
                continue;
            }

            $resolution = $fieldId === 'resolution' && $target === ExternalIssueState::Done ? self::resolution($field) : null;

            if ($resolution === null) {
                throw new StatusPushRejected($provider, match ($target) {
                    ExternalIssueState::Done => __('Jira requires more fields to close :key. Close it in Jira.', ['key' => $key]),
                    ExternalIssueState::Started => __('Jira requires more fields to start :key. Start it in Jira.', ['key' => $key]),
                    ExternalIssueState::Open => __('Jira requires more fields to reopen :key. Reopen it in Jira.', ['key' => $key]),
                });
            }

            $fields['resolution'] = ['name' => $resolution];
        }

        return $fields;
    }

    /**
     * @param  array<int, array<array-key, mixed>>  $available
     * @return array<array-key, mixed>|null
     */
    private static function doneTransition(TeamIntegration $integration, ?string $project, array $available): ?array
    {
        $doneIds = DoneMapping::doneStatusIds($integration, $project);
        $candidates = array_values(array_filter($available, fn (array $transition): bool => self::category($transition) === 'done'
            && ($doneIds === null || in_array(self::targetId($transition), $doneIds, true))));

        foreach (self::PreferredDoneNames as $name) {
            foreach ($candidates as $transition) {
                if (data_get($transition, 'to.name') === $name) {
                    return $transition;
                }
            }
        }

        return $candidates[0] ?? null;
    }

    /**
     * @param  array<int, array<array-key, mixed>>  $available
     * @param  array<int, string>  $categories
     * @return array<array-key, mixed>|null
     */
    private static function firstOfCategories(array $available, array $categories): ?array
    {
        foreach ($categories as $category) {
            foreach ($available as $transition) {
                if (self::category($transition) === $category) {
                    return $transition;
                }
            }
        }

        return null;
    }

    /**
     * @param  array<array-key, mixed>  $field
     */
    private static function resolution(array $field): ?string
    {
        $names = collect((array) ($field['allowedValues'] ?? []))
            ->map(fn (mixed $value): mixed => data_get($value, 'name'))
            ->filter(fn (mixed $name): bool => is_string($name) && $name !== '')
            ->values();

        foreach (self::PreferredResolutions as $preferred) {
            if ($names->contains($preferred)) {
                return $preferred;
            }
        }

        $first = $names->first();

        return is_string($first) ? $first : null;
    }

    /**
     * @param  array<array-key, mixed>  $transition
     */
    private static function targetId(array $transition): string
    {
        $id = data_get($transition, 'to.id');

        return is_string($id) || is_int($id) ? (string) $id : '';
    }

    /**
     * @param  array<array-key, mixed>  $transition
     */
    private static function category(array $transition): ?string
    {
        $key = data_get($transition, 'to.statusCategory.key');

        return is_string($key) ? $key : null;
    }
}
