<?php

namespace Database\Factories;

use App\Enums\EmailCodePurpose;
use App\Models\EmailTwoFactorCode;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EmailTwoFactorCode>
 */
class EmailTwoFactorCodeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'purpose' => EmailCodePurpose::Login,
            'code_hash' => str_repeat('0', 64),
            'attempts' => 0,
            'sent_at' => now(),
            'expires_at' => now()->addMinutes(EmailTwoFactorCode::LifetimeMinutes),
            'consumed_at' => null,
        ];
    }
}
