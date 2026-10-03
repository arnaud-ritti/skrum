<?php

namespace Database\Factories;

use App\Enums\JoinableSessionKind;
use App\Models\Retro;
use App\Models\SessionJoinCode;
use App\Support\Sessions\JoinCode;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SessionJoinCode>
 */
class SessionJoinCodeFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => JoinCode::generate(),
            'session_kind' => JoinableSessionKind::Retro,
            'session_id' => Retro::factory(),
        ];
    }
}
