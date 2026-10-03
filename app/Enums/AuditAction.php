<?php

namespace App\Enums;

enum AuditAction: string
{
    case SettingsUpdated = 'settings_updated';
    case ConfigurationUpdated = 'configuration_updated';
    case BrandingReset = 'branding_reset';
    case SsoTested = 'sso_tested';
    case MailTested = 'mail_tested';
    case SsoRequiredChanged = 'sso_required_changed';
    case AdminGranted = 'admin_granted';
    case AdminRevoked = 'admin_revoked';
    case UserDeactivated = 'user_deactivated';
    case UserReactivated = 'user_reactivated';
    case SignedIn = 'signed_in';
    case SignInFailed = 'sign_in_failed';
    case TwoFactorEnabled = 'two_factor_enabled';
    case TwoFactorDisabled = 'two_factor_disabled';
    case PasswordChanged = 'password_changed';
    case TokenCreated = 'token_created';
    case TokenRevoked = 'token_revoked';
    case TokenRevokedByAdmin = 'token_revoked_by_admin';

    public const string GroupSettings = 'settings';

    public const string GroupAccounts = 'accounts';

    public const string GroupSignIn = 'signIn';

    public const string GroupTokens = 'tokens';

    public function group(): string
    {
        return match ($this) {
            self::SettingsUpdated,
            self::ConfigurationUpdated,
            self::BrandingReset,
            self::SsoTested,
            self::MailTested,
            self::SsoRequiredChanged => self::GroupSettings,
            self::AdminGranted,
            self::AdminRevoked,
            self::UserDeactivated,
            self::UserReactivated => self::GroupAccounts,
            self::SignedIn,
            self::SignInFailed,
            self::TwoFactorEnabled,
            self::TwoFactorDisabled,
            self::PasswordChanged => self::GroupSignIn,
            self::TokenCreated,
            self::TokenRevoked,
            self::TokenRevokedByAdmin => self::GroupTokens,
        };
    }
}
