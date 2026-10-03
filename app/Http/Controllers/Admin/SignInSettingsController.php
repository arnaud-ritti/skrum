<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\PresentSsoProviders;
use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Enums\SsoProvider;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SignInSettingsUpdateRequest;
use App\Models\MagicLink;
use App\Models\User;
use App\Support\Auth\PasswordConfirmation;
use App\Support\Auth\SecondFactors;
use App\Support\Auth\SignInPolicy;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use App\Support\InstanceSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SignInSettingsController extends Controller
{
    public function edit(Request $request, SignInPolicy $policy, InstanceSettings $settings, SecondFactors $secondFactors, PresentSsoProviders $presentSsoProviders, PasswordConfirmation $confirmation): Response
    {
        $confirmedUntil = $this->confirmedUntil($request, $confirmation);

        if ($confirmedUntil === null) {
            redirect()->setIntendedUrl(route('admin.signIn.edit'));
        }

        return Inertia::render('admin/sign-in', [
            'ssoRequired' => $settings->ssoRequired(),
            'inForce' => $policy->ssoRequired(),
            'providers' => SsoProvider::options(),
            'blockers' => $policy->enablingBlockers($request->user()),
            'accountsWithoutSso' => User::query()->whereDoesntHave('socialAccounts')->count(),
            'adminsWithPasswordWayBack' => User::query()->where('is_instance_admin', true)->get()
                ->filter(fn (User $admin): bool => $secondFactors->requiredFor($admin))
                ->count(),
            'providerDetails' => $presentSsoProviders->handle(),
            'lastTest' => $settings->ssoLastTest(),
            'confirmedUntil' => $confirmedUntil,
            'confirmUrl' => route('password.confirm'),
        ]);
    }

    /** When the confirmation the configuration writes ask for (rule S2) runs out, null once it has. */
    private function confirmedUntil(Request $request, PasswordConfirmation $confirmation): ?string
    {
        if (! $confirmation->isFresh($request, InstanceConfiguration::ConfirmationSeconds)) {
            return null;
        }

        $confirmedAt = (int) $request->session()->get('auth.password_confirmed_at', 0);

        return Date::createFromTimestamp($confirmedAt + InstanceConfiguration::ConfirmationSeconds)->toIso8601String();
    }

    public function update(SignInSettingsUpdateRequest $request, InstanceSettings $settings, RecordAuditEvent $recordAuditEvent): RedirectResponse
    {
        $required = $request->boolean('sso_required');

        DB::transaction(function () use ($request, $settings, $recordAuditEvent, $required): void {
            $wasRequired = $settings->ssoRequired();

            $settings->set('sso_required', $required);

            if ($required) {
                MagicLink::query()->delete();
            }

            if ($wasRequired === $required) {
                return;
            }

            $recordAuditEvent->handle(AuditAction::SsoRequiredChanged, $request->user(), null, ['value' => $required]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sign-in settings saved.')]);

        return to_route('admin.signIn.edit');
    }
}
