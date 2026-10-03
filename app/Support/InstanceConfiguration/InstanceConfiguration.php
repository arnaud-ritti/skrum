<?php

namespace App\Support\InstanceConfiguration;

use App\Enums\InstanceSettingKey;
use App\Support\InstanceSettings;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Mail\MailManager;
use Illuminate\Support\Facades\Crypt;
use InvalidArgumentException;
use Laravel\Socialite\Contracts\Factory as SocialiteFactory;
use SensitiveParameter;

/**
 * Reads the stored SSO, SMTP and integration-app configuration, field by field over the
 * environment baseline, and prepares the object a write stores (spec §6.8, rules S5 to S7).
 */
class InstanceConfiguration
{
    public const int ConfirmationSeconds = 300;

    public const string AppliedKeys = 'skrum.instance_configuration.applied';

    public function __construct(
        private InstanceSettings $settings,
        private ConfigurationCatalogue $catalogue,
        private InstanceConfigurationBaseline $baseline,
    ) {}

    /** @return array{stored: bool, value: mixed, unreadable: bool} */
    public function stored(InstanceSettingKey $section, string $name): array
    {
        $field = $this->catalogue->field($section, $name);
        $object = $this->settings->configuration($section);

        if (! array_key_exists($name, $object)) {
            return ['stored' => false, 'value' => null, 'unreadable' => false];
        }

        if (! $field->kind->isSecret()) {
            return ['stored' => true, 'value' => $object[$name], 'unreadable' => false];
        }

        if (! is_string($object[$name])) {
            return ['stored' => false, 'value' => null, 'unreadable' => true];
        }

        try {
            return ['stored' => true, 'value' => Crypt::decryptString($object[$name]), 'unreadable' => false];
        } catch (DecryptException) {
            return ['stored' => false, 'value' => null, 'unreadable' => true];
        }
    }

    public function value(InstanceSettingKey $section, string $name): mixed
    {
        $stored = $this->stored($section, $name);

        if ($stored['stored']) {
            return $stored['value'];
        }

        return $this->environmentValue($section, $name);
    }

    /**
     * What a section's page may show: never a secret's value.
     *
     * @return array<string, array{
     *     value: mixed,
     *     source: 'stored'|'environment'|'none',
     *     secret: bool,
     *     secretSet: bool,
     *     unreadable: bool,
     *     envName: string
     * }>
     */
    public function describe(InstanceSettingKey $section): array
    {
        $description = [];

        foreach ($this->catalogue->fields($section) as $name => $field) {
            $stored = $this->stored($section, $name);
            $isSecret = $field->kind->isSecret();
            $value = $stored['stored'] ? $stored['value'] : $this->environmentValue($section, $name);

            $description[$name] = [
                'value' => $isSecret ? null : $value,
                'source' => $this->source($stored['stored'], $section, $name),
                'secret' => $isSecret,
                'secretSet' => $isSecret && filled($value),
                'unreadable' => $stored['unreadable'],
                'envName' => $field->envName,
            ];
        }

        return $description;
    }

    /**
     * The section's object after a write: a blank value keeps what is stored (rule S6),
     * a secret is encrypted (rule S5), a cleared field returns to the environment (rule S7).
     *
     * @param  array<string, mixed>  $values
     * @param  array<int, string>  $clear
     * @return array{object: array<string, mixed>, changed: array<int, string>, cleared: array<int, string>}
     */
    public function merge(InstanceSettingKey $section, #[SensitiveParameter] array $values, array $clear): array
    {
        $fields = $this->catalogue->fields($section);
        $object = $this->settings->configuration($section);
        $changed = [];
        $cleared = [];

        foreach (array_keys($values) as $name) {
            if (! array_key_exists($name, $fields)) {
                throw new InvalidArgumentException("Unknown configuration field [{$section->value}.{$name}].");
            }
        }

        foreach ($values as $name => $value) {
            if (blank($value)) {
                continue;
            }

            if (in_array($name, $clear, true)) {
                continue;
            }

            $field = $fields[$name];
            $normalised = $field->kind->normalise($value);

            if ($this->stored($section, $name) === ['stored' => true, 'value' => $normalised, 'unreadable' => false]) {
                continue;
            }

            $object[$name] = $field->kind->isSecret() ? Crypt::encryptString((string) $normalised) : $normalised;
            $changed[] = $name;
        }

        foreach ($clear as $name) {
            if (! array_key_exists($name, $fields)) {
                continue;
            }

            if (! array_key_exists($name, $object)) {
                continue;
            }

            unset($object[$name]);
            $cleared[] = $name;
        }

        sort($changed);
        sort($cleared);

        return ['object' => $object, 'changed' => $changed, 'cleared' => $cleared];
    }

    /**
     * Lays the stored fields over config() and puts back the environment value of every key it wrote
     * before that is no longer stored. Called per request, per job and per command; never at boot.
     */
    public function apply(): void
    {
        $previous = (array) config(self::AppliedKeys, []);
        $written = [];

        foreach (InstanceSettingKey::configurationSections() as $section) {
            foreach ($this->catalogue->fields($section) as $field) {
                $stored = $this->stored($section, $field->name);

                if (! $stored['stored']) {
                    continue;
                }

                foreach ($field->configKeys as $key) {
                    config([$key => $stored['value']]);
                    $written[] = $key;
                }

                foreach ($field->clearsWhenStored as $key) {
                    config([$key => null]);
                    $written[] = $key;
                }
            }
        }

        foreach (array_diff($previous, $written) as $key) {
            config([$key => $this->baseline->get($key)]);
        }

        config([self::AppliedKeys => $written]);

        if ($written === [] && $previous === []) {
            return;
        }

        $this->forgetResolvedClients();
    }

    private function forgetResolvedClients(): void
    {
        if (app()->resolved('mail.manager')) {
            app(MailManager::class)->forgetMailers();
        }

        if (app()->resolved(SocialiteFactory::class)) {
            app(SocialiteFactory::class)->forgetDrivers();
        }
    }

    private function environmentValue(InstanceSettingKey $section, string $name): mixed
    {
        return $this->baseline->get($this->catalogue->field($section, $name)->configKeys[0]);
    }

    /** @return 'stored'|'environment'|'none' */
    private function source(bool $isStored, InstanceSettingKey $section, string $name): string
    {
        if ($isStored) {
            return 'stored';
        }

        if (filled($this->environmentValue($section, $name))) {
            return 'environment';
        }

        return 'none';
    }
}
