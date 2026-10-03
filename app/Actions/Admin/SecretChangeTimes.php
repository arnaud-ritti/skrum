<?php

namespace App\Actions\Admin;

use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Models\AuditEvent;
use Carbon\CarbonInterface;

class SecretChangeTimes
{
    /**
     * The JSON of the events is filtered in PHP over this bounded set, newest first: no JSON path
     * query, which not every engine supports alike (docs/database.md).
     */
    public const int Scanned = 500;

    public function handle(InstanceSettingKey $section, string $field): ?CarbonInterface
    {
        return $this->handleMany([$section], $field)[$section->value];
    }

    /**
     * The latest change of the field in each section, from one read of the audit log.
     *
     * @param  array<int, InstanceSettingKey>  $sections
     * @return array<string, ?CarbonInterface>
     */
    public function handleMany(array $sections, string $field): array
    {
        if ($sections === []) {
            return [];
        }

        $events = AuditEvent::query()
            ->where('action', AuditAction::ConfigurationUpdated)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::Scanned)
            ->get(['id', 'properties', 'created_at']);

        $times = [];

        foreach ($sections as $section) {
            $times[$section->value] = $events
                ->first(fn (AuditEvent $event): bool => $this->changes($event, $section, $field))
                ?->created_at;
        }

        return $times;
    }

    private function changes(AuditEvent $event, InstanceSettingKey $section, string $field): bool
    {
        $properties = $event->properties ?? [];

        if (($properties['section'] ?? null) !== $section->value) {
            return false;
        }

        return in_array($field, $properties['changed'] ?? [], true);
    }
}
