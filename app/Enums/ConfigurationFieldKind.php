<?php

namespace App\Enums;

use Illuminate\Support\Facades\Validator;
use InvalidArgumentException;
use SensitiveParameter;

enum ConfigurationFieldKind: string
{
    case Text = 'text';
    case Secret = 'secret';
    case LongSecret = 'long_secret';
    case HttpsUrl = 'https_url';
    case Port = 'port';
    case Boolean = 'boolean';
    case Hosts = 'hosts';
    case Email = 'email';
    case MailMailer = 'mail_mailer';
    case MailScheme = 'mail_scheme';

    /** A host name with at least one dot, as allowed e-mail domains and allowed hosts are written. */
    public const string HostNamePattern = '/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i';

    public function isSecret(): bool
    {
        return in_array($this, [self::Secret, self::LongSecret], true);
    }

    /** @return array<int, mixed> */
    public function rules(): array
    {
        return match ($this) {
            self::Text => ['string', 'max:255'],
            self::Secret => ['string', 'max:4096'],
            self::LongSecret => ['string', 'max:16384'],
            self::HttpsUrl => ['string', 'max:2048', 'url:https'],
            self::Port => ['integer', 'between:1,65535'],
            self::Boolean => ['boolean'],
            self::Hosts => ['array', 'max:20'],
            self::Email => ['string', 'email', 'max:255'],
            self::MailMailer => ['string', 'in:smtp,log'],
            self::MailScheme => ['string', 'in:smtp,smtps'],
        };
    }

    /** @return array<int, mixed> The rules of each entry of a list kind, none for any other kind. */
    public function itemRules(): array
    {
        return match ($this) {
            self::Hosts => ['string', 'max:253', 'regex:'.self::HostNamePattern],
            default => [],
        };
    }

    public function normalise(#[SensitiveParameter] mixed $value): mixed
    {
        $rules = ['value' => ['required', ...$this->rules()]];

        if ($this->itemRules() !== []) {
            $rules['value.*'] = $this->itemRules();
        }

        $isValid = Validator::make(['value' => $value], $rules)->passes();

        if (! $isValid) {
            throw new InvalidArgumentException("A configuration value of kind [{$this->value}] was refused.");
        }

        return match ($this) {
            self::Port => (int) $value,
            self::Boolean => filter_var($value, FILTER_VALIDATE_BOOL),
            self::HttpsUrl => rtrim(trim((string) $value), '/'),
            self::Hosts => self::hostsFrom((array) $value),
            self::LongSecret => str_replace("\r\n", "\n", (string) $value),
            default => trim((string) $value),
        };
    }

    /**
     * @param  array<array-key, mixed>  $hosts
     * @return array<int, string>
     */
    private static function hostsFrom(array $hosts): array
    {
        $names = array_map(fn (mixed $host): string => is_scalar($host) ? strtolower(trim((string) $host)) : '', $hosts);

        return array_values(array_unique(array_filter($names, fn (string $host): bool => $host !== '')));
    }
}
