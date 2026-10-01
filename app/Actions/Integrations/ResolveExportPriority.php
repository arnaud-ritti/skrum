<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraCreateFields;
use App\Support\Integrations\Linear\LinearPriority;
use Illuminate\Support\Str;

/**
 * Spec §7.2: `settings.priorityMap.{level}` is a Jira `{id, name}`, `null`
 * ("Don't set") or a Linear value; a missing key is the default mapping.
 */
class ResolveExportPriority
{
    public const JiraDefaultNames = ['high' => 'High', 'medium' => 'Medium', 'low' => 'Low'];

    public function handle(ActionItem $item, TeamIntegration $integration, ?JiraCreateFields $fields = null): ExportPriority
    {
        $level = $item->priority->value;
        $map = (array) $integration->setting('priorityMap', []);

        if ($integration->provider === IntegrationProvider::Linear) {
            $value = is_int($map[$level] ?? null) ? $map[$level] : LinearPriority::Defaults[$level];

            return new ExportPriority($value, null, LinearPriority::label($value));
        }

        $overridden = array_key_exists($level, $map);
        $override = $map[$level] ?? null;

        if ($overridden && $override === null) {
            return new ExportPriority(null);
        }

        $name = is_array($override) ? (string) ($override['name'] ?? '') : self::JiraDefaultNames[$level];

        if ($fields === null || ! $fields->hasPriority) {
            return new ExportPriority(null, ExportWarningCode::PriorityUnavailable, $name);
        }

        foreach ($fields->priorities as $allowed) {
            $matches = is_array($override)
                ? $allowed['id'] === ($override['id'] ?? null)
                : Str::lower($allowed['name']) === Str::lower($name);

            if ($matches) {
                return new ExportPriority($allowed['id'], null, $allowed['name']);
            }
        }

        return new ExportPriority(null, ExportWarningCode::PriorityUnavailable, $name);
    }

    /**
     * Spec 8 §4.2: GitHub priorities are labels an admin names per level;
     * none configured means no label.
     */
    public function gitHubLabel(ActionItem $item, TeamIntegration $integration): ?string
    {
        $label = data_get($integration->settings, 'priorityLabels.'.$item->priority->value);

        return is_string($label) && trim($label) !== '' ? trim($label) : null;
    }

    /**
     * What the export dialog shows, from stored data only; null means
     * "the provider's default".
     */
    public function preview(ActionItem $item, TeamIntegration $integration): ?string
    {
        if ($integration->provider === IntegrationProvider::GitHub) {
            return $this->gitHubLabel($item, $integration);
        }

        $level = $item->priority->value;
        $map = (array) $integration->setting('priorityMap', []);

        if ($integration->provider === IntegrationProvider::Linear) {
            return LinearPriority::label(is_int($map[$level] ?? null) ? $map[$level] : LinearPriority::Defaults[$level]);
        }

        if (! array_key_exists($level, $map)) {
            return self::JiraDefaultNames[$level];
        }

        $override = $map[$level];

        return is_array($override) ? (string) ($override['name'] ?? '') : null;
    }
}
