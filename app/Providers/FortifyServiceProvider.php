<?php

namespace App\Providers;

use App\Actions\Auth\RedirectIfSecondFactorRequired;
use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Actions\Auth\SignupGate;
use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\RefuseDeactivatedAccount;
use App\Actions\Fortify\ResetUserPassword;
use App\Enums\EmailCodePurpose;
use App\Enums\SecondFactorMethod;
use App\Enums\SsoProvider;
use App\Http\Middleware\EnsurePasswordIsText;
use App\Http\Requests\Auth\TwoFactorChallengeRequest;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\Auth\LoginAddress;
use App\Support\Auth\SecondFactors;
use App\Support\Auth\SignInPolicy;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Laravel\Fortify\Actions\AttemptToAuthenticate;
use Laravel\Fortify\Actions\CanonicalizeUsername;
use Laravel\Fortify\Actions\EnsureLoginIsNotThrottled;
use Laravel\Fortify\Actions\PrepareAuthenticatedSession;
use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Contracts\RedirectsIfTwoFactorAuthenticatable;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\Http\Requests\TwoFactorLoginRequest;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureSecondFactor();
        $this->configureActions();
        $this->configureViews();
        $this->configureRateLimiting();
        $this->configurePasswordResetRequests();
    }

    /**
     * Fortify tells an unknown address, and one asked again too soon, from
     * one that was mailed, and puts no limit on the route. Every request
     * gets the answer of a sent link, and an address of origin is limited.
     * Its password confirmation has no limit either, and fails on a password
     * that is not text: an account gets six tries a minute, text only.
     */
    private function configurePasswordResetRequests(): void
    {
        $this->app->bind(
            FailedPasswordResetLinkRequestResponse::class,
            fn (): SuccessfulPasswordResetLinkRequestResponse => $this->app->make(
                SuccessfulPasswordResetLinkRequestResponse::class,
                ['status' => PasswordBroker::RESET_LINK_SENT],
            ),
        );

        $this->app->booted(function (): void {
            $routes = Route::getRoutes();
            $routes->refreshNameLookups();
            $routes->getByName('password.email')?->middleware('throttle:passwordResetLinks');
            $routes->getByName('password.confirm.store')?->middleware(['throttle:passwordConfirmations', EnsurePasswordIsText::class]);
        });
    }

    private function configureSecondFactor(): void
    {
        $this->app->scoped(RedirectsIfTwoFactorAuthenticatable::class, RedirectIfSecondFactorRequired::class);
        $this->app->bind(TwoFactorLoginRequest::class, TwoFactorChallengeRequest::class);
    }

    /**
     * Configure Fortify actions.
     */
    private function configureActions(): void
    {
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::authenticateThrough(fn (): array => $this->loginPipeline());
    }

    /**
     * Fortify's own login pipeline (AuthenticatedSessionController::loginPipeline), with the
     * refusal of a deactivated account before the second-factor redirect.
     *
     * @return array<int, class-string|null>
     */
    private function loginPipeline(): array
    {
        return [
            config('fortify.limiters.login') ? null : EnsureLoginIsNotThrottled::class,
            config('fortify.lowercase_usernames') ? CanonicalizeUsername::class : null,
            RefuseDeactivatedAccount::class,
            Features::enabled(Features::twoFactorAuthentication()) ? RedirectsIfTwoFactorAuthenticatable::class : null,
            AttemptToAuthenticate::class,
            PrepareAuthenticatedSession::class,
        ];
    }

    /**
     * Configure Fortify views.
     */
    private function configureViews(): void
    {
        Fortify::loginView(function (Request $request) {
            $policy = resolve(SignInPolicy::class);
            $local = $policy->allowsLocalCredentials();

            return Inertia::render('auth/login', [
                'canResetPassword' => Features::enabled(Features::resetPasswords()),
                'canRegister' => $local && resolve(SignupGate::class)->canShowRegistration($this->followedInvitation($request)),
                'status' => $request->session()->get('status'),
                'ssoProviders' => SsoProvider::options(),
                'ssoRequired' => $policy->ssoRequired(),
                'canUseMagicLink' => $local && resolve(IntegrationAvailability::class)->emailEnabled(),
            ]);
        });

        Fortify::resetPasswordView(fn (Request $request) => Inertia::render('auth/reset-password', [
            'email' => $request->email,
            'token' => $request->route('token'),
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
        ]));

        Fortify::requestPasswordResetLinkView(fn (Request $request) => Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::verifyEmailView(fn (Request $request) => Inertia::render('auth/verify-email', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::registerView(function (Request $request) {
            abort_unless(resolve(SignInPolicy::class)->allowsLocalCredentials(), 403);

            $invitation = $this->followedInvitation($request);

            abort_unless(resolve(SignupGate::class)->canShowRegistration($invitation), 403);

            return Inertia::render('auth/register', [
                'passwordRules' => Password::defaults()->toPasswordRulesString(),
                'invitationEmail' => $invitation?->isPending() ? $invitation->email : null,
                'ssoProviders' => SsoProvider::options(),
            ]);
        });

        Fortify::twoFactorChallengeView(function (Request $request) {
            $user = User::query()->whereKey($request->session()->get('login.id'))->first();
            $methods = $user === null ? [] : resolve(SecondFactors::class)->methodsFor($user);

            return Inertia::render('auth/two-factor-challenge', [
                'methods' => array_map(fn (SecondFactorMethod $method): string => $method->value, $methods),
                'emailCode' => $user === null || ! in_array(SecondFactorMethod::EmailCode, $methods, true) ? null : [
                    'sentTo' => LoginAddress::mask($user->email),
                    'resendIn' => resolve(SendEmailTwoFactorCode::class)->secondsUntilResend($user, EmailCodePurpose::Login),
                    'available' => resolve(IntegrationAvailability::class)->emailEnabled(),
                ],
                'status' => $request->session()->get('status'),
            ]);
        });

        Fortify::confirmPasswordView(fn () => Inertia::render('auth/confirm-password'));
    }

    private function followedInvitation(Request $request): ?WorkspaceInvitation
    {
        return WorkspaceInvitation::findByToken($request->session()->get('invitation_token'));
    }

    /**
     * Configure rate limiting.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('two-factor', fn (Request $request) => Limit::perMinute(5)->by(
            $request->session()->get('login.id') ?: $request->ip(),
        ));

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(
            LoginAddress::throttleKey((string) $request->input(Fortify::username())).'|'.$request->ip(),
        ));

        RateLimiter::for('magicLinks', fn (Request $request) => Limit::perMinute(10)
            ->by('magic-link-ip:'.$request->ip())
            ->response(fn (): RedirectResponse => back()->withErrors([
                'email' => __('Too many attempts. Wait a minute and try again.'),
            ])));

        RateLimiter::for('passwordResetLinks', fn (Request $request) => Limit::perMinute(10)
            ->by('password-reset-ip:'.$request->ip())
            ->response(fn (): RedirectResponse => back()->withErrors([
                'email' => __('Too many attempts. Wait a minute and try again.'),
            ])));

        RateLimiter::for('passwordConfirmations', fn (Request $request) => Limit::perMinute(6)
            ->by('password-confirmation-user:'.$request->user()?->getAuthIdentifier())
            ->response(fn () => throw ValidationException::withMessages([
                'password' => __('Too many attempts. Wait a minute and try again.'),
            ])));

        RateLimiter::for('invitationAccounts', fn (Request $request) => Limit::perMinute(10)
            ->by('invitation-account-ip:'.$request->ip())
            ->response(fn (): RedirectResponse => back()->withErrors([
                'email' => __('Too many attempts. Wait a minute and try again.'),
            ])));

        RateLimiter::for('invitationDeclines', fn (Request $request) => Limit::perMinute(10)
            ->by('invitation-decline-ip:'.$request->ip()));

        RateLimiter::for('passkeys', fn (Request $request) => Limit::perMinute(10)->by(
            ($request->input('credential.id') ?: $request->session()->getId()).'|'.$request->ip(),
        ));
    }
}
