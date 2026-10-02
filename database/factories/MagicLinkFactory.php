<?php

namespace Database\Factories;

use App\Models\MagicLink;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MagicLink>
 */
class MagicLinkFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'token_hash' => MagicLink::hashToken(Str::random(64)),
            'expires_at' => now()->addMinutes(MagicLink::LifetimeMinutes),
            'consumed_at' => null,
        ];
    }
}
