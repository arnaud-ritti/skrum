<?php

namespace Database\Factories;

use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AuditEvent>
 */
class AuditEventFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'actor_user_id' => User::factory(),
            'actor_name' => fake()->name(),
            'action' => AuditAction::SettingsUpdated,
            'subject_type' => null,
            'subject_id' => null,
            'properties' => ['section' => 'branding', 'keys' => ['display_name']],
            'ip_address' => fake()->ipv4(),
            'created_at' => now(),
        ];
    }
}
