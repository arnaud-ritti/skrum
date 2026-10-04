<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\TwoFactorAuthenticationRequest;
use App\Models\User;
use App\Support\Auth\PasswordConfirmation;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\Avatars\AvatarUrl;
use App\Support\InstanceSettings;
use App\Support\Settings\ApiTokenSettings;
use App\Support\Settings\SecuritySettings;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;

class AccountSettingsController extends Controller
{
    public function __construct(
        private InstanceSettings $settings,
        private AvatarStyleCatalogue $catalogue,
        private AvatarUrl $avatarUrl,
        private SecuritySettings $security,
        private ApiTokenSettings $apiTokens,
        private PasswordConfirmation $passwordConfirmation,
    ) {}

    /**
     * Every section of the account on one page. An account whose address is
     * not verified gets its profile only, and what the security and API
     * token sections say about the account is sent only while the password
     * confirmation of the session is still accepted. The page asks for that
     * confirmation at each protected action, then reloads these props.
     */
    public function edit(TwoFactorAuthenticationRequest $request): Response
    {
        $user = $request->user();
        $verified = ! $user instanceof MustVerifyEmail || $user->hasVerifiedEmail();
        $passwordConfirmed = $verified && $this->passwordConfirmation->isSatisfied($request);

        if ($passwordConfirmed && Features::canManageTwoFactorAuthentication() && ! $this->staysOnThePage($request)) {
            $request->ensureStateIsValid();
        }

        return Inertia::render('settings/account', [
            'profile' => $this->profile($request, $user),
            'security' => $verified ? $this->securitySection($user, $passwordConfirmed, $request->session()->getId()) : null,
            'appearance' => $verified ? ['reduceMotion' => $user->reduce_motion] : false,
            'notificationPreferences' => $verified ? $this->notificationPreferences($user) : null,
            'apiTokens' => $verified && config('skrum.mcp.enabled') ? $this->apiTokensSection($user, $passwordConfirmed) : null,
        ]);
    }

    /**
     * A visit Inertia makes from the page itself, the return of a form of
     * another section or a reload of some props, is not a new opening of
     * the page: an authenticator setup that waits for its code survives it.
     */
    private function staysOnThePage(TwoFactorAuthenticationRequest $request): bool
    {
        if (! $request->inertia()) {
            return false;
        }

        $comesFrom = $request->headers->get('referer');

        return is_string($comesFrom) && Str::before($comesFrom, '?') === $request->url();
    }

    /**
     * @return array<string, mixed>
     */
    private function profile(TwoFactorAuthenticationRequest $request, User $user): array
    {
        $allowsMemberStyles = $this->settings->avatarMemberChoice();
        $photosAllowed = $this->settings->profilePhotos();

        return [
            'mustVerifyEmail' => Features::enabled(Features::emailVerification()),
            'status' => $request->session()->get('status'),
            'avatarMemberChoice' => $allowsMemberStyles,
            'avatarStyle' => $allowsMemberStyles ? $user->avatar_style : null,
            'instanceAvatarStyle' => $this->avatarUrl->instanceStyle(),
            'avatarStyles' => $allowsMemberStyles ? $this->avatarStyles($user) : [],
            'presenceColor' => $user->presenceColor(),
            'hasPhoto' => $photosAllowed && $user->avatar_photo_path !== null,
            'photosAllowed' => $photosAllowed,
            'needsPasswordConfirmation' => ! $this->passwordConfirmation->isNotNeeded($user),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function securitySection(User $user, bool $passwordConfirmed, string $currentSessionId): array
    {
        return [
            ...$this->security->offered(),
            'locked' => ! $passwordConfirmed,
            'protected' => $passwordConfirmed ? $this->security->protected($user, $currentSessionId) : null,
        ];
    }

    /**
     * @return array{
     *     preferences: array<string, bool>,
     *     reminderTime: string,
     *     reminderTimezone: string,
     *     remindersEnabled: bool
     * }
     */
    private function notificationPreferences(User $user): array
    {
        return [
            'preferences' => [
                'action_item_reminders_by_email' => $user->action_item_reminders_by_email,
                'action_item_reminders_in_app' => $user->action_item_reminders_in_app,
                'recap_emails' => $user->recap_emails,
                'recap_in_app' => $user->recap_in_app,
            ],
            'reminderTime' => (string) config('skrum.action_item_reminders.time'),
            'reminderTimezone' => (string) config('app.timezone'),
            'remindersEnabled' => (bool) config('skrum.action_item_reminders.enabled'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function apiTokensSection(User $user, bool $passwordConfirmed): array
    {
        return [
            ...$this->apiTokens->offered(),
            'locked' => ! $passwordConfirmed,
            'protected' => $passwordConfirmed ? $this->apiTokens->protected($user) : null,
        ];
    }

    /**
     * @return array<int, array{
     *     value: string,
     *     name: string,
     *     license: string,
     *     attribution: ?string,
     *     attributionRequired: bool,
     *     sampleUrls: array<int, string>
     * }>
     */
    private function avatarStyles(User $user): array
    {
        return array_map(fn (array $style): array => [
            ...$style,
            'sampleUrls' => [$this->avatarUrl->url($style['value'], $user->avatarSeed(), fn (): string => $user->name)],
        ], $this->catalogue->styles());
    }
}
