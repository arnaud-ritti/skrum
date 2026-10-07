<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Enums\SignupMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GeneralSettingsUpdateRequest;
use App\Support\InstanceSettings;
use App\Support\InstanceVersion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class GeneralSettingsController extends Controller
{
    /** @var array<int, InstanceSettingKey> */
    private const array Keys = [
        InstanceSettingKey::RequireEmailVerification,
        InstanceSettingKey::SignupMode,
        InstanceSettingKey::AllowedEmailDomains,
        InstanceSettingKey::UpdateCheckEnabled,
    ];

    public function edit(InstanceSettings $settings, InstanceVersion $version): Response
    {
        return Inertia::render('admin/general', [
            'requireEmailVerification' => $settings->storedRequireEmailVerification(),
            'signupMode' => $settings->signupMode(),
            'allowedEmailDomains' => $settings->allowedEmailDomains(),
            'defaults' => [
                'requireEmailVerification' => (bool) config('skrum.require_email_verification', true),
                'signupMode' => SignupMode::fromConfig()->value,
                'allowedEmailDomains' => array_values(config('skrum.allowed_email_domains')),
            ],
            'updateCheckEnabled' => $settings->updateCheckEnabled(),
            'version' => $version->current(),
            'versionStatus' => $version->status(),
            'image' => (string) config('skrum.image'),
        ]);
    }

    public function update(GeneralSettingsUpdateRequest $request, InstanceSettings $settings, RecordAuditEvent $recordAuditEvent): RedirectResponse
    {
        $values = $request->safe()->only([
            InstanceSettingKey::RequireEmailVerification->value,
            InstanceSettingKey::SignupMode->value,
            InstanceSettingKey::AllowedEmailDomains->value,
            InstanceSettingKey::UpdateCheckEnabled->value,
        ]);

        $updateCheckTurnedOn = DB::transaction(function () use ($request, $settings, $recordAuditEvent, $values): bool {
            $before = $this->current($settings);

            $settings->setMany($values);

            $after = $this->current($settings);
            $changed = array_keys(array_filter($after, fn (mixed $value, string $key): bool => $value !== $before[$key], ARRAY_FILTER_USE_BOTH));

            if ($changed !== []) {
                $recordAuditEvent->handle(AuditAction::SettingsUpdated, $request->user(), null, ['section' => 'general', 'keys' => $changed]);
            }

            return ! $before[InstanceSettingKey::UpdateCheckEnabled->value] && $after[InstanceSettingKey::UpdateCheckEnabled->value];
        });

        if ($updateCheckTurnedOn) {
            Artisan::queue('skrum:check-for-update');
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('General settings saved.')]);

        return to_route('admin.general.edit');
    }

    /** @return array<string, mixed> */
    private function current(InstanceSettings $settings): array
    {
        $all = $settings->all();

        return collect(self::Keys)
            ->mapWithKeys(fn (InstanceSettingKey $key): array => [$key->value => $all[$key->value]])
            ->all();
    }
}
