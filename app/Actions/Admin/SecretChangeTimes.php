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
        $event = AuditEvent::query()
            ->where('action', AuditAction::ConfigurationUpdated)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(self::Scanned)
            ->get(['id', 'properties', 'created_at'])
            ->first(fn (AuditEvent $event): bool => $this->changes($event, $section, $field));

        return $event?->created_at;
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
