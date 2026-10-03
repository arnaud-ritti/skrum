import { useTrans } from '@/hooks/use-trans';
import type { AuditEvent } from '@/lib/admin/types';

type Translate = ReturnType<typeof useTrans>['t'];

/** Brand names stay as they are; the instance's own sections are translated. */
const BrandSections: Record<string, string> = {
    sso_google: 'Google',
    sso_github: 'GitHub',
    sso_entra: 'Microsoft Entra ID',
    sso_oidc: 'OIDC',
    smtp: 'SMTP',
    integration_slack: 'Slack',
    integration_telegram: 'Telegram',
    integration_jira: 'Jira',
    integration_linear: 'Linear',
    integration_jira_dc: 'Jira Data Center',
    integration_github: 'GitHub',
    integration_msteams: 'Microsoft Teams',
    integration_mattermost: 'Mattermost',
};

const BrandProviders: Record<string, string> = {
    google: 'Google',
    github: 'GitHub',
    entra: 'Microsoft Entra ID',
    oidc: 'OIDC',
};

function text(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
}

/** The labels the admin forms give these settings and fields; an unknown name stays as it is. */
function fieldLabels(section: string, t: Translate): Record<string, string> {
    return {
        brand_color: t('Primary colour'),
        brand_radius: t('Corner radius'),
        display_name: t('Display name'),
        powered_by: t('Show "Powered by Skrüm"'),
        logo_light: t('Light logo'),
        logo_dark: t('Dark logo'),
        favicon: t('Favicon'),
        logo_mail: t('Logo for e-mails'),
        avatar_style: t('Avatar style'),
        avatar_member_choice: t('Members can choose their own style'),
        gif_provider: t('GIF provider'),
        gif_enabled: t('GIFs enabled'),
        gif_rating: t('Content rating'),
        gif_key: t('API key'),
        sso_required: t('Require single sign-on'),
        signup_mode: t('Sign-up'),
        allowed_email_domains: t('Allowed domains'),
        maintenance_message: t('Maintenance message'),
        update_check_enabled: t('Updates'),
        disabled_integrations: t('Turned-off integrations'),
        mailer: t('Delivery'),
        host: t('Host'),
        port: t('Port'),
        scheme: t('Encryption'),
        username: t('Username'),
        password: t('Password'),
        from_address: t('Sender address'),
        from_name: t('Sender name'),
        base_url: section.startsWith('sso_')
            ? t('Issuer URL')
            : t('Server URL'),
        tenant: t('Tenant ID'),
        label: t('Button label'),
        client_id: t('Client ID'),
        client_secret: t('Client secret'),
        webhook_secret: t('Webhook secret'),
        bot_token: t('Bot token'),
        url: t('Server URL'),
        personal_tokens: t('Personal access tokens'),
        app_id: t('App ID'),
        slug: t('App slug'),
        private_key: t('Private key'),
        enabled: t('Enabled'),
        allowed_hosts: t('Allowed hosts'),
    };
}

function names(section: unknown, t: Translate, ...values: unknown[]): string {
    const labels = fieldLabels(text(section) ?? '', t);

    return values
        .flatMap((value) => (Array.isArray(value) ? value : []))
        .filter((value): value is string => typeof value === 'string')
        .map((name) => labels[name] ?? name)
        .join(', ');
}

function sectionLabel(section: unknown, t: Translate): string {
    const key = text(section) ?? '';

    if (key === 'general') {
        return t('General');
    }

    if (key === 'branding') {
        return t('Branding');
    }

    if (key === 'integrations') {
        return t('Integrations');
    }

    if (key === 'integration_webhook') {
        return t('Webhook');
    }

    return BrandSections[key] ?? key;
}

/** The person or thing the event is about, as the table's subject column shows it. */
export function auditSubjectLabel(
    event: AuditEvent,
    t: Translate,
): string | null {
    if (event.subject === null) {
        return null;
    }

    if (event.subject.label !== null) {
        return event.subject.label;
    }

    if (event.subject.type === 'User') {
        return t('a deleted account');
    }

    return text(event.properties.name);
}

/** The sentence of one event, its actor left out (the table names them). */
export function auditActionLabel(event: AuditEvent, t: Translate): string {
    const properties = event.properties;
    const subject = auditSubjectLabel(event, t) ?? t('a deleted account');
    const section = sectionLabel(properties.section, t);
    const name = text(properties.name) ?? '';

    switch (event.action) {
        case 'settings_updated':
            return t('changed :keys in :section', {
                keys: names(properties.section, t, properties.keys),
                section,
            });
        case 'configuration_updated': {
            const fields = names(
                properties.section,
                t,
                properties.changed,
                properties.cleared,
            );

            if (properties.alertSent === true) {
                return t('changed :fields of :section (admins alerted)', {
                    fields,
                    section,
                });
            }

            if (properties.alertSent === false) {
                return t(
                    'changed :fields of :section (the alert to the admins failed)',
                    { fields, section },
                );
            }

            return t('changed :fields of :section', { fields, section });
        }
        case 'branding_reset':
            return t('reset the branding');
        case 'sso_tested': {
            const provider =
                BrandProviders[text(properties.provider) ?? ''] ??
                text(properties.provider) ??
                '';

            return properties.ok === true
                ? t('tested the :provider connection: connected', { provider })
                : t('tested the :provider connection: failed', { provider });
        }
        case 'mail_tested':
            return properties.ok === true
                ? t('sent a test e-mail: delivered')
                : t('sent a test e-mail: failed');
        case 'sso_required_changed':
            return properties.value === true
                ? t('made single sign-on required')
                : t('made single sign-on optional');
        case 'admin_granted':
            return t('made :subject an instance admin', { subject });
        case 'admin_revoked':
            return t('removed :subject from the instance admins', { subject });
        case 'user_deactivated':
            return t('deactivated :subject', { subject });
        case 'user_reactivated':
            return t('reactivated :subject', { subject });
        case 'signed_in':
            return t('signed in');
        case 'sign_in_failed': {
            const email = text(properties.email);

            return email === null
                ? t('failed sign-in')
                : t('failed sign-in as :email', { email });
        }
        case 'two_factor_enabled':
            return t('turned on two-factor authentication');
        case 'two_factor_disabled':
            return t('turned off two-factor authentication');
        case 'password_changed':
            return t('changed the password');
        case 'token_created':
            return t('created the key :name', { name });
        case 'token_revoked':
            return t('revoked the key :name', { name });
        case 'token_revoked_by_admin':
            return t('revoked the key :name of :owner', {
                name,
                owner: event.ownerName ?? t('a deleted account'),
            });
        default: {
            const unknown: never = event.action;

            return String(unknown);
        }
    }
}

export function AuditActionLabel({ event }: { event: AuditEvent }) {
    const { t } = useTrans();

    return <>{auditActionLabel(event, t)}</>;
}
