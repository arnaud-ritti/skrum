<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Enums\SignupMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\GeneralSettingsUpdateRequest;
use App\Jobs\CheckForUpdate;
use App\Models\InstanceSetting;
use App\Models\User;
use App\Support\InstanceSettings;
use App\Support\InstanceVersion;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class GeneralSettingsController extends Controller
{
    /** @var array<int, InstanceSettingKey> */
    private const array Keys = [
        InstanceSettingKey::SignupMode,
        InstanceSettingKey::AllowedEmailDomains,
        InstanceSettingKey::MaintenanceMessage,
        InstanceSettingKey::MaintenanceMessageBy,
        InstanceSettingKey::UpdateCheckEnabled,
    ];

    public function edit(InstanceSettings $settings, InstanceVersion $version): Response
    {
        return Inertia::render('admin/general', [
            'signupMode' => $settings->signupMode(),
            'allowedEmailDomains' => $settings->allowedEmailDomains(),
            'defaults' => [
                'signupMode' => SignupMode::fromConfig()->value,
                'allowedEmailDomains' => array_values(config('skrum.allowed_email_domains')),
            ],
            'maintenanceMessage' => $settings->maintenanceMessage(),
            'maintenanceMessageBy' => $this->maintenanceMessageAuthor($settings),
            'maintenanceMessageAt' => $this->maintenanceMessageSavedAt($settings),
            'updateCheckEnabled' => $settings->updateCheckEnabled(),
            'version' => $version->current(),
            'versionStatus' => $version->status(),
        ]);
    }

    public function update(GeneralSettingsUpdateRequest $request, InstanceSettings $settings, RecordAuditEvent $recordAuditEvent): RedirectResponse
    {
        $values = $this->submittedValues($request);

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
            CheckForUpdate::dispatch();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('General settings saved.')]);

        return to_route('admin.general.edit');
    }

    /** @return array<string, mixed> */
    private function submittedValues(GeneralSettingsUpdateRequest $request): array
    {
        $values = $request->safe()->only([
            InstanceSettingKey::SignupMode->value,
            InstanceSettingKey::AllowedEmailDomains->value,
            InstanceSettingKey::UpdateCheckEnabled->value,
        ]);

        if (! $request->has(InstanceSettingKey::MaintenanceMessage->value)) {
            return $values;
        }

        $message = $request->validated(InstanceSettingKey::MaintenanceMessage->value);
        $hasMessage = is_string($message) && trim($message) !== '';

        return [
            ...$values,
            InstanceSettingKey::MaintenanceMessage->value => $hasMessage ? $message : null,
            InstanceSettingKey::MaintenanceMessageBy->value => $hasMessage ? $request->user()->id : null,
        ];
    }

    /** @return array<string, mixed> */
    private function current(InstanceSettings $settings): array
    {
        $all = $settings->all();

        return collect(self::Keys)
            ->mapWithKeys(fn (InstanceSettingKey $key): array => [$key->value => $all[$key->value]])
            ->all();
    }

    /** @return ?array{name: string} */
    private function maintenanceMessageAuthor(InstanceSettings $settings): ?array
    {
        $authorId = $settings->maintenanceMessageBy();

        if ($authorId === null) {
            return null;
        }

        $author = User::query()->find($authorId);

        if ($author === null) {
            return null;
        }

        return ['name' => $author->name];
    }

    private function maintenanceMessageSavedAt(InstanceSettings $settings): ?string
    {
        if ($settings->maintenanceMessage() === null) {
            return null;
        }

        $savedAt = InstanceSetting::query()
            ->where('key', InstanceSettingKey::MaintenanceMessage->value)
            ->value('updated_at');

        if ($savedAt === null) {
            return null;
        }

        return Carbon::parse($savedAt)->toIso8601String();
    }
}
