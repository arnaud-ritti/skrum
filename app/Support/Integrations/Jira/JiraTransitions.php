<?php

namespace App\Support\Integrations\Jira;

use App\Enums\ExternalIssueState;
use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\StatusPushRejected;
use App\Support\Integrations\Trackers\DoneMapping;

/**
 * Chooses the Jira transition for a status push (spec 8 §5.2): the
 * configured target, else a done-category target preferring "Done",
 * "Closed", "Resolved" (restricted to the project's done statuses), or for
 * a reopen the first `new`, then `indeterminate` target.
 */
class JiraTransitions
{
    private const PreferredDoneNames = ['Done', 'Closed', 'Resolved'];

    private const PreferredResolutions = ['Done', 'Fixed'];

    private const ReopenCategories = ['new', 'indeterminate'];

    /**
     * @param  array<array-key, mixed>  $transitions  as `GET issue/{id}/transitions?expand=transitions.fields` lists them
     * @return array<array-key, mixed>|null
     */
    public static function choose(TeamIntegration $integration, ?string $project, array $transitions, ExternalIssueState $target): ?array
    {
        $available = array_values(array_filter($transitions, fn (mixed $transition): bool => is_array($transition)
            && (is_string($transition['id'] ?? null) || is_int($transition['id'] ?? null))
            && is_array($transition['to'] ?? null)));

        $configured = DoneMapping::configured($integration, $project, $target === ExternalIssueState::Done ? 'completeStatusId' : 'reopenStatusId');

        foreach ($available as $transition) {
            if ($configured !== null && self::targetId($transition) === $configured) {
                return $transition;
            }
        }

        return $target === ExternalIssueState::Done
            ? self::doneTransition($integration, $project, $available)
            : self::reopenTransition($available);
    }

    /**
     * Fields the transition screen requires: `resolution` is filled with
     * "Done", else "Fixed", else the first allowed value; any other
     * required field without a default stops the push.
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

            $resolution = $fieldId === 'resolution' ? self::resolution($field) : null;

            if ($resolution === null) {
                throw new StatusPushRejected($provider, $target === ExternalIssueState::Done
                    ? __('Jira requires more fields to close :key. Close it in Jira.', ['key' => $key])
                    : __('Jira requires more fields to reopen :key. Reopen it in Jira.', ['key' => $key]));
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
     * @return array<array-key, mixed>|null
     */
    private static function reopenTransition(array $available): ?array
    {
        foreach (self::ReopenCategories as $category) {
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
