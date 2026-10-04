<?php

namespace App\Mail;

use App\Enums\InstanceSettingKey;
use App\Models\User;
use App\Support\Mail\MailBrand;
use Carbon\CarbonInterface;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Support\Facades\Date;

/**
 * Not queued on purpose (rule S4): the alert leaves before the request ends, through the
 * mail configuration in force before the change. Names fields, never a value.
 */
class InstanceConfigurationChangedMail extends Mailable
{
    /**
     * @param  array<int, string>  $changed
     * @param  array<int, string>  $cleared
     */
    public function __construct(
        public User $author,
        public InstanceSettingKey $section,
        public array $changed,
        public array $cleared,
        public string $at,
        public ?string $ip,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine());
    }

    public function content(): Content
    {
        $brand = resolve(MailBrand::class);
        $warning = __('If no admin made this change, sign in, check the section and change your password.');

        return new Content(
            view: 'mail.instance-configuration-changed',
            text: 'mail.text.instance-configuration-changed',
            with: [
                'brand' => $brand,
                'colors' => $brand->colors(),
                'title' => $this->subjectLine(),
                'preheader' => $warning,
                'summary' => $this->summary(),
                'changedLabels' => array_map($this->fieldLabel(...), $this->changed),
                'clearedLabels' => array_map($this->fieldLabel(...), $this->cleared),
                'warning' => $warning,
                'sectionUrl' => $this->sectionUrl(),
            ],
        );
    }

    private function subjectLine(): string
    {
        $instance = resolve(MailBrand::class)->name();

        return match ($this->section) {
            InstanceSettingKey::SsoGoogle,
            InstanceSettingKey::SsoGitHub,
            InstanceSettingKey::SsoEntra,
            InstanceSettingKey::SsoOidc => __('SSO settings changed on :instance', ['instance' => $instance]),
            InstanceSettingKey::Smtp => __('SMTP settings changed on :instance', ['instance' => $instance]),
            default => __('Settings changed on :instance', ['instance' => $instance]),
        };
    }

    private function summary(): string
    {
        $at = $this->localised(Date::parse($this->at)->utc());
        $replace = [
            'name' => $this->author->name,
            'email' => $this->author->email,
            'section' => $this->sectionLabel(),
            'date' => $at->isoFormat('LL'),
            'time' => $at->format('H:i'),
        ];

        if ($this->ip === null) {
            return __(':name (:email) changed :section on :date at :time UTC.', $replace);
        }

        return __(':name (:email) changed :section on :date at :time UTC from :ip.', [...$replace, 'ip' => $this->ip]);
    }

    private function localised(CarbonInterface $date): CarbonInterface
    {
        return $date->copy()->locale(app()->getLocale());
    }

    private function sectionLabel(): string
    {
        return match ($this->section) {
            InstanceSettingKey::SsoGoogle => __('SSO (:provider)', ['provider' => 'Google']),
            InstanceSettingKey::SsoGitHub => __('SSO (:provider)', ['provider' => 'GitHub']),
            InstanceSettingKey::SsoEntra => __('SSO (:provider)', ['provider' => 'Microsoft Entra']),
            InstanceSettingKey::SsoOidc => __('SSO (:provider)', ['provider' => 'OIDC']),
            InstanceSettingKey::Smtp => 'SMTP',
            default => $this->section->value,
        };
    }

    private function fieldLabel(string $name): string
    {
        return match ($name) {
            'client_id' => __('Client ID'),
            'client_secret' => __('Client secret'),
            'tenant' => __('Tenant ID'),
            'base_url' => __('Issuer URL'),
            'label' => __('Button label'),
            'mailer' => __('Mailer'),
            'host' => __('Host'),
            'port' => __('Port'),
            'scheme' => __('Encryption'),
            'username' => __('Username'),
            'password' => __('Password'),
            'from_address' => __('Sender address'),
            'from_name' => __('Sender name'),
            default => $name,
        };
    }

    private function sectionUrl(): string
    {
        return match ($this->section) {
            InstanceSettingKey::SsoGoogle,
            InstanceSettingKey::SsoGitHub,
            InstanceSettingKey::SsoEntra,
            InstanceSettingKey::SsoOidc => route('admin.signIn.edit'),
            InstanceSettingKey::Smtp => route('admin.mail.show'),
            default => route('admin.index'),
        };
    }
}
