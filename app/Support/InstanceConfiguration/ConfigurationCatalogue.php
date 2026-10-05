<?php

namespace App\Support\InstanceConfiguration;

use App\Enums\ConfigurationFieldKind;
use App\Enums\InstanceSettingKey;
use App\Enums\IntegrationProvider;
use App\Enums\SsoProvider;
use InvalidArgumentException;

/**
 * The fields of SSO, SMTP and integration-app configuration an admin may store (spec §6.8).
 * Environment-only keys (rule S8) have no field here.
 */
class ConfigurationCatalogue
{
    /** @return array<string, ConfigurationField> */
    public function fields(InstanceSettingKey $section): array
    {
        $fields = match ($section) {
            InstanceSettingKey::SsoGoogle => [
                new ConfigurationField('client_id', ['services.google.client_id'], 'GOOGLE_CLIENT_ID'),
                new ConfigurationField('client_secret', ['services.google.client_secret'], 'GOOGLE_CLIENT_SECRET', ConfigurationFieldKind::Secret),
            ],
            InstanceSettingKey::SsoGitHub => [
                new ConfigurationField('client_id', ['services.github.client_id'], 'GITHUB_CLIENT_ID'),
                new ConfigurationField('client_secret', ['services.github.client_secret'], 'GITHUB_CLIENT_SECRET', ConfigurationFieldKind::Secret),
            ],
            InstanceSettingKey::SsoEntra => [
                new ConfigurationField('tenant', ['oidc.connections.entra.tenant', 'services.oidc_entra.tenant'], 'ENTRA_TENANT'),
                new ConfigurationField('client_id', ['oidc.connections.entra.client_id', 'services.oidc_entra.client_id'], 'ENTRA_CLIENT_ID'),
                new ConfigurationField('client_secret', ['oidc.connections.entra.client_secret', 'services.oidc_entra.client_secret'], 'ENTRA_CLIENT_SECRET', ConfigurationFieldKind::Secret),
            ],
            InstanceSettingKey::SsoOidc => [
                new ConfigurationField('base_url', ['oidc.connections.generic.base_url', 'services.oidc_generic.base_url'], 'OIDC_BASE_URL', ConfigurationFieldKind::HttpsUrl),
                new ConfigurationField('client_id', ['oidc.connections.generic.client_id', 'services.oidc_generic.client_id'], 'OIDC_CLIENT_ID'),
                new ConfigurationField('client_secret', ['oidc.connections.generic.client_secret', 'services.oidc_generic.client_secret'], 'OIDC_CLIENT_SECRET', ConfigurationFieldKind::Secret),
                new ConfigurationField('label', ['oidc.connections.generic.label', 'services.oidc_generic.label'], 'OIDC_LABEL'),
            ],
            InstanceSettingKey::Smtp => [
                new ConfigurationField('mailer', ['mail.default'], 'MAIL_MAILER', ConfigurationFieldKind::MailMailer),
                new ConfigurationField('host', ['mail.mailers.smtp.host'], 'MAIL_HOST', clearsWhenStored: ['mail.mailers.smtp.url']),
                new ConfigurationField('port', ['mail.mailers.smtp.port'], 'MAIL_PORT', ConfigurationFieldKind::Port),
                new ConfigurationField('scheme', ['mail.mailers.smtp.scheme'], 'MAIL_SCHEME', ConfigurationFieldKind::MailScheme),
                new ConfigurationField('username', ['mail.mailers.smtp.username'], 'MAIL_USERNAME'),
                new ConfigurationField('password', ['mail.mailers.smtp.password'], 'MAIL_PASSWORD', ConfigurationFieldKind::Secret),
                new ConfigurationField('from_address', ['mail.from.address'], 'MAIL_FROM_ADDRESS', ConfigurationFieldKind::Email),
                new ConfigurationField('from_name', ['mail.from.name'], 'MAIL_FROM_NAME'),
            ],
            InstanceSettingKey::IntegrationSlack => [
                new ConfigurationField('client_id', ['services.slack.client_id'], 'SLACK_CLIENT_ID'),
                new ConfigurationField('client_secret', ['services.slack.client_secret'], 'SLACK_CLIENT_SECRET', ConfigurationFieldKind::Secret),
            ],
            InstanceSettingKey::IntegrationTelegram => [
                new ConfigurationField('bot_token', ['services.telegram.bot_token'], 'TELEGRAM_BOT_TOKEN', ConfigurationFieldKind::Secret),
            ],
            InstanceSettingKey::IntegrationJira => [
                new ConfigurationField('client_id', ['services.jira.client_id'], 'JIRA_CLIENT_ID'),
                new ConfigurationField('client_secret', ['services.jira.client_secret'], 'JIRA_CLIENT_SECRET', ConfigurationFieldKind::Secret),
            ],
            InstanceSettingKey::IntegrationLinear => [
                new ConfigurationField('client_id', ['services.linear.client_id'], 'LINEAR_CLIENT_ID'),
                new ConfigurationField('client_secret', ['services.linear.client_secret'], 'LINEAR_CLIENT_SECRET', ConfigurationFieldKind::Secret),
                new ConfigurationField('webhook_secret', ['services.linear.webhook_secret'], 'LINEAR_WEBHOOK_SECRET', ConfigurationFieldKind::Secret),
            ],
            InstanceSettingKey::IntegrationJiraDataCenter => [
                new ConfigurationField('base_url', ['services.jira_dc.base_url'], 'JIRA_DC_BASE_URL', ConfigurationFieldKind::HttpsUrl),
                new ConfigurationField('client_id', ['services.jira_dc.client_id'], 'JIRA_DC_CLIENT_ID'),
                new ConfigurationField('client_secret', ['services.jira_dc.client_secret'], 'JIRA_DC_CLIENT_SECRET', ConfigurationFieldKind::Secret),
                new ConfigurationField('personal_tokens', ['services.jira_dc.personal_tokens'], 'JIRA_DC_PERSONAL_TOKENS', ConfigurationFieldKind::Boolean),
            ],
            InstanceSettingKey::IntegrationGitHub => [
                new ConfigurationField('app_id', ['services.github_app.app_id'], 'GITHUB_APP_ID'),
                new ConfigurationField('slug', ['services.github_app.slug'], 'GITHUB_APP_SLUG'),
                new ConfigurationField('client_id', ['services.github_app.client_id'], 'GITHUB_APP_CLIENT_ID'),
                new ConfigurationField('client_secret', ['services.github_app.client_secret'], 'GITHUB_APP_CLIENT_SECRET', ConfigurationFieldKind::Secret),
                new ConfigurationField('private_key', ['services.github_app.private_key'], 'GITHUB_APP_PRIVATE_KEY', ConfigurationFieldKind::LongSecret),
                new ConfigurationField('webhook_secret', ['services.github_app.webhook_secret'], 'GITHUB_APP_WEBHOOK_SECRET', ConfigurationFieldKind::Secret),
            ],
            InstanceSettingKey::IntegrationMicrosoftTeams => [
                new ConfigurationField('enabled', ['services.msteams.enabled'], 'MSTEAMS_ENABLED', ConfigurationFieldKind::Boolean),
                new ConfigurationField('allowed_hosts', ['services.msteams.allowed_hosts'], 'MSTEAMS_ALLOWED_HOSTS', ConfigurationFieldKind::Hosts),
            ],
            InstanceSettingKey::IntegrationMattermost => [
                new ConfigurationField('url', ['services.mattermost.url'], 'MATTERMOST_URL', ConfigurationFieldKind::HttpsUrl),
            ],
            InstanceSettingKey::IntegrationWebhook => [
                new ConfigurationField('enabled', ['services.outgoing_webhooks.enabled'], 'OUTGOING_WEBHOOKS_ENABLED', ConfigurationFieldKind::Boolean),
            ],
            default => throw new InvalidArgumentException("Instance setting [{$section->value}] is not a configuration section."),
        };

        return collect($fields)->keyBy(fn (ConfigurationField $field): string => $field->name)->all();
    }

    public function field(InstanceSettingKey $section, string $name): ConfigurationField
    {
        return $this->fields($section)[$name]
            ?? throw new InvalidArgumentException("Unknown configuration field [{$section->value}.{$name}].");
    }

    /**
     * Every configuration key a stored field writes, the keys it clears included.
     *
     * @return array<int, string>
     */
    public function configKeys(): array
    {
        $keys = [];

        foreach (InstanceSettingKey::configurationSections() as $section) {
            foreach ($this->fields($section) as $field) {
                array_push($keys, ...$field->configKeys, ...$field->clearsWhenStored);
            }
        }

        return array_values(array_unique($keys));
    }

    public function alertsAdmins(InstanceSettingKey $section): bool
    {
        return in_array($section, [
            InstanceSettingKey::SsoGoogle,
            InstanceSettingKey::SsoGitHub,
            InstanceSettingKey::SsoEntra,
            InstanceSettingKey::SsoOidc,
            InstanceSettingKey::Smtp,
        ], true);
    }

    public function ssoProvider(InstanceSettingKey $section): ?SsoProvider
    {
        return match ($section) {
            InstanceSettingKey::SsoGoogle => SsoProvider::Google,
            InstanceSettingKey::SsoGitHub => SsoProvider::GitHub,
            InstanceSettingKey::SsoEntra => SsoProvider::Entra,
            InstanceSettingKey::SsoOidc => SsoProvider::Oidc,
            default => null,
        };
    }

    public function section(SsoProvider|IntegrationProvider $provider): InstanceSettingKey
    {
        return match ($provider) {
            SsoProvider::Google => InstanceSettingKey::SsoGoogle,
            SsoProvider::GitHub => InstanceSettingKey::SsoGitHub,
            SsoProvider::Entra => InstanceSettingKey::SsoEntra,
            SsoProvider::Oidc => InstanceSettingKey::SsoOidc,
            IntegrationProvider::Slack => InstanceSettingKey::IntegrationSlack,
            IntegrationProvider::Telegram => InstanceSettingKey::IntegrationTelegram,
            IntegrationProvider::Jira => InstanceSettingKey::IntegrationJira,
            IntegrationProvider::Linear => InstanceSettingKey::IntegrationLinear,
            IntegrationProvider::JiraDataCenter => InstanceSettingKey::IntegrationJiraDataCenter,
            IntegrationProvider::GitHub => InstanceSettingKey::IntegrationGitHub,
            IntegrationProvider::MicrosoftTeams => InstanceSettingKey::IntegrationMicrosoftTeams,
            IntegrationProvider::Mattermost => InstanceSettingKey::IntegrationMattermost,
            IntegrationProvider::Webhook => InstanceSettingKey::IntegrationWebhook,
        };
    }
}
