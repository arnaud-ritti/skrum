<?php

namespace Tests\Feature\Settings;

use App\Http\Controllers\Settings\SecurityController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\Rules\Password;
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

        resolve(GenerateNewRecoveryCodes::class)($user);

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

    public function test_recovery_codes_left_drops_after_one_is_used_to_sign_in(): void
    {
        $user = $this->userWithConfirmedSecondFactor();
        $usedCode = $user->recoveryCodes()[0];

        $this->withSession(['login.id' => $user->id, 'login.remember' => false])
            ->post(route('two-factor.login'), ['recovery_code' => $usedCode])
            ->assertRedirect();

        $this->assertAuthenticatedAs($user);
        expect($user->refresh()->recoveryCodes())->not->toContain($usedCode);

        $this->getSecurityPage($user)->assertInertia(fn (Assert $page) => $page
            ->where('twoFactor.recoveryCodesRemaining', 7)
            ->where('twoFactor.recoveryCodesTotal', 8),
        );
    }

    public function test_a_used_recovery_code_cannot_sign_in_again(): void
    {
        $user = $this->userWithConfirmedSecondFactor();
        $usedCode = $user->recoveryCodes()[0];

        $user->replaceRecoveryCode($usedCode);

        $this->withSession(['login.id' => $user->id, 'login.remember' => false])
            ->post(route('two-factor.login'), ['recovery_code' => $usedCode])
            ->assertSessionHasErrors('recovery_code');

        $this->assertGuest();
    }

    public function test_no_recovery_code_is_left_after_the_last_one_is_used(): void
    {
        $user = $this->userWithConfirmedSecondFactor();

        foreach ($user->recoveryCodes() as $code) {
            $user->replaceRecoveryCode($code);
        }

        $this->getSecurityPage($user->refresh())->assertInertia(fn (Assert $page) => $page
            ->where('twoFactor.recoveryCodesRemaining', 0),
        );
    }

    public function test_recovery_codes_total_matches_what_fortify_generates(): void
    {
        $user = User::factory()->create();

        resolve(GenerateNewRecoveryCodes::class)($user);

        expect($user->refresh()->recoveryCodes())->toHaveCount(SecurityController::RecoveryCodesTotal);
    }

    public function test_props_never_contain_a_recovery_code_or_the_secret(): void
    {
        $user = $this->userWithConfirmedSecondFactor();

        $content = $this->getSecurityPage($user)->getContent();

        foreach ($user->recoveryCodes() as $code) {
            expect($content)->not->toContain($code);
        }

        expect($content)->not->toContain('SECRETKEYSECRETKEY');
    }

    public function test_page_says_when_the_password_rule_checks_known_data_breaches(): void
    {
        $user = User::factory()->create();

        $this->getSecurityPage($user)->assertInertia(fn (Assert $page) => $page
            ->where('checksCompromisedPasswords', false),
        );

        Password::defaults(fn (): Password => Password::min(12)->uncompromised());

        $this->getSecurityPage($user)->assertInertia(fn (Assert $page) => $page
            ->where('checksCompromisedPasswords', true),
        );
    }
}
