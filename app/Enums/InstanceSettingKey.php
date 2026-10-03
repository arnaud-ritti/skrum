<?php

namespace App\Enums;

enum InstanceSettingKey: string
{
    case BrandColor = 'brand_color';
    case BrandRadius = 'brand_radius';
    case DisplayName = 'display_name';
    case PoweredBy = 'powered_by';
    case LogoLight = 'logo_light';
    case LogoDark = 'logo_dark';
    case Favicon = 'favicon';
    case LogoMail = 'logo_mail';
    case AvatarStyle = 'avatar_style';
    case AvatarMemberChoice = 'avatar_member_choice';
    case ProfilePhotos = 'profile_photos';
    case GifProvider = 'gif_provider';
    case GifEnabled = 'gif_enabled';
    case GifRating = 'gif_rating';
    case GifKey = 'gif_key';
    case SsoRequired = 'sso_required';

    case SignupMode = 'signup_mode';
    case AllowedEmailDomains = 'allowed_email_domains';
    case MaintenanceMessage = 'maintenance_message';
    case MaintenanceMessageBy = 'maintenance_message_by';
    case UpdateCheckEnabled = 'update_check_enabled';
    case LatestVersion = 'latest_version';
    case UpdateCheckedAt = 'update_checked_at';
    case DisabledIntegrations = 'disabled_integrations';
    case MailLastTest = 'mail_last_test';
    case SsoLastTest = 'sso_last_test';
    case SsoGoogle = 'sso_google';
    case SsoGitHub = 'sso_github';
    case SsoEntra = 'sso_entra';
    case SsoOidc = 'sso_oidc';
    case Smtp = 'smtp';
    case IntegrationSlack = 'integration_slack';
    case IntegrationTelegram = 'integration_telegram';
    case IntegrationJira = 'integration_jira';
    case IntegrationLinear = 'integration_linear';
    case IntegrationJiraDataCenter = 'integration_jira_dc';
    case IntegrationGitHub = 'integration_github';
    case IntegrationMicrosoftTeams = 'integration_msteams';
    case IntegrationMattermost = 'integration_mattermost';
    case IntegrationWebhook = 'integration_webhook';

    /**
     * The sections of SSO, SMTP and integration-app configuration an admin may store (spec §6.8).
     *
     * @return array<int, self>
     */
    public static function configurationSections(): array
    {
        return [
            self::SsoGoogle, self::SsoGitHub, self::SsoEntra, self::SsoOidc, self::Smtp,
            self::IntegrationSlack, self::IntegrationTelegram, self::IntegrationJira, self::IntegrationLinear,
            self::IntegrationJiraDataCenter, self::IntegrationGitHub, self::IntegrationMicrosoftTeams,
            self::IntegrationMattermost, self::IntegrationWebhook,
        ];
    }

    /**
     * The keys the Branding screen owns, and the only ones its reset clears.
     *
     * @return array<int, self>
     */
    public static function branding(): array
    {
        return [
            self::BrandColor, self::BrandRadius, self::DisplayName, self::PoweredBy, self::LogoLight,
            self::LogoDark, self::Favicon, self::LogoMail, self::AvatarStyle, self::AvatarMemberChoice,
            self::ProfilePhotos, self::GifProvider, self::GifEnabled, self::GifRating, self::GifKey,
        ];
    }
}
