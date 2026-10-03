<?php

namespace App\Actions\Admin;

use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class RecordAuditEvent
{
    /**
     * @param  array<string, mixed>  $properties  keys and identifiers only, never a secret or a configuration value
     */
    public function handle(AuditAction $action, ?User $actor, ?Model $subject = null, array $properties = [], ?string $ip = null): AuditEvent
    {
        $subjectId = $subject?->getKey();

        return AuditEvent::query()->create([
            'actor_user_id' => $actor?->id,
            'actor_name' => $actor->name ?? '',
            'action' => $action,
            'subject_type' => $subject === null ? null : class_basename($subject),
            'subject_id' => $subjectId === null ? null : (string) $subjectId,
            'properties' => $properties === [] ? null : $properties,
            'ip_address' => $ip ?? request()->ip(),
            'created_at' => now(),
        ]);
    }
}
