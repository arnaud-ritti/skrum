import { describe, expect, it } from 'vitest';
import type { AuditAction, AuditEvent } from '@/lib/admin/types';
import { AuditActions } from '@/lib/admin/types';
import { auditActionLabel } from './audit-action-label';

const t = (key: string, replacements: Record<string, string | number> = {}) =>
    Object.entries(replacements).reduce(
        (line, [name, value]) => line.replaceAll(`:${name}`, String(value)),
        key,
    );

function event(
    action: AuditAction,
    overrides: Partial<AuditEvent> = {},
): AuditEvent {
    return {
        id: 'event-1',
        action,
        group: 'settings',
        actor: { id: 'user-1', name: 'Nadia', avatarUrl: null },
        subject: { type: 'User', id: 'user-2', label: 'Malik' },
        properties: {},
        ownerName: null,
        ip: '203.0.113.7',
        at: '2026-10-15T11:52:00Z',
        ...overrides,
    };
}

const recordedProperties: Partial<
    Record<AuditAction, AuditEvent['properties']>
> = {
    settings_updated: { section: 'general', keys: ['signup_mode'] },
    configuration_updated: {
        section: 'smtp',
        changed: ['host'],
        cleared: [],
        alertSent: null,
    },
    sso_tested: { provider: 'google', ok: true },
    mail_tested: { ok: true },
    sso_required_changed: { value: true },
    sign_in_failed: { email: 'malik@atlas.fr' },
    token_created: { name: 'CI' },
    token_revoked: { name: 'CI' },
    token_revoked_by_admin: { name: 'CI', owner: 'user-2' },
};

describe('auditActionLabel', () => {
    it.each(AuditActions)('gives %s a sentence of its own', (action) => {
        const label = auditActionLabel(
            event(action, { properties: recordedProperties[action] ?? {} }),
            t,
        );

        expect(label).not.toBe('');
        expect(label).not.toBe(action);
        expect(label).not.toMatch(/:[a-z]+/);
        expect(label).not.toMatch(/^\s|\s{2}|\s$/);
    });

    it.each([
        [
            'general',
            [
                'signup_mode',
                'allowed_email_domains',
                'maintenance_message',
                'update_check_enabled',
            ],
        ],
        [
            'branding',
            [
                'brand_color',
                'brand_radius',
                'display_name',
                'powered_by',
                'logo_light',
                'logo_dark',
                'favicon',
                'logo_mail',
                'avatar_style',
                'avatar_member_choice',
                'profile_photos',
                'gif_provider',
                'gif_enabled',
                'gif_rating',
                'gif_key',
            ],
        ],
        ['integrations', ['disabled_integrations']],
        ['sign_in', ['default_workspace']],
    ])('names every key the server records in %s', (section, keys) => {
        const label = auditActionLabel(
            event('settings_updated', {
                subject: null,
                properties: { section, keys },
            }),
            t,
        );

        expect(label).not.toMatch(/[a-z]+_[a-z]+/);
    });

    it('leaves out the author of the maintenance message, which changes with it', () => {
        expect(
            auditActionLabel(
                event('settings_updated', {
                    subject: null,
                    properties: {
                        section: 'general',
                        keys: ['maintenance_message', 'maintenance_message_by'],
                    },
                }),
                t,
            ),
        ).toBe('changed Maintenance message in General');
    });

    it('gives every action a different sentence', () => {
        const labels = AuditActions.map((action) =>
            auditActionLabel(event(action), t),
        );

        expect(new Set(labels).size).toBe(AuditActions.length);
    });

    it('names the changed and cleared fields of a section and the alert', () => {
        expect(
            auditActionLabel(
                event('configuration_updated', {
                    subject: null,
                    properties: {
                        section: 'sso_oidc',
                        changed: ['client_id'],
                        cleared: ['label'],
                        alertSent: true,
                    },
                }),
                t,
            ),
        ).toBe('changed Client ID, Button label of OIDC (admins alerted)');
        expect(
            auditActionLabel(
                event('configuration_updated', {
                    subject: null,
                    properties: {
                        section: 'integration_slack',
                        changed: ['client_id'],
                        cleared: [],
                        alertSent: null,
                    },
                }),
                t,
            ),
        ).toBe('changed Client ID of Slack');
    });

    it('names the keys and the section of a settings change', () => {
        expect(
            auditActionLabel(
                event('settings_updated', {
                    subject: null,
                    properties: {
                        section: 'general',
                        keys: ['signup_mode', 'maintenance_message'],
                    },
                }),
                t,
            ),
        ).toBe('changed Sign-up, Maintenance message in General');
    });

    it('names the fields with the labels of their forms', () => {
        expect(
            auditActionLabel(
                event('settings_updated', {
                    subject: null,
                    properties: {
                        section: 'integrations',
                        keys: ['disabled_integrations'],
                    },
                }),
                t,
            ),
        ).toBe('changed Turned-off integrations in Integrations');
        expect(
            auditActionLabel(
                event('configuration_updated', {
                    subject: null,
                    properties: {
                        section: 'smtp',
                        changed: ['password', 'from_name'],
                        cleared: [],
                        alertSent: null,
                    },
                }),
                t,
            ),
        ).toBe('changed Password, Sender name of SMTP');
        expect(
            auditActionLabel(
                event('configuration_updated', {
                    subject: null,
                    properties: {
                        section: 'integration_jira_dc',
                        changed: ['base_url'],
                        cleared: [],
                        alertSent: null,
                    },
                }),
                t,
            ),
        ).toBe('changed Server URL of Jira Data Center');
    });

    it('names the owner of a key an admin revoked', () => {
        expect(
            auditActionLabel(
                event('token_revoked_by_admin', {
                    subject: {
                        type: 'PersonalAccessToken',
                        id: '7',
                        label: null,
                    },
                    properties: { name: 'CI', owner: 'user-2' },
                    ownerName: 'Malik',
                }),
                t,
            ),
        ).toBe('revoked the key CI of Malik');
    });

    it('says a deleted account for a user subject that is gone', () => {
        expect(
            auditActionLabel(
                event('user_deactivated', {
                    subject: { type: 'User', id: 'user-2', label: null },
                }),
                t,
            ),
        ).toBe('deactivated a deleted account');
    });

    it('names the address of a failed sign-in', () => {
        expect(
            auditActionLabel(
                event('sign_in_failed', {
                    actor: null,
                    subject: null,
                    properties: { email: 'malik@atlas.fr' },
                }),
                t,
            ),
        ).toBe('failed sign-in as malik@atlas.fr');
    });
});
