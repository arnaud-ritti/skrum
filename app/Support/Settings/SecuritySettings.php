<?php

namespace App\Support\Settings;

use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use App\Support\Auth\SignInPolicy;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Features;

/**
 * The security section of the account settings, in two parts: what the
 * instance offers, which anyone signed in may read, and the state of the
 * account, which is read only behind a confirmed password.
 */
class SecuritySettings
{
    public const int RecoveryCodesTotal = 8;

    public function __construct(
        private IntegrationAvailability $availability,
        private SecondFactors $secondFactors,
        private SendEmailTwoFactorCode $sendCode,
        private SignInPolicy $policy,
        private BrowserSessions $sessions,
        private LinkedAccounts $linkedAccounts,
    ) {}

    /**
     * Read from the configuration of the instance alone: nothing here may
     * depend on the state of the account.
     *
     * @return array{
     *     passwordRules: string,
     *     checksCompromisedPasswords: bool,
     *     liveBreachCheck: bool,
     *     canManageTwoFactor: bool,
     *     canManagePasskeys: bool,
     *     canManageEmailCode: bool,
     *     requiresConfirmation: bool
     * }
     */
    public function offered(): array
    {
        $canManageTwoFactor = Features::canManageTwoFactorAuthentication();

        return [
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
            'checksCompromisedPasswords' => Password::defaults()->appliedRules()['uncompromised'],
            'liveBreachCheck' => Password::defaults()->appliedRules()['uncompromised'],
            'canManageTwoFactor' => $canManageTwoFactor,
            'canManagePasskeys' => Features::canManagePasskeys(),
            'canManageEmailCode' => $this->availability->emailEnabled(),
            'requiresConfirmation' => $canManageTwoFactor && Features::optionEnabled(Features::twoFactorAuthentication(), 'confirm'),
        ];
    }

    /**
     * @return array{
     *     twoFactorEnabled: bool,
     *     twoFactor: array{
     *         confirmedAt: ?string,
     *         recoveryCodesRemaining: ?int,
     *         recoveryCodesTotal: int
     *     },
     *     passkeys: array<int, array{
     *         id: int|string,
     *         name: string,
     *         authenticator: ?string,
     *         created_at_diff: string,
     *         last_used_at_diff: ?string
     *     }>,
     *     emailSecondFactor: array{
     *         available: bool,
     *         enabled: bool,
     *         address: string,
     *         resendIn: int
     *     },
     *     password: array{
     *         isSet: bool,
     *         allowed: bool
     *     },
     *     browserSessions: array<int, array{
     *         key: string,
     *         device: string,
     *         deviceKind: string,
     *         ipAddress: ?string,
     *         isCurrent: bool,
     *         lastActiveAt: string
     *     }>|null,
     *     linkedAccounts: array{
     *         rows: array<int, array{
     *             provider: string,
     *             label: string,
     *             isEnabled: bool,
     *             account: ?array{
     *                 id: string,
     *                 linkedAt: ?string,
     *                 isManaged: bool,
     *                 canUnlink: bool
     *             }
     *         }>,
     *         lastWayIn: bool
     *     }
     * }
     */
    public function protected(User $user, string $currentSessionId): array
    {
        return [
            'twoFactorEnabled' => Features::canManageTwoFactorAuthentication() && $user->hasEnabledTwoFactorAuthentication(),
            'twoFactor' => $this->twoFactorSummary($user),
            'passkeys' => Features::canManagePasskeys() ? $this->passkeys($user) : [],
            'emailSecondFactor' => [
                'available' => $this->availability->emailEnabled(),
                'enabled' => $this->secondFactors->hasEmailCode($user),
                'address' => $user->email,
                'resendIn' => $this->sendCode->secondsUntilResend($user, EmailCodePurpose::Enable),
            ],
            'password' => [
                'isSet' => $user->password_set_at !== null,
                'allowed' => $this->policy->allowsPassword($user),
            ],
            'browserSessions' => $this->sessions->available() ? $this->sessions->of($user, $currentSessionId) : null,
            'linkedAccounts' => $this->linkedAccounts->of($user),
        ];
    }

    /**
     * @return array<int, array{
     *     id: int|string,
     *     name: string,
     *     authenticator: ?string,
     *     created_at_diff: string,
     *     last_used_at_diff: ?string
     * }>
     */
    private function passkeys(User $user): array
    {
        return $user
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
            ->all();
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
