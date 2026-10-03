<?php

namespace App\Actions\Admin;

use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Enums\SsoProvider;
use App\Mail\InstanceConfigurationChangedMail;
use App\Models\AuditEvent;
use App\Models\User;
use App\Support\InstanceConfiguration\ConfigurationCatalogue;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use App\Support\InstanceSettings;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use SensitiveParameter;
use Throwable;

class UpdateInstanceConfiguration
{
    private const int LockSeconds = 10;

    private const int LockWaitSeconds = 5;

    public function __construct(
        private InstanceConfiguration $configuration,
        private ConfigurationCatalogue $catalogue,
        private InstanceSettings $settings,
        private RecordAuditEvent $recordAuditEvent,
    ) {}

    /**
     * The only writer of a configuration section (spec §5.1): S3 audit, S4 alert, S5 encryption through merge(),
     * S6 blank secrets kept, S9 no lock-out. S2 (fresh confirmation) is checked by the Form Request before this runs.
     *
     * @param  array<string, mixed>  $values
     * @param  array<int, string>  $clear
     *
     * @throws ValidationException
     */
    public function handle(User $admin, InstanceSettingKey $section, #[SensitiveParameter] array $values, array $clear, ?string $ip): ConfigurationChange
    {
        $this->ensureAccepted($section, $values);

        try {
            $stored = Cache::lock("instance-configuration:{$section->value}", self::LockSeconds)
                ->block(self::LockWaitSeconds, fn (): array => $this->store($admin, $section, $values, $clear, $ip));
        } catch (LockTimeoutException) {
            throw ValidationException::withMessages(['section' => __('Another admin is saving this section; try again.')]);
        }

        $change = new ConfigurationChange($stored['changed'], $stored['cleared'], alerted: $this->catalogue->alertsAdmins($section));

        if ($change->isEmpty()) {
            return $change;
        }

        if (! $change->alerted) {
            return $change;
        }

        $change->alertSent = $this->alertAdmins($admin, $section, $change, $ip);

        if (! $change->alertSent) {
            $this->recordUnsentAlert($stored['eventId']);
        }

        return $change;
    }

    /**
     * @param  array<string, mixed>  $values
     *
     * @throws ValidationException
     */
    private function ensureAccepted(InstanceSettingKey $section, #[SensitiveParameter] array $values): void
    {
        $fields = $this->catalogue->fields($section);

        foreach ($values as $name => $value) {
            if (! array_key_exists($name, $fields)) {
                throw ValidationException::withMessages([$name => __('This value is not accepted.')]);
            }

            if (blank($value)) {
                continue;
            }

            try {
                $fields[$name]->kind->normalise($value);
            } catch (InvalidArgumentException) {
                throw ValidationException::withMessages([$name => __('This value is not accepted.')]);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $values
     * @param  array<int, string>  $clear
     * @return array{changed: array<int, string>, cleared: array<int, string>, eventId: ?string}
     *
     * @throws ValidationException
     */
    private function store(User $admin, InstanceSettingKey $section, #[SensitiveParameter] array $values, array $clear, ?string $ip): array
    {
        $this->settings->refresh();

        try {
            $merged = $this->configuration->merge($section, $values, $clear);
        } catch (InvalidArgumentException) {
            throw ValidationException::withMessages(['section' => __('This value is not accepted.')]);
        }

        if ($merged['changed'] === [] && $merged['cleared'] === []) {
            return ['changed' => [], 'cleared' => [], 'eventId' => null];
        }

        if ($this->leavesNoSsoProvider($section, $merged['object'])) {
            throw ValidationException::withMessages(['section' => __('Turn off "Require SSO" first.')]);
        }

        $event = DB::transaction(function () use ($admin, $section, $merged, $ip): AuditEvent {
            $this->settings->set($section->value, $merged['object'] === [] ? null : $merged['object']);

            return $this->recordAuditEvent->handle(AuditAction::ConfigurationUpdated, $admin, null, [
                'section' => $section->value,
                'changed' => $merged['changed'],
                'cleared' => $merged['cleared'],
                'alertSent' => $this->catalogue->alertsAdmins($section) ? true : null,
            ], $ip);
        });

        return ['changed' => $merged['changed'], 'cleared' => $merged['cleared'], 'eventId' => $event->id];
    }

    /** @param array<string, mixed> $object */
    private function leavesNoSsoProvider(InstanceSettingKey $section, #[SensitiveParameter] array $object): bool
    {
        if ($this->catalogue->ssoProvider($section) === null) {
            return false;
        }

        if (! $this->settings->ssoRequired()) {
            return false;
        }

        foreach (SsoProvider::cases() as $provider) {
            $providerSection = $this->catalogue->section($provider);
            $providerObject = $providerSection === $section ? $object : $this->settings->configuration($providerSection);

            if ($this->configuration->completesSsoProvider($provider, $providerObject)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Sent synchronously, before anything re-applies the configuration: the mailer is the one this
     * request started with, so that an SMTP server set by an intruder does not swallow the alert (rule S4).
     */
    private function alertAdmins(User $author, InstanceSettingKey $section, ConfigurationChange $change, ?string $ip): bool
    {
        $at = now('UTC')->toIso8601String();
        $admins = User::query()->where('is_instance_admin', true)->whereNull('deactivated_at')->orderBy('id')->get();

        try {
            foreach ($admins as $admin) {
                Mail::to($admin)->locale($admin->preferredLocale() ?? app()->getLocale())->send(
                    new InstanceConfigurationChangedMail($author, $section, $change->changed, $change->cleared, $at, $ip),
                );
            }
        } catch (Throwable $exception) {
            report($exception);

            return false;
        }

        return true;
    }

    private function recordUnsentAlert(?string $eventId): void
    {
        $event = AuditEvent::query()->find($eventId);

        if ($event === null) {
            return;
        }

        $event->properties = [...($event->properties ?? []), 'alertSent' => false];
        $event->save();
    }
}
