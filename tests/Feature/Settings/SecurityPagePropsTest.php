<?php

namespace Tests\Feature\Settings;

use App\Http\Controllers\Settings\SecurityController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Actions\GenerateNewRecoveryCodes;
use Laravel\Fortify\Features;
use Tests\TestCase;

class SecurityPagePropsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

        Features::twoFactorAuthentication([
            'confirm' => true,
            'confirmPassword' => true,
        ]);
    }

    private function userWithConfirmedSecondFactor(): User
    {
        $user = User::factory()->create();

        app(GenerateNewRecoveryCodes::class)($user);

        $user->forceFill([
            'two_factor_secret' => encrypt('SECRETKEYSECRETKEY'),
            'two_factor_confirmed_at' => now()->startOfSecond(),
        ])->save();

        return $user->refresh();
    }

    private function getSecurityPage(User $user)
    {
        return $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->get(route('security.edit'));
    }

    public function test_user_without_second_factor_has_no_date_and_no_codes_left(): void
    {
        $user = User::factory()->create();

        $this->getSecurityPage($user)->assertInertia(fn (Assert $page) => $page
            ->where('twoFactor.confirmedAt', null)
            ->where('twoFactor.recoveryCodesRemaining', null)
            ->where('twoFactor.recoveryCodesTotal', SecurityController::RecoveryCodesTotal),
        );
    }

    public function test_user_with_confirmed_second_factor_gets_date_and_all_codes(): void
    {
        $user = $this->userWithConfirmedSecondFactor();

        $this->getSecurityPage($user)->assertInertia(fn (Assert $page) => $page
            ->where('twoFactor.confirmedAt', $user->two_factor_confirmed_at->toIso8601String())
            ->where('twoFactor.recoveryCodesRemaining', 8)
            ->where('twoFactor.recoveryCodesTotal', 8),
        );
    }

    public function test_recovery_codes_left_drops_after_one_is_used(): void
    {
        $user = $this->userWithConfirmedSecondFactor();

        $remainingCodes = array_slice($user->recoveryCodes(), 1);

        $user->forceFill([
            'two_factor_recovery_codes' => encrypt(json_encode($remainingCodes)),
        ])->save();

        $this->getSecurityPage($user->refresh())->assertInertia(fn (Assert $page) => $page
            ->where('twoFactor.recoveryCodesRemaining', 7),
        );
    }

    public function test_recovery_codes_total_matches_what_fortify_generates(): void
    {
        $user = User::factory()->create();

        app(GenerateNewRecoveryCodes::class)($user);

        $this->assertCount(SecurityController::RecoveryCodesTotal, $user->refresh()->recoveryCodes());
    }

    public function test_props_never_contain_a_recovery_code_or_the_secret(): void
    {
        $user = $this->userWithConfirmedSecondFactor();

        $content = $this->getSecurityPage($user)->getContent();

        foreach ($user->recoveryCodes() as $code) {
            $this->assertStringNotContainsString($code, $content);
        }

        $this->assertStringNotContainsString('SECRETKEYSECRETKEY', $content);
    }
}
