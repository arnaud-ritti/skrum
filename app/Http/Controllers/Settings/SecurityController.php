<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\RevokeLoginSecrets;
use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Http\Requests\Settings\TwoFactorAuthenticationRequest;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;

class SecurityController extends Controller
{
    public const RecoveryCodesTotal = 8;

    /**
     * Show the user's security settings page.
     */
    public function edit(TwoFactorAuthenticationRequest $request, IntegrationAvailability $availability, SecondFactors $secondFactors, SendEmailTwoFactorCode $sendCode): Response
    {
        $props = [
            'canManageTwoFactor' => Features::canManageTwoFactorAuthentication(),
            'canManagePasskeys' => Features::canManagePasskeys(),
            'passkeys' => Features::canManagePasskeys()
                ? $request->user()
                    ->passkeys()
                    ->select(['id', 'name', 'credential', 'created_at', 'last_used_at'])
                    ->latest()
                    ->get()
                    ->map(fn ($passkey): array => [
                        'id' => $passkey->id,
                        'name' => $passkey->name,
                        'authenticator' => $passkey->authenticator,
                        'created_at_diff' => $passkey->created_at->diffForHumans(),
                        'last_used_at_diff' => $passkey->last_used_at?->diffForHumans(),
                    ])
                    ->values()
                    ->all()
                : [],
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
            'emailSecondFactor' => [
                'available' => $availability->emailEnabled(),
                'enabled' => $secondFactors->hasEmailCode($request->user()),
                'address' => $request->user()->email,
                'resendIn' => $sendCode->secondsUntilResend($request->user(), EmailCodePurpose::Enable),
            ],
            'checksCompromisedPasswords' => Password::defaults()->appliedRules()['uncompromised'],
        ];

        if (Features::canManageTwoFactorAuthentication()) {
            $request->ensureStateIsValid();

            $props['twoFactorEnabled'] = $request->user()->hasEnabledTwoFactorAuthentication();
            $props['requiresConfirmation'] = Features::optionEnabled(Features::twoFactorAuthentication(), 'confirm');
        }

        $props['twoFactor'] = $this->twoFactorSummary($request->user());

        return Inertia::render('settings/security', $props);
    }

    /**
     * Update the user's password.
     */
    public function update(PasswordUpdateRequest $request, RevokeLoginSecrets $revoke): RedirectResponse
    {
        $request->user()->update([
            'password' => $request->password,
        ]);

        $revoke->handle($request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Password updated.')]);

        return back();
    }

    /**
     * @return array{
     *     confirmedAt: ?string,
     *     recoveryCodesRemaining: ?int,
     *     recoveryCodesTotal: int
     * }
     */
    private function twoFactorSummary(User $user): array
    {
        $confirmedAt = $user->two_factor_confirmed_at;

        return [
            'confirmedAt' => $confirmedAt?->toIso8601String(),
            'recoveryCodesRemaining' => $confirmedAt && $user->two_factor_recovery_codes
                ? count($user->recoveryCodes())
                : null,
            'recoveryCodesTotal' => self::RecoveryCodesTotal,
        ];
    }
}
