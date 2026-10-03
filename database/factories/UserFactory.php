<?php

namespace Database\Factories;

use App\Models\User;
use App\Support\Auth\LoginAddress;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
            'password_set_at' => now(),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    /**
     * A row written before addresses were normalised: the spelling is
     * stored as given, past the model, with the key the migration gave it.
     */
    public function storedWithAddress(string $email): static
    {
        return $this->afterCreating(function (User $user) use ($email): void {
            $stored = ['email' => $email, 'email_key' => LoginAddress::normalise($email)];

            DB::table('users')->where('id', $user->id)->update($stored);

            $user->setRawAttributes([...$user->getAttributes(), ...$stored], true);
        });
    }

    public function instanceAdmin(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_instance_admin' => true,
        ]);
    }

    /**
     * Indicate that the model has two-factor authentication configured.
     */
    public function withTwoFactor(): static
    {
        return $this->state(fn (array $attributes) => [
            'two_factor_secret' => encrypt('secret'),
            'two_factor_recovery_codes' => encrypt(json_encode(['recovery-code-1'])),
            'two_factor_confirmed_at' => now(),
        ]);
    }

    public function withEmailSecondFactor(): static
    {
        return $this->state(fn (array $attributes) => [
            'two_factor_email_enabled_at' => now(),
        ]);
    }
}
